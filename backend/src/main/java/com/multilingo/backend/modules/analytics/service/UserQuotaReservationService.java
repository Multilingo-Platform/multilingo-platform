package com.multilingo.backend.modules.analytics.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.analytics.entity.UserQuota;
import com.multilingo.backend.modules.analytics.repository.UserQuotaRepository;
import com.multilingo.backend.modules.auth.entity.SubscriptionTier;
import com.multilingo.backend.modules.auth.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/**
 * Service quản lý đặt trước (reservation) và hoàn trả (refund) hạn mức người dùng (UserQuota).
 * Tất cả các phương thức chạy trong transaction hiện hành (không dùng REQUIRES_NEW).
 */
@Service
public class UserQuotaReservationService {

    public static final String FEATURE_CODE = "AI_WRITING_HINTS";
    public static final String GRADING_FEATURE_CODE = "AI_WRITING_GRADING";
    public static final String DAILY_ZONE_ID = "Asia/Ho_Chi_Minh";
    private static final ZoneId DAILY_ZONE = ZoneId.of(DAILY_ZONE_ID);
    private static final int DEFAULT_FREE_HINTS_LIMIT = 5;
    private static final int DEFAULT_VIP_HINTS_LIMIT = 20;

    private final UserQuotaRepository userQuotaRepository;
    private final Clock clock;
    private final UserRepository userRepository;

    @PersistenceContext
    private EntityManager entityManager;

    @Autowired
    public UserQuotaReservationService(
            UserQuotaRepository userQuotaRepository,
            Clock clock,
            @Autowired(required = false) EntityManager entityManager,
            @Autowired(required = false) UserRepository userRepository
    ) {
        this.userQuotaRepository = userQuotaRepository;
        this.clock = clock;
        this.entityManager = entityManager;
        this.userRepository = userRepository;
    }

    public UserQuotaReservationService(UserQuotaRepository userQuotaRepository, Clock clock) {
        this(userQuotaRepository, clock, null, null);
    }

    public UserQuotaReservationService(UserQuotaRepository userQuotaRepository, Clock clock, EntityManager entityManager) {
        this(userQuotaRepository, clock, entityManager, null);
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
     * Khóa dòng quota của người dùng theo feature code và kiểm tra tính hợp lệ.
     */
    @Transactional
    public QuotaAccount lockAccount(Integer userId, String featureCode) {
        if (userId == null) {
            throw new AppException(ErrorCode.QUOTA_EXCEEDED, "User ID is required for quota reservation");
        }
        String effectiveFeatureCode = (featureCode != null && !featureCode.isBlank()) ? featureCode : FEATURE_CODE;

        List<UserQuota> rows = userQuotaRepository.findAllByUserIdAndFeatureCodeForUpdate(userId, effectiveFeatureCode);

        if (rows.isEmpty()) {
            throw new AppException(ErrorCode.QUOTA_EXCEEDED, "No quota provisioned for feature: " + effectiveFeatureCode);
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

    @Transactional
    public QuotaAccount lockAccount(Integer userId) {
        return lockAccount(userId, FEATURE_CODE);
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
     */
    @Transactional
    public void lockUserQuota(Integer userId, String featureCode) {
        if (userId != null) {
            String effectiveFeatureCode = (featureCode != null && !featureCode.isBlank()) ? featureCode : FEATURE_CODE;
            List<UserQuota> rows = userQuotaRepository.findAllByUserIdAndFeatureCodeForUpdate(userId, effectiveFeatureCode);
            if (entityManager != null) {
                for (UserQuota q : rows) {
                    if (entityManager.contains(q)) {
                        entityManager.refresh(q);
                    }
                }
            }
        }
    }

    @Transactional
    public void lockUserQuota(Integer userId) {
        lockUserQuota(userId, FEATURE_CODE);
    }

    /**
     * Cố gắng đặt trước quota bằng conditional update theo feature code.
     * Đối với AI_WRITING_HINTS: tự động cấp quota mặc định nếu chưa có và reset hàng ngày khi bước sang ngày mới.
     */
    @Transactional
    public java.util.Optional<QuotaReservation> tryReserve(Integer userId, String featureCode) {
        if (userId == null) {
            return java.util.Optional.empty();
        }
        String effectiveFeatureCode = (featureCode != null && !featureCode.isBlank()) ? featureCode : FEATURE_CODE;
        Instant now = clock.instant();

        List<UserQuota> rows = userQuotaRepository.findAllByUserIdAndFeatureCodeForUpdate(userId, effectiveFeatureCode);

        if (FEATURE_CODE.equals(effectiveFeatureCode)) {
            if (rows.isEmpty()) {
                int limit = resolveWritingHintsLimit(userId, now);
                Instant resetAt = nextLocalMidnight(now);
                userQuotaRepository.insertWritingHintsQuotaIfAbsent(userId, limit, now, resetAt);
                rows = userQuotaRepository.findAllByUserIdAndFeatureCodeForUpdate(userId, effectiveFeatureCode);
            } else if (rows.size() == 1) {
                UserQuota q = rows.getFirst();
                if (q.getResetDate() != null && !q.getResetDate().isAfter(now)) {
                    int limit = resolveWritingHintsLimit(userId, now);
                    Instant resetAt = nextLocalMidnight(now);
                    q.setUsedCount(0);
                    q.setResetDate(resetAt);
                    q.setMaxLimit(limit);
                    userQuotaRepository.saveAndFlush(q);
                }
            }
        }

        if (rows.size() != 1) {
            return java.util.Optional.empty();
        }
        UserQuota quota = rows.getFirst();
        if (entityManager != null && entityManager.contains(quota)) {
            entityManager.refresh(quota);
        }
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

    private int resolveWritingHintsLimit(Integer userId, Instant now) {
        if (userRepository == null || userId == null || userId <= 0) {
            return DEFAULT_FREE_HINTS_LIMIT;
        }
        try {
            return userRepository.findById(userId)
                    .map(u -> (u.getSubscriptionTier() == SubscriptionTier.PREMIUM
                            && u.getPremiumExpiresAt() != null
                            && u.getPremiumExpiresAt().isAfter(now))
                            ? DEFAULT_VIP_HINTS_LIMIT
                            : DEFAULT_FREE_HINTS_LIMIT)
                    .orElse(DEFAULT_FREE_HINTS_LIMIT);
        } catch (Exception e) {
            return DEFAULT_FREE_HINTS_LIMIT;
        }
    }

    private static Instant nextLocalMidnight(Instant now) {
        LocalDate localDate = now.atZone(DAILY_ZONE).toLocalDate();
        return localDate.plusDays(1).atStartOfDay(DAILY_ZONE).toInstant();
    }

    @Transactional
    public java.util.Optional<QuotaReservation> tryReserve(Integer userId) {
        return tryReserve(userId, FEATURE_CODE);
    }

    @Transactional
    public QuotaReservation reserve(Integer userId, String featureCode) {
        return tryReserve(userId, featureCode).orElseThrow(() -> new AppException(ErrorCode.QUOTA_EXCEEDED, "Quota limit reached or unavailable"));
    }

    @Transactional
    public QuotaReservation reserve(Integer userId) {
        return reserve(userId, FEATURE_CODE);
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
