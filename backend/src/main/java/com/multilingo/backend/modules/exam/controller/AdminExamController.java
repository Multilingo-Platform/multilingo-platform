package com.multilingo.backend.modules.exam.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import com.multilingo.backend.modules.exam.service.AdminExamService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.multilingo.backend.modules.exam.service.ExamParserService;

@RestController
@RequestMapping("/api/v1/admin/exams")
@RequiredArgsConstructor
public class AdminExamController {

    private final AdminExamService examService;
    private final ExamParserService examParserService;
    private final jakarta.validation.Validator validator;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'CONTENT_CREATOR')")
    public ResponseEntity<ApiResponse<Integer>> createExam(@Valid @RequestBody ExamBuilderRequest request) {
        Integer examId = examService.createExam(request);
        return ResponseEntity.ok(ApiResponse.success(examId));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CONTENT_CREATOR')")
    public ResponseEntity<ApiResponse<Void>> updateExam(
            @PathVariable Integer id,
            @Valid @RequestBody ExamBuilderRequest request) {
        examService.updateExam(id, request);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CONTENT_CREATOR')")
    public ResponseEntity<ApiResponse<Void>> deleteExam(@PathVariable Integer id) {
        examService.deleteExam(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/import")
    @PreAuthorize("hasAnyRole('ADMIN', 'CONTENT_CREATOR')")
    public ResponseEntity<ApiResponse<Integer>> importExam(@RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        ExamBuilderRequest request = examParserService.parseExamFile(file);
        
        java.util.Set<jakarta.validation.ConstraintViolation<ExamBuilderRequest>> violations = validator.validate(request);
        if (!violations.isEmpty()) {
            throw new com.multilingo.backend.common.exception.AppException(com.multilingo.backend.common.exception.ErrorCode.VALIDATION_FAILED);
        }

        Integer examId = examService.createExam(request);
        return ResponseEntity.ok(ApiResponse.success(examId));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'CONTENT_CREATOR')")
    public ResponseEntity<ApiResponse<java.util.List<com.multilingo.backend.modules.exam.dto.response.ExamSummaryResponse>>> getAllExams() {
        return ResponseEntity.ok(ApiResponse.success(examService.getAllExams()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CONTENT_CREATOR')")
    public ResponseEntity<ApiResponse<ExamBuilderRequest>> getExamDetail(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.success(examService.getExamDetail(id)));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'CONTENT_CREATOR')")
    public ResponseEntity<ApiResponse<Void>> updateExamStatus(
            @PathVariable Integer id,
            @RequestParam("isPublished") boolean isPublished) {
        examService.updateExamStatus(id, isPublished);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
