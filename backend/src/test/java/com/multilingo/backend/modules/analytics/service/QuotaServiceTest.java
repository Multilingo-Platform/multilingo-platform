package com.multilingo.backend.modules.analytics.service;

import com.multilingo.backend.modules.analytics.dto.request.UpdateQuotaRequest;
import com.multilingo.backend.modules.analytics.dto.response.UserQuotaResponse;
import com.multilingo.backend.modules.analytics.entity.UserQuota;
import com.multilingo.backend.modules.analytics.repository.UserQuotaRepository;
import com.multilingo.backend.modules.analytics.service.AuditService;
import com.multilingo.backend.modules.analytics.service.impl.QuotaServiceImpl;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class QuotaServiceTest {

    @Mock
    private UserQuotaRepository userQuotaRepository;

    @Mock
    private AuditService auditService;

    @InjectMocks
    private QuotaServiceImpl quotaService;

    @Test
    @DisplayName("Should return all predefined quotas with defaults if not configured")
    void testGetAllQuotas_withDefaults() {
        when(userQuotaRepository.findByUserIdAndFeatureCode(anyInt(), anyString())).thenReturn(Optional.empty());

        List<UserQuotaResponse> quotas = quotaService.getAllQuotas();

        assertThat(quotas).hasSize(6); // 3 features * 2 tiers
        assertThat(quotas).anyMatch(q -> q.getFeature().equals("WRITING_ASSISTANT") && q.getTier().equals("FREE") && q.getDailyLimit() == 5);
        assertThat(quotas).anyMatch(q -> q.getFeature().equals("WRITING_ASSISTANT") && q.getTier().equals("VIP") && q.getDailyLimit() == 100);
    }

    @Test
    @DisplayName("Should update existing quota and record audit log via AuditService")
    void testUpdateQuota_success() {
        UserQuota existing = UserQuota.builder()
                .userId(0)
                .featureCode("WRITING_ASSISTANT")
                .usedCount(0)
                .maxLimit(5)
                .resetDate(Instant.now())
                .build();
        existing.setId(101);

        when(userQuotaRepository.findByUserIdAndFeatureCode(0, "WRITING_ASSISTANT")).thenReturn(Optional.of(existing));
        when(userQuotaRepository.save(any(UserQuota.class))).thenAnswer(i -> i.getArgument(0));

        UpdateQuotaRequest request = UpdateQuotaRequest.builder()
                .feature("WRITING_ASSISTANT")
                .tier("FREE")
                .dailyLimit(15)
                .resetCycle("DAILY")
                .build();

        UserQuotaResponse response = quotaService.updateQuota(1, request, "127.0.0.1");

        assertThat(response.getDailyLimit()).isEqualTo(15);
        assertThat(response.getTier()).isEqualTo("FREE");

        ArgumentCaptor<Map<String, Object>> detailsCaptor = ArgumentCaptor.forClass(Map.class);
        verify(auditService).log(eq(1), eq("UPDATE_QUOTA"), eq("USER_QUOTA"), eq("WRITING_ASSISTANT:FREE"), detailsCaptor.capture(), eq("127.0.0.1"));
        Map<String, Object> details = detailsCaptor.getValue();
        assertThat(details).containsEntry("oldLimit", 5);
        assertThat(details).containsEntry("newLimit", 15);
    }
}
