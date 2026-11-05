package com.multilingo.backend.modules.analytics.service;

import com.multilingo.backend.modules.analytics.dto.response.StudentQuotaResponse;
import com.multilingo.backend.modules.analytics.entity.UserQuota;
import com.multilingo.backend.modules.analytics.repository.UserQuotaRepository;
import com.multilingo.backend.modules.analytics.service.impl.QuotaServiceImpl;
import com.multilingo.backend.modules.auth.entity.SubscriptionTier;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class QuotaServiceMyQuotasTest {

    @Mock
    private UserQuotaRepository userQuotaRepository;

    @Mock
    private AuditService auditService;

    @Mock
    private UserRepository userRepository;

    private Clock clock;
    private QuotaServiceImpl quotaService;

    private static final Instant FIXED_NOW = Instant.parse("2026-11-05T10:00:00Z");

    @BeforeEach
    void setUp() {
        clock = Clock.fixed(FIXED_NOW, ZoneId.of("Asia/Ho_Chi_Minh"));
        quotaService = new QuotaServiceImpl(userQuotaRepository, auditService, userRepository, clock);
    }

    @Test
    void returnsDefaultFreeQuotasWhenUserHasNoQuotaRows() {
        User freeUser = User.builder()
                .subscriptionTier(SubscriptionTier.FREE)
                .build();
        freeUser.setId(100);

        when(userRepository.findById(100)).thenReturn(Optional.of(freeUser));
        when(userQuotaRepository.findByUserIdAndFeatureCode(anyInt(), anyString())).thenReturn(Optional.empty());

        List<StudentQuotaResponse> result = quotaService.getMyQuotas(100);

        assertThat(result).hasSize(3);

        StudentQuotaResponse hints = result.stream()
                .filter(q -> "AI_WRITING_HINTS".equals(q.getFeatureCode()))
                .findFirst().orElseThrow();
        assertThat(hints.getUsedCount()).isEqualTo(0);
        assertThat(hints.getMaxLimit()).isEqualTo(5);
        assertThat(hints.getRemaining()).isEqualTo(5);
        assertThat(hints.getTier()).isEqualTo("FREE");

        StudentQuotaResponse grading = result.stream()
                .filter(q -> "AI_WRITING_GRADING".equals(q.getFeatureCode()))
                .findFirst().orElseThrow();
        assertThat(grading.getUsedCount()).isEqualTo(0);
        assertThat(grading.getMaxLimit()).isEqualTo(5);
        assertThat(grading.getRemaining()).isEqualTo(5);

        StudentQuotaResponse dict = result.stream()
                .filter(q -> "DICTIONARY_LOOKUP".equals(q.getFeatureCode()))
                .findFirst().orElseThrow();
        assertThat(dict.getUsedCount()).isEqualTo(0);
        assertThat(dict.getMaxLimit()).isEqualTo(20);
        assertThat(dict.getRemaining()).isEqualTo(20);
    }

    @Test
    void returnsUserSpecificUsageWhenRowExistsAndNotExpired() {
        User freeUser = User.builder()
                .subscriptionTier(SubscriptionTier.FREE)
                .build();
        freeUser.setId(101);

        UserQuota hintsQuota = UserQuota.builder()
                .userId(101)
                .featureCode("AI_WRITING_HINTS")
                .usedCount(3)
                .maxLimit(5)
                .resetDate(FIXED_NOW.plusSeconds(3600))
                .build();

        when(userRepository.findById(101)).thenReturn(Optional.of(freeUser));
        when(userQuotaRepository.findByUserIdAndFeatureCode(101, "AI_WRITING_HINTS"))
                .thenReturn(Optional.of(hintsQuota));
        when(userQuotaRepository.findByUserIdAndFeatureCode(101, "AI_WRITING_GRADING"))
                .thenReturn(Optional.empty());
        when(userQuotaRepository.findByUserIdAndFeatureCode(101, "DICTIONARY_LOOKUP"))
                .thenReturn(Optional.empty());

        List<StudentQuotaResponse> result = quotaService.getMyQuotas(101);

        StudentQuotaResponse hints = result.stream()
                .filter(q -> "AI_WRITING_HINTS".equals(q.getFeatureCode()))
                .findFirst().orElseThrow();
        assertThat(hints.getUsedCount()).isEqualTo(3);
        assertThat(hints.getMaxLimit()).isEqualTo(5);
        assertThat(hints.getRemaining()).isEqualTo(2);
    }

    @Test
    void resetsUsageWhenRowIsExpired() {
        User freeUser = User.builder()
                .subscriptionTier(SubscriptionTier.FREE)
                .build();
        freeUser.setId(102);

        UserQuota expiredQuota = UserQuota.builder()
                .userId(102)
                .featureCode("AI_WRITING_HINTS")
                .usedCount(5)
                .maxLimit(5)
                .resetDate(FIXED_NOW.minusSeconds(3600))
                .build();

        when(userRepository.findById(102)).thenReturn(Optional.of(freeUser));
        when(userQuotaRepository.findByUserIdAndFeatureCode(102, "AI_WRITING_HINTS"))
                .thenReturn(Optional.of(expiredQuota));

        List<StudentQuotaResponse> result = quotaService.getMyQuotas(102);

        StudentQuotaResponse hints = result.stream()
                .filter(q -> "AI_WRITING_HINTS".equals(q.getFeatureCode()))
                .findFirst().orElseThrow();
        assertThat(hints.getUsedCount()).isEqualTo(0);
        assertThat(hints.getRemaining()).isEqualTo(5);
    }

    @Test
    void returnsVipTierLimitsWhenUserIsPremium() {
        User vipUser = User.builder()
                .subscriptionTier(SubscriptionTier.PREMIUM)
                .premiumExpiresAt(FIXED_NOW.plusSeconds(86400 * 30))
                .build();
        vipUser.setId(200);

        when(userRepository.findById(200)).thenReturn(Optional.of(vipUser));
        when(userQuotaRepository.findByUserIdAndFeatureCode(anyInt(), anyString())).thenReturn(Optional.empty());

        List<StudentQuotaResponse> result = quotaService.getMyQuotas(200);

        StudentQuotaResponse hints = result.stream()
                .filter(q -> "AI_WRITING_HINTS".equals(q.getFeatureCode()))
                .findFirst().orElseThrow();
        assertThat(hints.getMaxLimit()).isEqualTo(20);
        assertThat(hints.getTier()).isEqualTo("VIP");

        StudentQuotaResponse dict = result.stream()
                .filter(q -> "DICTIONARY_LOOKUP".equals(q.getFeatureCode()))
                .findFirst().orElseThrow();
        assertThat(dict.getMaxLimit()).isEqualTo(500);
    }

    @Test
    void clampsRemainingToZeroWhenUsedExceedsLimit() {
        User freeUser = User.builder()
                .subscriptionTier(SubscriptionTier.FREE)
                .build();
        freeUser.setId(103);

        UserQuota overQuota = UserQuota.builder()
                .userId(103)
                .featureCode("AI_WRITING_HINTS")
                .usedCount(7)
                .maxLimit(5)
                .resetDate(FIXED_NOW.plusSeconds(3600))
                .build();

        when(userRepository.findById(103)).thenReturn(Optional.of(freeUser));
        when(userQuotaRepository.findByUserIdAndFeatureCode(103, "AI_WRITING_HINTS"))
                .thenReturn(Optional.of(overQuota));

        List<StudentQuotaResponse> result = quotaService.getMyQuotas(103);

        StudentQuotaResponse hints = result.stream()
                .filter(q -> "AI_WRITING_HINTS".equals(q.getFeatureCode()))
                .findFirst().orElseThrow();
        assertThat(hints.getUsedCount()).isEqualTo(7);
        assertThat(hints.getRemaining()).isEqualTo(0);
    }
}

