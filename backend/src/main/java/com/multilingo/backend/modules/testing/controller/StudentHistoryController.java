package com.multilingo.backend.modules.testing.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.auth.security.CustomUserDetails;
import com.multilingo.backend.modules.testing.dto.response.StudentHistoryItemResponse;
import com.multilingo.backend.modules.testing.dto.response.StudentHistoryStatsResponse;
import com.multilingo.backend.modules.testing.service.StudentHistoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/student/history")
@RequiredArgsConstructor
@Slf4j
public class StudentHistoryController {

    private final StudentHistoryService studentHistoryService;

    /**
     * Lấy thống kê tổng hợp và xu hướng điểm số của học viên hiện tại.
     */
    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<StudentHistoryStatsResponse>> getStats(
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Integer userId = userDetails.getUser().getId();
        StudentHistoryStatsResponse stats = studentHistoryService.getStudentStats(userId);
        return ResponseEntity.ok(ApiResponse.success(stats));
    }

    /**
     * Lấy danh sách lịch sử lượt thi của học viên (Phân trang, Lọc & Tìm kiếm).
     */
    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<StudentHistoryItemResponse>>> getHistory(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String cert,
            @RequestParam(required = false) String mode,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "newest") String sort
    ) {
        Integer userId = userDetails.getUser().getId();
        PageResponse<StudentHistoryItemResponse> history = studentHistoryService.getStudentHistory(
                userId, search, cert, mode, status, page, size, sort
        );
        return ResponseEntity.ok(ApiResponse.success(history));
    }
}
