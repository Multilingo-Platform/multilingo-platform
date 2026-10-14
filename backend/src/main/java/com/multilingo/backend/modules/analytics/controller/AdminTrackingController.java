package com.multilingo.backend.modules.analytics.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.analytics.dto.response.ExamTrackingResponse;
import com.multilingo.backend.modules.analytics.dto.response.UserTrackingResponse;
import com.multilingo.backend.modules.analytics.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/tracking")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminTrackingController {

    private final AnalyticsService analyticsService;

    @GetMapping("/users")
    public ResponseEntity<ApiResponse<PageResponse<UserTrackingResponse>>> getUserTracking(
            @RequestParam(required = false) String keyword,
            @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        PageResponse<UserTrackingResponse> result = analyticsService.getUserTracking(keyword, pageable);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/exams")
    public ResponseEntity<ApiResponse<List<ExamTrackingResponse>>> getExamTracking() {
        List<ExamTrackingResponse> result = analyticsService.getExamTracking();
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
