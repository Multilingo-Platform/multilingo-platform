package com.multilingo.backend.modules.analytics.service.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.analytics.dto.request.UpdateQuotaRequest;
import com.multilingo.backend.modules.analytics.dto.response.StudentQuotaResponse;
import com.multilingo.backend.modules.analytics.dto.response.UserQuotaResponse;
import com.multilingo.backend.modules.analytics.entity.UserQuota;
import com.multilingo.backend.modules.analytics.repository.UserQuotaRepository;
import com.multilingo.backend.modules.analytics.service.AuditService;
import com.multilingo.backend.modules.analytics.service.QuotaService;
import com.multilingo.backend.modules.auth.entity.SubscriptionTier;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

@Service
@Slf4j
public class QuotaServiceImpl implements QuotaService {

    private final UserQuotaRepository userQuotaRepository;
    private final AuditService auditService;
    private final UserRepository userRepository;
    private final Clock clock;

    private static final ZoneId DAILY_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private static final List<String> SUPPORTED_FEATURES = List.of(
            "AI_WRITING_HINTS",
            "AI_WRITING_GRADING",
            "DICTIONARY_LOOKUP"
    );

    private static final List<String> SUPPORTED_TIERS = List.of("FREE", "VIP");

    private static final Map<String, Integer> DEFAULT_FREE_LIMITS = Map.of(
            "AI_WRITING_HINTS", 5,
            "AI_WRITING_GRADING", 5,
            "DICTIONARY_LOOKUP", 20
    );

    private static final Map<String, Integer> DEFAULT_VIP_LIMITS = Map.of(
            "AI_WRITING_HINTS", 20,
            "AI_WRITING_GRADING", 20,
            "DICTIONARY_LOOKUP", 500
    );

    public QuotaServiceImpl(UserQuotaRepository userQuotaRepository, AuditService auditService) {
        this(userQuotaRepository, auditService, null, Clock.system(DAILY_ZONE));
    }

