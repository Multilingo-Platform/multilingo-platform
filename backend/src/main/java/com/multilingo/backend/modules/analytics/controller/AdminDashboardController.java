package com.multilingo.backend.modules.analytics.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.modules.analytics.dto.response.DashboardStatsResponse;
import com.multilingo.backend.modules.analytics.dto.response.RevenueChartResponse;
import com.multilingo.backend.modules.analytics.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/dashboard")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminDashboardController {

    private final AnalyticsService analyticsService;

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<DashboardStatsResponse>> getDashboardStats() {
        DashboardStatsResponse result = analyticsService.getDashboardStats();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/revenue-chart")
    public ResponseEntity<ApiResponse<RevenueChartResponse>> getRevenueChart(
            @RequestParam(defaultValue = "7d") String period
    ) {
        RevenueChartResponse result = analyticsService.getRevenueChart(period);
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
