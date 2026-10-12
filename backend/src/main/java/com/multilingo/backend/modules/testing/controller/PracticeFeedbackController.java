package com.multilingo.backend.modules.testing.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.dto.request.PracticeFeedbackRequest;
import com.multilingo.backend.modules.testing.dto.response.PracticeFeedbackResponse;
import com.multilingo.backend.modules.testing.service.PracticeFeedbackService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;

/**
 * Controller for instant practice feedback.
 * Authenticated learners can evaluate a single objective question attempt in real time.
 */
@RestController
@RequestMapping("/api/v1/attempts")
@RequiredArgsConstructor
public class PracticeFeedbackController {

    private final PracticeFeedbackService practiceFeedbackService;

    /**
     * POST /api/v1/attempts/{id}/practice-feedback
     *
     * @param id      Path variable representing attempt ID (validated strictly)
     * @param request Request payload containing partId, questionId, answer
     * @return 200 OK with PracticeFeedbackResponse and Cache-Control: no-store
     */
    @PostMapping("/{id}/practice-feedback")
    public ResponseEntity<ApiResponse<PracticeFeedbackResponse>> getPracticeFeedback(
            @PathVariable String id,
            @RequestBody(required = false) PracticeFeedbackRequest request) {

        Integer attemptId = parseAttemptId(id);
        PracticeFeedbackResponse feedback = practiceFeedbackService.getFeedback(attemptId, request);

        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(ApiResponse.success(feedback));
    }

    /**
     * Parses attempt ID strictly: standard decimal from 1 to 2147483647 without leading zero,
     * suffix, exponent, or whitespace.
     */
    private Integer parseAttemptId(String idStr) {
        if (idStr == null || idStr.isBlank() || !idStr.matches("^[1-9][0-9]{0,9}$")) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Yêu cầu không hợp lệ");
        }
        try {
            long val = Long.parseLong(idStr);
            if (val > Integer.MAX_VALUE) {
                throw new AppException(ErrorCode.INVALID_REQUEST, "Yêu cầu không hợp lệ");
            }
            return (int) val;
        } catch (NumberFormatException e) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Yêu cầu không hợp lệ");
        }
    }

    /**
     * Controller-local exception handler for business exceptions.
     * Returns fixed message, Cache-Control: no-store, and does not leak sensitive payload or request values.
     */
    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiResponse<Void>> handleAppException(AppException ex) {
        ErrorCode errorCode = ex.getErrorCode();
        return ResponseEntity.status(errorCode.getHttpStatus())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(ApiResponse.error(errorCode.getCode(), errorCode.getMessage()));
    }

    /**
     * Controller-local exception handler for malformed/unreadable HTTP messages.
     * Returns 400 INVALID_REQUEST, Cache-Control: no-store, and does NOT log or echo the request body.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleHttpMessageNotReadable(HttpMessageNotReadableException ex) {
        ErrorCode errorCode = ErrorCode.INVALID_REQUEST;
        return ResponseEntity.status(errorCode.getHttpStatus())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(ApiResponse.error(errorCode.getCode(), errorCode.getMessage()));
    }
}
