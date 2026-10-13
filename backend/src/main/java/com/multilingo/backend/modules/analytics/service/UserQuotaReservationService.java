package com.multilingo.backend.modules.analytics.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.analytics.entity.UserQuota;
import com.multilingo.backend.modules.analytics.repository.UserQuotaRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

/**
 * Service quản lý đặt trước (reservation) và hoàn trả (refund) hạn mức người dùng (UserQuota).
 * Tất cả các phương thức chạy trong transaction hiện hành (không dùng REQUIRES_NEW).
 */
@Service
public class UserQuotaReservationService {

    public static final String FEATURE_CODE = "AI_WRITING_HINTS";

    private final UserQuotaRepository userQuotaRepository;
    private final Clock clock;

    @PersistenceContext
    private EntityManager entityManager;

    @Autowired
    public UserQuotaReservationService(
            UserQuotaRepository userQuotaRepository,
            Clock clock,
            @Autowired(required = false) EntityManager entityManager
    ) {
        this.userQuotaRepository = userQuotaRepository;
        this.clock = clock;
        this.entityManager = entityManager;
    }

    public UserQuotaReservationService(UserQuotaRepository userQuotaRepository, Clock clock) {
        this(userQuotaRepository, clock, null);
    }

    public record QuotaAccount(
            Integer quotaId,
            Integer userId,
            String featureCode,
            int usedCount,
            int maxLimit,
            Instant resetDate
    ) {}

    public record QuotaReservation(
            Integer quotaId,
            Instant resetDate
    ) {}

    /**
     * Khóa dòng quota của người dùng bằng SELECT FOR UPDATE và kiểm tra tính hợp lệ.
     * Thất bại an toàn (QUOTA_EXCEEDED) nếu missing, expired, exhausted, invalid, hoặc duplicate.
     */
    @Transactional
    public QuotaAccount lockAccount(Integer userId) {
        if (userId == null) {
            throw new AppException(ErrorCode.QUOTA_EXCEEDED, "User ID is required for quota reservation");
        }

        List<UserQuota> rows = userQuotaRepository.findAllByUserIdAndFeatureCodeForUpdate(userId, FEATURE_CODE);

        if (rows.isEmpty()) {
            throw new AppException(ErrorCode.QUOTA_EXCEEDED, "No quota provisioned for feature: " + FEATURE_CODE);
        }

        if (rows.size() > 1) {
            throw new AppException(ErrorCode.QUOTA_EXCEEDED, "Duplicate quota rows detected for user: " + userId);
        }

        UserQuota quota = rows.getFirst();
        if (entityManager != null && entityManager.contains(quota)) {
            entityManager.refresh(quota);
        }
        Instant now = clock.instant();

        if (quota.getUsedCount() == null || quota.getUsedCount() < 0
                || quota.getMaxLimit() == null || quota.getMaxLimit() <= 0
                || quota.getResetDate() == null) {
            throw new AppException(ErrorCode.QUOTA_EXCEEDED, "Invalid quota configuration");
        }

        if (!quota.getResetDate().isAfter(now)) {
            throw new AppException(ErrorCode.QUOTA_EXCEEDED, "Quota period has expired");
        }

        if (quota.getUsedCount() >= quota.getMaxLimit()) {
            throw new AppException(ErrorCode.QUOTA_EXCEEDED, "Quota limit reached");
        }

        return new QuotaAccount(
                quota.getId(),
                quota.getUserId(),
                quota.getFeatureCode(),
                quota.getUsedCount(),
                quota.getMaxLimit(),
                quota.getResetDate()
        );
    }

    /**
     * Đặt trước quota bằng câu lệnh conditional update nguyên tử.
     */
    @Transactional
    public QuotaReservation reserve(QuotaAccount account, Instant now) {
        if (account == null || now == null) {
            throw new AppException(ErrorCode.QUOTA_EXCEEDED, "Invalid reservation arguments");
        }

        int updated = userQuotaRepository.conditionalIncrement(account.quotaId(), account.resetDate(), now);
        if (updated != 1) {
            throw new AppException(ErrorCode.QUOTA_EXCEEDED, "Quota conditional update failed");
        }

        return new QuotaReservation(account.quotaId(), account.resetDate());
    }

    /**
     * Khóa dòng quota của người dùng để tuần tự hóa các thao tác.
     * Không tự chặn khi quota hết hạn mức hoặc hết hạn period;
     * việc kiểm tra hạn mức thuộc về reserve/tryReserve.
     */
    @Transactional
    public void lockUserQuota(Integer userId) {
        if (userId != null) {
            List<UserQuota> rows = userQuotaRepository.findAllByUserIdAndFeatureCodeForUpdate(userId, FEATURE_CODE);
            if (entityManager != null) {
                for (UserQuota q : rows) {
                    if (entityManager.contains(q)) {
                        entityManager.refresh(q);
                    }
                }
            }
        }
    }

    /**
     * Cố gắng đặt trước quota bằng conditional update.
     * Trả về Optional rỗng nếu quota không hợp lệ, hết hạn, hoặc hết hạn mức,
     * KHÔNG ném AppException để tránh đánh dấu rollback-only cho outer transaction.
     */
    @Transactional
    public java.util.Optional<QuotaReservation> tryReserve(Integer userId) {
        if (userId == null) {
            return java.util.Optional.empty();
        }
        List<UserQuota> rows = userQuotaRepository.findAllByUserIdAndFeatureCodeForUpdate(userId, FEATURE_CODE);
        if (rows.size() != 1) {
            return java.util.Optional.empty();
        }
        UserQuota quota = rows.getFirst();
        if (entityManager != null && entityManager.contains(quota)) {
            entityManager.refresh(quota);
        }
        Instant now = clock.instant();
        if (quota.getUsedCount() == null || quota.getUsedCount() < 0
                || quota.getMaxLimit() == null || quota.getMaxLimit() <= 0
                || quota.getResetDate() == null
                || !quota.getResetDate().isAfter(now)) {
            return java.util.Optional.empty();
        }
        int updated = userQuotaRepository.conditionalIncrement(quota.getId(), quota.getResetDate(), now);
        if (updated != 1) {
            return java.util.Optional.empty();
        }
        return java.util.Optional.of(new QuotaReservation(quota.getId(), quota.getResetDate()));
    }

    /**
     * Tiện ích kết hợp lockAccount và reserve theo userId.
     */
    @Transactional
    public QuotaReservation reserve(Integer userId) {
        return tryReserve(userId).orElseThrow(() -> new AppException(ErrorCode.QUOTA_EXCEEDED, "Quota limit reached or unavailable"));
    }

    /**
     * Hoàn trả quota bằng câu lệnh conditional decrement nguyên tử.
     * Chỉ hoàn đúng quotaId và reservedPeriod; không giảm dưới 0 và không đụng counter period mới.
     */
    @Transactional
    public boolean refund(Integer quotaId, Instant reservedPeriod, Instant now) {
        if (quotaId == null || reservedPeriod == null || now == null) {
            return false;
        }

        int updated = userQuotaRepository.conditionalDecrement(quotaId, reservedPeriod, now);
        return updated == 1;
    }

    /**
     * Tiện ích hoàn trả quota sử dụng thời điểm hiện tại của Clock.
     */
    @Transactional
    public boolean refund(Integer quotaId, Instant reservedPeriod) {
        return refund(quotaId, reservedPeriod, clock.instant());
    }
}
