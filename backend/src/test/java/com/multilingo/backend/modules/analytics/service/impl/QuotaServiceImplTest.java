package com.multilingo.backend.modules.analytics.service.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.modules.analytics.repository.UserQuotaRepository;
import com.multilingo.backend.modules.analytics.service.AuditService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class QuotaServiceImplTest {
    @Mock UserQuotaRepository repository;
    @Mock AuditService auditService;
    @InjectMocks QuotaServiceImpl service;

    @Test
    void exposesIndependentWritingQuotasWithFiveAndTwentyDailyDefaults() {
        when(repository.findByUserIdAndFeatureCode(anyInt(), anyString())).thenReturn(Optional.empty());

        var quotas = service.getAllQuotas();

        assertThat(quotas).hasSize(6);
        assertThat(quotas).filteredOn(q -> q.getFeature().equals("AI_WRITING_HINTS") && q.getTier().equals("FREE"))
                .singleElement().extracting("dailyLimit").isEqualTo(5);
        assertThat(quotas).filteredOn(q -> q.getFeature().equals("AI_WRITING_HINTS") && q.getTier().equals("VIP"))
                .singleElement().extracting("dailyLimit").isEqualTo(20);
        assertThat(quotas).filteredOn(q -> q.getFeature().equals("AI_WRITING_GRADING") && q.getTier().equals("FREE"))
                .singleElement().extracting("dailyLimit").isEqualTo(5);
        assertThat(quotas).filteredOn(q -> q.getFeature().equals("AI_WRITING_GRADING") && q.getTier().equals("VIP"))
                .singleElement().extracting("dailyLimit").isEqualTo(20);
        assertThat(quotas).noneMatch(q -> q.getFeature().equals("WRITING_ASSISTANT"));
        assertThat(quotas).noneMatch(q -> q.getFeature().equals("CHAT_TUTOR"));
    }

    @Test
    void noLongerAcceptsLegacyWritingAssistantForNewQuotaConfiguration() {
        assertThatThrownBy(() -> service.updateQuota(1,
                com.multilingo.backend.modules.analytics.dto.request.UpdateQuotaRequest.builder()
                        .feature("WRITING_ASSISTANT").tier("FREE").dailyLimit(99).build(), "127.0.0.1"))
                .isInstanceOf(AppException.class);
        verifyNoInteractions(repository, auditService);
    }
}
