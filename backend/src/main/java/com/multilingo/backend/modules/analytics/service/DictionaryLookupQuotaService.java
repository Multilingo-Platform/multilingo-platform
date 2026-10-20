package com.multilingo.backend.modules.analytics.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.analytics.entity.UserQuota;
import com.multilingo.backend.modules.analytics.repository.UserQuotaRepository;
import com.multilingo.backend.modules.auth.entity.SubscriptionTier;
import com.multilingo.backend.modules.auth.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

/** Provisions and reserves the daily DICTIONARY_LOOKUP quota without resetting usage on plan changes. */
@Service
public class DictionaryLookupQuotaService {
    public static final String FEATURE_CODE = "DICTIONARY_LOOKUP";
    public static final String DAILY_ZONE_ID = "Asia/Ho_Chi_Minh";
    private static final ZoneId DAILY_ZONE = ZoneId.of(DAILY_ZONE_ID);
    private static final int FREE_TEMPLATE_USER_ID = 0;
    private static final int VIP_TEMPLATE_USER_ID = -1;
    private static final int DEFAULT_FREE_LIMIT = 20;
    private static final int DEFAULT_VIP_LIMIT = 500;

    private final UserQuotaRepository quotaRepository;
    private final UserRepository userRepository;
    private final UserQuotaReservationService reservationService;
    private final Clock clock;

    public DictionaryLookupQuotaService(UserQuotaRepository quotaRepository, UserRepository userRepository,
                                       UserQuotaReservationService reservationService, Clock clock) {
        this.quotaRepository = quotaRepository;
        this.userRepository = userRepository;
        this.reservationService = reservationService;
        this.clock = clock;
    }

    @Transactional
    public UserQuota prepareDailyQuota(Integer userId) {
        if (userId == null || userId <= 0) throw quotaUnavailable();
        var user = userRepository.findById(userId).orElseThrow(DictionaryLookupQuotaService::quotaUnavailable);
        Instant now = clock.instant();
        boolean premium = user.getSubscriptionTier() == SubscriptionTier.PREMIUM
                && user.getPremiumExpiresAt() != null && user.getPremiumExpiresAt().isAfter(now);
        int templateUserId = premium ? VIP_TEMPLATE_USER_ID : FREE_TEMPLATE_USER_ID;
        int fallback = premium ? DEFAULT_VIP_LIMIT : DEFAULT_FREE_LIMIT;
        int limit = readTemplateLimit(templateUserId, fallback);
        Instant resetAt = nextLocalMidnight(now);

        quotaRepository.insertDictionaryLookupQuotaIfAbsent(userId, limit, now, resetAt);
        List<UserQuota> rows = quotaRepository.findAllByUserIdAndFeatureCodeForUpdate(userId, FEATURE_CODE);
        if (rows.size() != 1) throw quotaUnavailable();
        UserQuota quota = rows.getFirst();
        if (quota.getUsedCount() == null || quota.getUsedCount() < 0 || quota.getResetDate() == null) throw quotaUnavailable();
        if (!quota.getResetDate().isAfter(now)) {
            quota.setUsedCount(0);
            quota.setResetDate(resetAt);
        }
        quota.setMaxLimit(limit);
        return quotaRepository.saveAndFlush(quota);
    }

    @Transactional
    public UserQuotaReservationService.QuotaReservation reserveDailyQuota(Integer userId) {
        prepareDailyQuota(userId);
        return reservePrepared(userId);
    }

    /** Called after prepareDailyQuota in the same outer transaction when a ledger replay check must occur first. */
    @Transactional
    public UserQuotaReservationService.QuotaReservation reservePrepared(Integer userId) {
        Optional<UserQuotaReservationService.QuotaReservation> reservation =
                reservationService.tryReserve(userId, FEATURE_CODE);
        return reservation.orElseThrow(() -> new AppException(ErrorCode.QUOTA_EXCEEDED,
                "Dictionary lookup quota is unavailable or has been exhausted"));
    }

    @Transactional
    public boolean refund(Integer quotaId, Instant reservedResetDate) {
        return reservationService.refund(quotaId, reservedResetDate, clock.instant());
    }

    private int readTemplateLimit(Integer templateUserId, int fallback) {
        List<UserQuota> templates = quotaRepository.findAllByUserIdAndFeatureCodeForUpdate(templateUserId, FEATURE_CODE);
        if (templates.isEmpty()) return fallback;
        if (templates.size() != 1) throw quotaUnavailable();
        Integer maxLimit = templates.getFirst().getMaxLimit();
        if (maxLimit == null || maxLimit < 1) throw quotaUnavailable();
        return maxLimit;
    }

    private static Instant nextLocalMidnight(Instant now) {
        LocalDate localDate = now.atZone(DAILY_ZONE).toLocalDate();
        return localDate.plusDays(1).atStartOfDay(DAILY_ZONE).toInstant();
    }

    private static AppException quotaUnavailable() {
        return new AppException(ErrorCode.QUOTA_EXCEEDED, "Dictionary lookup quota is unavailable");
    }
}
