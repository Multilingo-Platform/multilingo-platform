package com.multilingo.backend.modules.analytics.service;

import com.multilingo.backend.modules.analytics.adapter.BillingTransactionAdapter;
import com.multilingo.backend.modules.analytics.adapter.ExamCatalogAdapter;
import com.multilingo.backend.modules.analytics.adapter.ExamTrackingAdapter;
import com.multilingo.backend.modules.analytics.adapter.GamificationTrackingAdapter;
import com.multilingo.backend.modules.analytics.adapter.UserAccountAdapter;
import com.multilingo.backend.modules.analytics.adapter.dto.ExamSummaryInfo;
import com.multilingo.backend.modules.analytics.dto.response.DashboardStatsResponse;
import com.multilingo.backend.modules.analytics.dto.response.ExamTrackingResponse;
import com.multilingo.backend.modules.analytics.dto.response.RevenueChartResponse;
import com.multilingo.backend.modules.analytics.service.impl.AnalyticsServiceImpl;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AnalyticsServiceTest {

    @Mock
    private UserAccountAdapter userAccountAdapter;

    @Mock
    private BillingTransactionAdapter billingTransactionAdapter;

    @Mock
    private ExamTrackingAdapter examTrackingAdapter;

    @Mock
    private ExamCatalogAdapter examCatalogAdapter;

    @Mock
    private GamificationTrackingAdapter gamificationTrackingAdapter;

    @InjectMocks
    private AnalyticsServiceImpl analyticsService;

    @Test
    @DisplayName("Should aggregate dashboard stats correctly through adapters")
    void testGetDashboardStats() {
        when(userAccountAdapter.countActiveUsersSince(any(Instant.class))).thenReturn(25L, 100L); // dau, mau
        when(userAccountAdapter.countTotalUsers()).thenReturn(200L);
        when(userAccountAdapter.countUsersByTier("VIP")).thenReturn(40L);
        when(billingTransactionAdapter.getTotalSuccessfulRevenue()).thenReturn(BigDecimal.valueOf(5000000));
        when(billingTransactionAdapter.getSuccessfulRevenueSince(any(Instant.class)))
                .thenReturn(BigDecimal.valueOf(1500000));
        when(examTrackingAdapter.countTotalAttempts()).thenReturn(150L);

        DashboardStatsResponse stats = analyticsService.getDashboardStats();

        assertThat(stats.getDau()).isEqualTo(25L);
        assertThat(stats.getMau()).isEqualTo(100L);
        assertThat(stats.getTotalUsers()).isEqualTo(200L);
        assertThat(stats.getVipUsers()).isEqualTo(40L);
        assertThat(stats.getVipConversionRate()).isEqualTo(20.0);
        assertThat(stats.getTotalRevenue()).isEqualByComparingTo(BigDecimal.valueOf(5000000));
        assertThat(stats.getMonthlyRevenue()).isEqualByComparingTo(BigDecimal.valueOf(1500000));
        assertThat(stats.getTotalExamsAttempted()).isEqualTo(150L);
    }

    @Test
    @DisplayName("Should generate revenue chart with 7 days through billing adapter")
    void testGetRevenueChart() {
        when(billingTransactionAdapter.findSuccessfulTransactionsBetween(any(Instant.class), any(Instant.class)))
                .thenReturn(Collections.emptyList());

        RevenueChartResponse chart = analyticsService.getRevenueChart("7d");

        assertThat(chart.getLabels()).hasSize(8); // from 7 days ago to today inclusive
        assertThat(chart.getData()).hasSize(8);
        assertThat(chart.getTotalPeriodRevenue()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("Should calculate exam completion rate and stats through exam and tracking adapters")
    void testGetExamTracking() {
        ExamSummaryInfo examInfo = ExamSummaryInfo.builder()
                .id(1)
                .title("TOEIC Practice Test 01")
                .code("TOEIC_01")
                .type("FULL")
                .isPublished(true)
                .build();

        when(examCatalogAdapter.findAllExams()).thenReturn(List.of(examInfo));
        when(examTrackingAdapter.countAttemptsByExamId(1)).thenReturn(10L);
        when(examTrackingAdapter.countCompletedAttemptsByExamId(1)).thenReturn(8L);
        when(examTrackingAdapter.findAverageScoreByExamId(1)).thenReturn(75.5);

        List<ExamTrackingResponse> tracking = analyticsService.getExamTracking();

        assertThat(tracking).hasSize(1);
        ExamTrackingResponse item = tracking.get(0);
        assertThat(item.getExamId()).isEqualTo(1);
        assertThat(item.getTotalAttempts()).isEqualTo(10L);
        assertThat(item.getCompletedAttempts()).isEqualTo(8L);
        assertThat(item.getCompletionRate()).isEqualTo(80.0);
        assertThat(item.getAverageScore()).isEqualTo(75.5);
    }
}
