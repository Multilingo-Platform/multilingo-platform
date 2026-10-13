package com.multilingo.backend.modules.analytics.service.impl;

import com.multilingo.backend.modules.analytics.dto.request.UpdateQuotaRequest;
import com.multilingo.backend.modules.analytics.dto.response.UserQuotaResponse;
import com.multilingo.backend.modules.analytics.entity.UserQuota;
import com.multilingo.backend.modules.analytics.repository.UserQuotaRepository;
import com.multilingo.backend.modules.analytics.service.AuditService;
import com.multilingo.backend.modules.analytics.service.QuotaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class QuotaServiceImpl implements QuotaService {

    private final UserQuotaRepository userQuotaRepository;
    private final AuditService auditService;

    private static final List<String> SUPPORTED_FEATURES = List.of(
            "WRITING_ASSISTANT",
            "DICTIONARY_LOOKUP",
            "CHAT_TUTOR"
    );

    private static final List<String> SUPPORTED_TIERS = List.of("FREE", "VIP");

    private static final Map<String, Integer> DEFAULT_FREE_LIMITS = Map.of(
            "WRITING_ASSISTANT", 5,
            "DICTIONARY_LOOKUP", 20,
            "CHAT_TUTOR", 3
    );

    private static final Map<String, Integer> DEFAULT_VIP_LIMITS = Map.of(
            "WRITING_ASSISTANT", 100,
            "DICTIONARY_LOOKUP", 500,
            "CHAT_TUTOR", 50
    );

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

    private int getTierUserId(String tier) {
        return "VIP".equalsIgnoreCase(tier) ? -1 : 0;
    }
}
