package com.multilingo.backend.modules.billing.service;

import com.multilingo.backend.modules.billing.dto.response.SubscriptionPlanResponse;
import com.multilingo.backend.modules.billing.entity.SubscriptionPlan;
import com.multilingo.backend.modules.billing.mapper.SubscriptionPlanMapper;
import com.multilingo.backend.modules.billing.repository.SubscriptionPlanRepository;
import com.multilingo.backend.modules.billing.service.impl.SubscriptionPlanServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SubscriptionPlanServiceTest {

    @Mock
    private SubscriptionPlanRepository planRepository;

    @Mock
    private SubscriptionPlanMapper planMapper;

    @InjectMocks
    private SubscriptionPlanServiceImpl planService;

    private SubscriptionPlan activePlan;
    private SubscriptionPlanResponse activePlanResponse;

    @BeforeEach
    void setUp() {
        activePlan = SubscriptionPlan.builder()
                .code("PRO_1M")
                .name("Gói 1 Tháng")
                .price(new BigDecimal("99000"))
                .durationDays(30)
                .isActive(true)
                .build();

        activePlanResponse = SubscriptionPlanResponse.builder()
                .code("PRO_1M")
                .name("Gói 1 Tháng")
                .price(new BigDecimal("99000"))
                .durationDays(30)
                .isActive(true)
                .build();
    }

    @Test
    void getActivePlans_shouldReturnOnlyActivePlans() {
        when(planRepository.findByIsActiveTrue()).thenReturn(List.of(activePlan));
        when(planMapper.toResponse(activePlan)).thenReturn(activePlanResponse);

        List<SubscriptionPlanResponse> result = planService.getActivePlans();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getCode()).isEqualTo("PRO_1M");
        assertThat(result.get(0).getIsActive()).isTrue();

        verify(planRepository, times(1)).findByIsActiveTrue();
        verify(planRepository, never()).findAll();
    }
}
