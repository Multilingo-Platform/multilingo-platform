package com.multilingo.backend.modules.analytics.service.impl;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.analytics.adapter.BillingTransactionAdapter;
import com.multilingo.backend.modules.analytics.adapter.ExamCatalogAdapter;
import com.multilingo.backend.modules.analytics.adapter.ExamTrackingAdapter;
import com.multilingo.backend.modules.analytics.adapter.GamificationTrackingAdapter;
import com.multilingo.backend.modules.analytics.adapter.UserAccountAdapter;
import com.multilingo.backend.modules.analytics.adapter.dto.ExamSummaryInfo;
import com.multilingo.backend.modules.analytics.adapter.dto.TransactionInfo;
import com.multilingo.backend.modules.analytics.adapter.dto.UserAccountInfo;
import com.multilingo.backend.modules.analytics.adapter.dto.UserStudyStatInfo;
import com.multilingo.backend.modules.analytics.dto.response.DashboardStatsResponse;
import com.multilingo.backend.modules.analytics.dto.response.ExamTrackingResponse;
import com.multilingo.backend.modules.analytics.dto.response.RevenueChartResponse;
import com.multilingo.backend.modules.analytics.dto.response.UserTrackingResponse;
import com.multilingo.backend.modules.analytics.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AnalyticsServiceImpl implements AnalyticsService {

    private final UserAccountAdapter userAccountAdapter;
    private final BillingTransactionAdapter billingTransactionAdapter;
    private final ExamTrackingAdapter examTrackingAdapter;
    private final ExamCatalogAdapter examCatalogAdapter;
    private final GamificationTrackingAdapter gamificationTrackingAdapter;

    @Override
    @Transactional(readOnly = true)
    public DashboardStatsResponse getDashboardStats() {
        Instant now = Instant.now();
        Instant oneDayAgo = now.minus(1, ChronoUnit.DAYS);
        Instant thirtyDaysAgo = now.minus(30, ChronoUnit.DAYS);

        long dau = userAccountAdapter.countActiveUsersSince(oneDayAgo);
        long mau = userAccountAdapter.countActiveUsersSince(thirtyDaysAgo);
        long totalUsers = userAccountAdapter.countTotalUsers();
        long vipUsers = userAccountAdapter.countUsersByTier("VIP");

        double vipConversionRate = totalUsers > 0
                ? Math.round(((double) vipUsers / totalUsers) * 1000.0) / 10.0
                : 0.0;

        BigDecimal totalRevenue = billingTransactionAdapter.getTotalSuccessfulRevenue();
        BigDecimal monthlyRevenue = billingTransactionAdapter.getSuccessfulRevenueSince(thirtyDaysAgo);

        long totalAttempts = examTrackingAdapter.countTotalAttempts();

        return DashboardStatsResponse.builder()
                .dau(dau)
                .mau(mau)
                .totalUsers(totalUsers)
                .vipUsers(vipUsers)
                .vipConversionRate(vipConversionRate)
                .totalRevenue(totalRevenue)
                .monthlyRevenue(monthlyRevenue)
                .totalExamsAttempted(totalAttempts)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public RevenueChartResponse getRevenueChart(String period) {
        int days = 7;
        if ("30d".equalsIgnoreCase(period)) {
            days = 30;
        }

        Instant now = Instant.now();
        Instant from = now.minus(days, ChronoUnit.DAYS);

        List<TransactionInfo> transactions = billingTransactionAdapter.findSuccessfulTransactionsBetween(from, now);

        DateTimeFormatter dtf = DateTimeFormatter.ofPattern("dd/MM");
        ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");

        // Bucket by day
        Map<LocalDate, BigDecimal> dailySums = new HashMap<>();
        for (TransactionInfo t : transactions) {
            LocalDate date = t.getCreatedAt().atZone(zone).toLocalDate();
            dailySums.merge(date, t.getAmount(), BigDecimal::add);
        }

        List<String> labels = new ArrayList<>();
        List<BigDecimal> data = new ArrayList<>();
        BigDecimal totalPeriodRevenue = BigDecimal.ZERO;

        LocalDate startDate = from.atZone(zone).toLocalDate();
        LocalDate endDate = now.atZone(zone).toLocalDate();

        LocalDate cur = startDate;
        while (!cur.isAfter(endDate)) {
            labels.add(cur.format(dtf));
            BigDecimal amount = dailySums.getOrDefault(cur, BigDecimal.ZERO);
            data.add(amount);
            totalPeriodRevenue = totalPeriodRevenue.add(amount);
            cur = cur.plusDays(1);
        }

        return RevenueChartResponse.builder()
                .labels(labels)
                .data(data)
                .totalPeriodRevenue(totalPeriodRevenue)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<UserTrackingResponse> getUserTracking(String keyword, Pageable pageable) {
        PageResponse<UserAccountInfo> userPage = userAccountAdapter.findUsers(keyword, null, null, pageable);

        List<UserTrackingResponse> items = userPage.getItems().stream().map(user -> {
            long attempts = examTrackingAdapter.countAttemptsByUserId(user.getId());
            Double avgScore = examTrackingAdapter.findAverageScoreByUserId(user.getId());

            Optional<UserStudyStatInfo> statOpt = gamificationTrackingAdapter.findStudyStatByUserId(user.getId());
            Integer learningMinutes = statOpt.map(UserStudyStatInfo::getTotalLearningMinutes).orElse(0);

            return UserTrackingResponse.builder()
                    .userId(user.getId())
                    .email(user.getEmail())
                    .fullName(user.getFullName())
                    .subscriptionTier(user.getSubscriptionTier())
                    .totalAttempts(attempts)
                    .averageScore(avgScore != null ? Math.round(avgScore * 10.0) / 10.0 : null)
                    .totalLearningMinutes(learningMinutes)
                    .lastLoginIp(user.getLastLoginIp())
                    .lastLoginAt(user.getLastLoginAt())
                    .build();
        }).collect(Collectors.toList());

        return PageResponse.<UserTrackingResponse>builder()
                .items(items)
                .page(userPage.getPage())
                .size(userPage.getSize())
                .totalElements(userPage.getTotalElements())
                .totalPages(userPage.getTotalPages())
                .last(userPage.isLast())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ExamTrackingResponse> getExamTracking() {
        List<ExamSummaryInfo> exams = examCatalogAdapter.findAllExams();

        return exams.stream().map(exam -> {
            long totalAttempts = examTrackingAdapter.countAttemptsByExamId(exam.getId());
            long completedAttempts = examTrackingAdapter.countCompletedAttemptsByExamId(exam.getId());
            Double avgScore = examTrackingAdapter.findAverageScoreByExamId(exam.getId());

            double completionRate = totalAttempts > 0
                    ? Math.round(((double) completedAttempts / totalAttempts) * 1000.0) / 10.0
                    : 0.0;

            return ExamTrackingResponse.builder()
                    .examId(exam.getId())
                    .title(exam.getTitle())
                    .code(exam.getCode())
                    .totalAttempts(totalAttempts)
                    .completedAttempts(completedAttempts)
                    .completionRate(completionRate)
                    .averageScore(avgScore != null ? Math.round(avgScore * 10.0) / 10.0 : null)
                    .build();
        }).collect(Collectors.toList());
    }
}
