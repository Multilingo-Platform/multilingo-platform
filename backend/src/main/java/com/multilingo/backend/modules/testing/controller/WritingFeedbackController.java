package com.multilingo.backend.modules.testing.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.dto.response.WritingFeedbackResponse;
import com.multilingo.backend.modules.testing.service.WritingFeedbackService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Controller cung cấp API lấy kết quả chấm bài thi Writing tự động.
 * Endpoint: GET /api/v1/attempts/{attemptId}/writing-feedback?partId={partId}
 * Bảo đảm:
 *   - Chỉ chủ sở hữu bài làm mới có quyền truy cập (missing hoặc non-owner -> 403).
 *   - Bài thi còn IN_PROGRESS -> 400 (không lazy-finalize).
 *   - partId sai/thiếu -> 400; partId ngoài snapshot hoặc không có ESSAY -> 404.
 *   - Cache-Control: no-store luôn được trả về.
 */
@RestController
@RequestMapping("/api/v1/attempts")
@RequiredArgsConstructor
public class WritingFeedbackController {

    private final WritingFeedbackService writingFeedbackService;

    @GetMapping("/{attemptId}/writing-feedback")
    public ResponseEntity<ApiResponse<WritingFeedbackResponse>> getWritingFeedback(
            @PathVariable String attemptId,
            @RequestParam(name = "partId", required = false) String partId
    ) {
        Integer parsedAttemptId = parsePositiveId(attemptId, "attemptId");
        Integer parsedPartId = parsePositiveId(partId, "partId");

        WritingFeedbackResponse response = writingFeedbackService.getWritingFeedback(parsedAttemptId, parsedPartId);

        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(ApiResponse.success(response));
    }

    private Integer parsePositiveId(String raw, String fieldName) {
        if (raw == null || raw.isBlank()) {
            throw new AppException(ErrorCode.INVALID_REQUEST, fieldName + " must not be blank");
        }
        try {
            int val = Integer.parseInt(raw.trim());
            if (val <= 0) {
                throw new AppException(ErrorCode.INVALID_REQUEST, fieldName + " must be a positive integer");
            }
            return val;
        } catch (NumberFormatException e) {
            throw new AppException(ErrorCode.INVALID_REQUEST, fieldName + " must be an integer");
        }
    }
}
