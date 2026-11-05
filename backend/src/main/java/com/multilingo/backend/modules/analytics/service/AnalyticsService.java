package com.multilingo.backend.modules.analytics.service;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.analytics.dto.response.DashboardStatsResponse;
import com.multilingo.backend.modules.analytics.dto.response.ExamTrackingResponse;
import com.multilingo.backend.modules.analytics.dto.response.RevenueChartResponse;
import com.multilingo.backend.modules.analytics.dto.response.UserTrackingResponse;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface AnalyticsService {

    DashboardStatsResponse getDashboardStats();

    RevenueChartResponse getRevenueChart(String period);

    PageResponse<UserTrackingResponse> getUserTracking(String keyword, Pageable pageable);

    List<ExamTrackingResponse> getExamTracking();

    com.multilingo.backend.modules.analytics.dto.response.UserExamTrackingDetailResponse getUserExamTrackingDetail(Integer userId);

    com.multilingo.backend.modules.analytics.dto.response.ExamTrackingDetailResponse getExamTrackingDetail(Integer examId);
}
