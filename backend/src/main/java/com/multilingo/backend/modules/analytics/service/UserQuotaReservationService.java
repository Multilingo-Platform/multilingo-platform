package com.multilingo.backend.modules.analytics.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.analytics.entity.UserQuota;
import com.multilingo.backend.modules.analytics.repository.UserQuotaRepository;
import com.multilingo.backend.modules.auth.entity.SubscriptionTier;
import com.multilingo.backend.modules.auth.entity.User;
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
    private static final int DEFAULT_FREE_WRITING_LIMIT = 5;
    private static final int DEFAULT_VIP_WRITING_LIMIT = 20;

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

    public enum QuotaDenialReason {
        QUOTA_EXHAUSTED,
        QUOTA_CONFIGURATION_INVALID,
        QUOTA_RESERVATION_CONFLICT
    }

    public record QuotaReservationAttempt(QuotaReservation reservation, QuotaDenialReason denialReason) {
        public boolean granted() { return reservation != null; }
    }

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
     * Atomic quota admission for the two independent Writing features. Missing rows are provisioned
     * on first use; a valid expired period resets at the next Asia/Ho_Chi_Minh midnight.
     */
    @Transactional
    public QuotaReservationAttempt tryReserveDetailed(Integer userId, String featureCode) {
        if (userId == null) return denied(QuotaDenialReason.QUOTA_CONFIGURATION_INVALID);
        String effectiveFeatureCode = (featureCode != null && !featureCode.isBlank()) ? featureCode : FEATURE_CODE;
        Instant now = clock.instant();
        List<UserQuota> rows = userQuotaRepository.findAllByUserIdAndFeatureCodeForUpdate(userId, effectiveFeatureCode);

        if (isWritingFeature(effectiveFeatureCode)) {
            if (rows.isEmpty()) {
                LimitResolution limit = resolveWritingLimit(userId, effectiveFeatureCode, now);
                if (limit.denialReason() != null) return denied(limit.denialReason());
                userQuotaRepository.insertWritingQuotaIfAbsent(
                        userId, effectiveFeatureCode, limit.limit(), now, nextLocalMidnight(now));
                rows = userQuotaRepository.findAllByUserIdAndFeatureCodeForUpdate(userId, effectiveFeatureCode);
            }
            if (rows.size() == 1 && !validQuotaConfiguration(rows.getFirst())) {
                return denied(QuotaDenialReason.QUOTA_CONFIGURATION_INVALID);
            }
            if (rows.size() == 1 && !rows.getFirst().getResetDate().isAfter(now)) {
                LimitResolution limit = resolveWritingLimit(userId, effectiveFeatureCode, now);
                if (limit.denialReason() != null) return denied(limit.denialReason());
                UserQuota quota = rows.getFirst();
                quota.setUsedCount(0);
                quota.setResetDate(nextLocalMidnight(now));
                quota.setMaxLimit(limit.limit());
                userQuotaRepository.saveAndFlush(quota);
            }
        }

        if (rows.size() != 1) return denied(QuotaDenialReason.QUOTA_CONFIGURATION_INVALID);
        UserQuota quota = rows.getFirst();
        if (entityManager != null && entityManager.contains(quota)) entityManager.refresh(quota);
        if (!validQuotaConfiguration(quota) || !quota.getResetDate().isAfter(now)) {
            return denied(QuotaDenialReason.QUOTA_CONFIGURATION_INVALID);
        }
        if (quota.getMaxLimit() == 0 || quota.getUsedCount() >= quota.getMaxLimit()) {
            return denied(QuotaDenialReason.QUOTA_EXHAUSTED);
        }
        int updated = userQuotaRepository.conditionalIncrement(quota.getId(), quota.getResetDate(), now);
        if (updated != 1) return denied(QuotaDenialReason.QUOTA_RESERVATION_CONFLICT);
        return new QuotaReservationAttempt(new QuotaReservation(quota.getId(), quota.getResetDate()), null);
    }

    @Transactional
    public java.util.Optional<QuotaReservation> tryReserve(Integer userId, String featureCode) {
        return java.util.Optional.ofNullable(tryReserveDetailed(userId, featureCode).reservation());
    }

    private static boolean isWritingFeature(String featureCode) {
        return FEATURE_CODE.equals(featureCode) || GRADING_FEATURE_CODE.equals(featureCode);
    }

    private static boolean validQuotaConfiguration(UserQuota quota) {
        return quota != null && quota.getUsedCount() != null && quota.getUsedCount() >= 0
                && quota.getMaxLimit() != null && quota.getMaxLimit() >= 0 && quota.getResetDate() != null;
    }

    private QuotaReservationAttempt denied(QuotaDenialReason reason) {
        return new QuotaReservationAttempt(null, reason);
    }

    private LimitResolution resolveWritingLimit(Integer userId, String featureCode, Instant now) {
        int tierUserId;
        if (userRepository == null || userId == null || userId <= 0) {
            tierUserId = 0;
        } else {
            try {
                User user = userRepository.findById(userId).orElse(null);
                tierUserId = user != null && user.getSubscriptionTier() == SubscriptionTier.PREMIUM
                        && user.getPremiumExpiresAt() != null && user.getPremiumExpiresAt().isAfter(now) ? -1 : 0;
            } catch (Exception unavailable) {
                return new LimitResolution(null, QuotaDenialReason.QUOTA_CONFIGURATION_INVALID);
            }
        }

        List<UserQuota> planRows = userQuotaRepository.findAllByUserIdAndFeatureCodeForUpdate(tierUserId, featureCode);
        if (planRows.size() > 1) return new LimitResolution(null, QuotaDenialReason.QUOTA_CONFIGURATION_INVALID);
        if (planRows.size() == 1) {
            Integer configured = planRows.getFirst().getMaxLimit();
            if (configured == null || configured < 0) {
                return new LimitResolution(null, QuotaDenialReason.QUOTA_CONFIGURATION_INVALID);
            }
            return new LimitResolution(configured, null);
        }
        return new LimitResolution(tierUserId == -1 ? DEFAULT_VIP_WRITING_LIMIT : DEFAULT_FREE_WRITING_LIMIT, null);
    }

    private record LimitResolution(Integer limit, QuotaDenialReason denialReason) {}

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
