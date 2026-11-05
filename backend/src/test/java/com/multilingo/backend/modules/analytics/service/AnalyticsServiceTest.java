package com.multilingo.backend.modules.analytics.service;

import com.multilingo.backend.modules.analytics.adapter.BillingTransactionAdapter;
import com.multilingo.backend.modules.analytics.adapter.ExamCatalogAdapter;
import com.multilingo.backend.modules.analytics.adapter.ExamTrackingAdapter;
import com.multilingo.backend.modules.analytics.adapter.GamificationTrackingAdapter;
import com.multilingo.backend.modules.analytics.adapter.UserAccountAdapter;
import com.multilingo.backend.modules.analytics.adapter.dto.ExamSummaryInfo;
import com.multilingo.backend.modules.analytics.adapter.dto.UserAccountInfo;
import com.multilingo.backend.modules.analytics.dto.response.DashboardStatsResponse;
import com.multilingo.backend.modules.analytics.dto.response.ExamTrackingDetailResponse;
import com.multilingo.backend.modules.analytics.dto.response.ExamTrackingResponse;
import com.multilingo.backend.modules.analytics.dto.response.RevenueChartResponse;
import com.multilingo.backend.modules.analytics.dto.response.UserExamTrackingDetailResponse;
import com.multilingo.backend.modules.analytics.service.impl.AnalyticsServiceImpl;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

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
        when(examTrackingAdapter.countAttemptsByStatus()).thenReturn(Map.of("COMPLETED", 120L, "IN_PROGRESS", 30L));

        DashboardStatsResponse stats = analyticsService.getDashboardStats();

        assertThat(stats.getDau()).isEqualTo(25L);
        assertThat(stats.getMau()).isEqualTo(100L);
        assertThat(stats.getTotalUsers()).isEqualTo(200L);
        assertThat(stats.getVipUsers()).isEqualTo(40L);
        assertThat(stats.getVipConversionRate()).isEqualTo(20.0);
        assertThat(stats.getTotalRevenue()).isEqualByComparingTo(BigDecimal.valueOf(5000000));
        assertThat(stats.getMonthlyRevenue()).isEqualByComparingTo(BigDecimal.valueOf(1500000));
        assertThat(stats.getTotalExamsAttempted()).isEqualTo(150L);
        assertThat(stats.getAttemptsByStatus()).containsEntry("COMPLETED", 120L).containsEntry("IN_PROGRESS", 30L);
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

    @Test
    @DisplayName("Should return user exam tracking detail correctly")
    void testGetUserExamTrackingDetail() {
        UserAccountInfo user = UserAccountInfo.builder()
                .id(10)
                .fullName("Nguyen Van A")
                .email("a@test.com")
                .subscriptionTier("VIP")
                .build();

        Exam exam = Exam.builder()
                .code("IELTS-T1")
                .title("IELTS Academic Test 1")
                .type("IELTS")
                .build();
        exam.setId(100);

        TestAttempt attempt = TestAttempt.builder()
                .userId(10)
                .examId(100)
                .testMode(TestMode.MOCK_TEST)
                .testScope(TestScope.FULL_EXAM)
                .status(AttemptStatus.COMPLETED)
                .startTime(Instant.now().minusSeconds(3600))
                .endTime(Instant.now())
                .timeSpentSeconds(3500)
                .overallScore(BigDecimal.valueOf(7.5))
                .scoreUnit("Band")
                .build();
        attempt.setId(501);

        when(userAccountAdapter.findUserById(10)).thenReturn(Optional.of(user));
        List<Object[]> rows = new ArrayList<>();
        rows.add(new Object[]{attempt, exam});
        when(examTrackingAdapter.findValidAttemptsWithExamByUserId(10)).thenReturn(rows);
        when(examTrackingAdapter.findAverageScoreByUserId(10)).thenReturn(7.5);

        UserExamTrackingDetailResponse response = analyticsService.getUserExamTrackingDetail(10);

        assertThat(response).isNotNull();
        assertThat(response.getUserId()).isEqualTo(10);
        assertThat(response.getFullName()).isEqualTo("Nguyen Van A");
        assertThat(response.getSubscriptionTier()).isEqualTo("VIP");
        assertThat(response.getTotalExamsAttempted()).isEqualTo(1L);
        assertThat(response.getAverageScore()).isEqualTo(7.5);
        assertThat(response.getExamSummaries()).hasSize(1);
        assertThat(response.getExamSummaries().get(0).getExamCode()).isEqualTo("IELTS-T1");
        assertThat(response.getExamSummaries().get(0).getHighestScore()).isEqualTo(7.5);
        assertThat(response.getAttempts()).hasSize(1);
        assertThat(response.getAttempts().get(0).getAttemptId()).isEqualTo(501);
    }

    @Test
    @DisplayName("Should return exam tracking detail with student attempts and calculated attempt numbers")
    void testGetExamTrackingDetail() {
        ExamSummaryInfo examInfo = ExamSummaryInfo.builder()
                .id(200)
                .code("TOEIC-2024")
                .title("TOEIC Full Test 2024")
                .type("TOEIC")
                .durationMinutes(120)
                .build();

        TestAttempt attempt1 = TestAttempt.builder()
                .userId(11)
                .examId(200)
                .testMode(TestMode.MOCK_TEST)
                .status(AttemptStatus.COMPLETED)
                .startTime(Instant.now().minusSeconds(7200))
                .endTime(Instant.now().minusSeconds(3600))
                .timeSpentSeconds(3600)
                .overallScore(BigDecimal.valueOf(800))
                .scoreUnit("Điểm")
                .build();
        attempt1.setId(601);

        TestAttempt attempt2 = TestAttempt.builder()
                .userId(11)
                .examId(200)
                .testMode(TestMode.MOCK_TEST)
                .status(AttemptStatus.COMPLETED)
                .startTime(Instant.now().minusSeconds(1800))
                .endTime(Instant.now())
                .timeSpentSeconds(1800)
                .overallScore(BigDecimal.valueOf(880))
                .scoreUnit("Điểm")
                .build();
        attempt2.setId(602);

        UserAccountInfo userInfo = UserAccountInfo.builder()
                .id(11)
                .fullName("Tran Van B")
                .email("b@test.com")
                .subscriptionTier("VIP")
                .build();

        when(examCatalogAdapter.findExamById(200)).thenReturn(Optional.of(examInfo));
        when(examTrackingAdapter.findAttemptsByExamId(200)).thenReturn(List.of(attempt1, attempt2));
        when(userAccountAdapter.findUsersByIds(Set.of(11))).thenReturn(Map.of(11, userInfo));
        when(examTrackingAdapter.findAverageScoreByExamId(200)).thenReturn(840.0);

        ExamTrackingDetailResponse response = analyticsService.getExamTrackingDetail(200);

        assertThat(response).isNotNull();
        assertThat(response.getExamId()).isEqualTo(200);
        assertThat(response.getCode()).isEqualTo("TOEIC-2024");
        assertThat(response.getDurationMinutes()).isEqualTo(120);
        assertThat(response.getTotalAttempts()).isEqualTo(2L);
        assertThat(response.getCompletedAttempts()).isEqualTo(2L);
        assertThat(response.getCompletionRate()).isEqualTo(100.0);
        assertThat(response.getAverageScore()).isEqualTo(840.0);
        assertThat(response.getAttempts()).hasSize(2);

        // Check chronological attempt numbering (attempt1 was earlier -> attemptNumber 1; attempt2 -> attemptNumber 2)
        assertThat(response.getAttempts().get(0).getAttemptNumber()).isEqualTo(1);
        assertThat(response.getAttempts().get(1).getAttemptNumber()).isEqualTo(2);
    }
}
