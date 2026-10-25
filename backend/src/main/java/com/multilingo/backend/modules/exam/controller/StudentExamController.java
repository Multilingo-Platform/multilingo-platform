package com.multilingo.backend.modules.exam.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.exam.dto.response.StudentExamSummaryResponse;
import com.multilingo.backend.modules.exam.service.StudentExamService;
import com.multilingo.backend.modules.auth.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/student/exams")
@RequiredArgsConstructor
public class StudentExamController {

    private final StudentExamService studentExamService;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<StudentExamSummaryResponse>>> getExams(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) List<String> types,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sort,
            @RequestParam(required = false) String examLanguage,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Integer userId = (userDetails != null && userDetails.getUser() != null) ? userDetails.getUser().getId() : null;
        PageResponse<StudentExamSummaryResponse> response = studentExamService.searchExams(search, types, page, size, sort, examLanguage, userId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