    @Autowired
    public QuotaServiceImpl(
            UserQuotaRepository userQuotaRepository,
            AuditService auditService,
            @Autowired(required = false) UserRepository userRepository,
            @Autowired(required = false) Clock clock
    ) {
        this.userQuotaRepository = userQuotaRepository;
        this.auditService = auditService;
        this.userRepository = userRepository;
        this.clock = clock != null ? clock : Clock.system(DAILY_ZONE);
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserQuotaResponse> getAllQuotas() {
        List<UserQuotaResponse> results = new ArrayList<>();

        for (String feature : SUPPORTED_FEATURES) {
            for (String tier : SUPPORTED_TIERS) {
                int tierUserId = getTierUserId(tier);
                Optional<UserQuota> opt = userQuotaRepository.findByUserIdAndFeatureCode(tierUserId, feature);

                if (opt.isPresent()) {
                    UserQuota q = opt.get();
                    results.add(UserQuotaResponse.builder()
                            .id(q.getId())
                            .feature(feature)
                            .tier(tier)
                            .dailyLimit(q.getMaxLimit())
                            .resetCycle("DAILY")
                            .updatedAt(q.getUpdatedAt() != null ? q.getUpdatedAt() : q.getCreatedAt())
                            .build());
                } else {
                    int defaultLimit = "VIP".equalsIgnoreCase(tier)
                            ? DEFAULT_VIP_LIMITS.getOrDefault(feature, 50)
                            : DEFAULT_FREE_LIMITS.getOrDefault(feature, 5);

                    results.add(UserQuotaResponse.builder()
                            .id(null)
                            .feature(feature)
                            .tier(tier)
                            .dailyLimit(defaultLimit)
                            .resetCycle("DAILY")
                            .updatedAt(null)
                            .build());
                }
            }
        }
        return results;
    }

    @Override
    @Transactional
    public UserQuotaResponse updateQuota(Integer currentAdminId, UpdateQuotaRequest request, String ipAddress) {
        String tier = request.getTier().trim().toUpperCase();
        String feature = request.getFeature().trim().toUpperCase();
        if (!SUPPORTED_TIERS.contains(tier) || !SUPPORTED_FEATURES.contains(feature)) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Unsupported quota feature or tier");
        }
        int tierUserId = getTierUserId(tier);

        UserQuota quota = userQuotaRepository.findByUserIdAndFeatureCode(tierUserId, feature)
                .orElseGet(() -> UserQuota.builder()
                        .userId(tierUserId)
                        .featureCode(feature)
                        .usedCount(0)
                        .resetDate(Instant.now())
                        .build());

        int oldLimit = quota.getMaxLimit() != null ? quota.getMaxLimit() : 0;
        quota.setMaxLimit(request.getDailyLimit());
        quota = userQuotaRepository.save(quota);

        // Audit Log thông qua AuditService
        Map<String, Object> details = new HashMap<>();
        details.put("feature", feature);
        details.put("tier", tier);
        details.put("oldLimit", oldLimit);
        details.put("newLimit", request.getDailyLimit());
        details.put("resetCycle", request.getResetCycle());

        auditService.log(currentAdminId, "UPDATE_QUOTA", "USER_QUOTA", feature + ":" + tier, details, ipAddress);

        return UserQuotaResponse.builder()
                .id(quota.getId())
                .feature(feature)
                .tier(tier)
                .dailyLimit(quota.getMaxLimit())
                .resetCycle(request.getResetCycle())
                .updatedAt(quota.getUpdatedAt() != null ? quota.getUpdatedAt() : Instant.now())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<StudentQuotaResponse> getMyQuotas(Integer userId) {
        Instant now = clock.instant();
        boolean isVip = false;
        if (userRepository != null && userId != null && userId > 0) {
            User user = userRepository.findById(userId).orElse(null);
            if (user != null && user.getSubscriptionTier() == SubscriptionTier.PREMIUM
                    && user.getPremiumExpiresAt() != null && user.getPremiumExpiresAt().isAfter(now)) {
                isVip = true;
            }
        }

        String tier = isVip ? "VIP" : "FREE";
        int tierUserId = isVip ? -1 : 0;
        Instant resetAt = nextLocalMidnight(now);

        List<StudentQuotaResponse> responses = new ArrayList<>();
        List<String> studentFeatures = List.of(
                "AI_WRITING_HINTS",
                "AI_WRITING_GRADING",
                "DICTIONARY_LOOKUP"
        );

        Map<String, String> featureNames = Map.of(
                "AI_WRITING_HINTS", "Gợi ý Writing AI",
                "AI_WRITING_GRADING", "AI chấm bài Writing",
                "DICTIONARY_LOOKUP", "Tra cứu từ điển AI"
        );

        for (String feature : studentFeatures) {
            int defaultLimit = isVip
                    ? DEFAULT_VIP_LIMITS.getOrDefault(feature, 20)
                    : DEFAULT_FREE_LIMITS.getOrDefault(feature, 5);

            // Kiểm tra template hạn mức đã được admin cấu hình chưa
            Optional<UserQuota> templateOpt = userQuotaRepository.findByUserIdAndFeatureCode(tierUserId, feature);
            int effectiveLimit = templateOpt.map(UserQuota::getMaxLimit).filter(l -> l != null && l >= 0).orElse(defaultLimit);

            // Kiểm tra dòng quota thực tế của người dùng
            int usedCount = 0;
            Instant userResetDate = resetAt;

            if (userId != null && userId > 0) {
                Optional<UserQuota> userQuotaOpt = userQuotaRepository.findByUserIdAndFeatureCode(userId, feature);
                if (userQuotaOpt.isPresent()) {
                    UserQuota q = userQuotaOpt.get();
                    if (q.getResetDate() != null && q.getResetDate().isAfter(now)) {
                        usedCount = q.getUsedCount() != null ? q.getUsedCount() : 0;
                        userResetDate = q.getResetDate();
                        if (q.getMaxLimit() != null && q.getMaxLimit() > 0) {
                            effectiveLimit = q.getMaxLimit();
                        }
                    }
                }
            }

            int remaining = Math.max(0, effectiveLimit - usedCount);

            responses.add(StudentQuotaResponse.builder()
                    .featureCode(feature)
                    .featureName(featureNames.getOrDefault(feature, feature))
                    .usedCount(usedCount)
                    .maxLimit(effectiveLimit)
                    .remaining(remaining)
                    .tier(tier)
                    .resetDate(userResetDate)
                    .build());
        }

        return responses;
    }

    private static Instant nextLocalMidnight(Instant now) {
        LocalDate localDate = now.atZone(DAILY_ZONE).toLocalDate();
        return localDate.plusDays(1).atStartOfDay(DAILY_ZONE).toInstant();
    }

    private int getTierUserId(String tier) {
        return "VIP".equalsIgnoreCase(tier) ? -1 : 0;
    }
}
