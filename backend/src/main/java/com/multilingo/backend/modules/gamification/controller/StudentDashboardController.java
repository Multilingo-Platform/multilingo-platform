package com.multilingo.backend.modules.gamification.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.modules.auth.security.CustomUserDetails;
import com.multilingo.backend.modules.gamification.dto.dashboard.StudentDashboardResponse;
import com.multilingo.backend.modules.gamification.service.StudentDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/student/dashboard")
@RequiredArgsConstructor
public class StudentDashboardController {

    private final StudentDashboardService studentDashboardService;

    @GetMapping
    public ResponseEntity<ApiResponse<StudentDashboardResponse>> getDashboard(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam(value = "timeRange", defaultValue = "THIS_WEEK") String timeRange,
            @RequestParam(value = "year", required = false) Integer year
    ) {
        Integer userId = userDetails.getUser().getId();
        StudentDashboardResponse response = studentDashboardService.getStudentDashboard(userId, timeRange, year);
        return ResponseEntity.ok(ApiResponse.success("Lấy dữ liệu bảng điều khiển thành công", response));
    }
}
