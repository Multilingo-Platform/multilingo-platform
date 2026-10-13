package com.multilingo.backend.modules.testing.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.dto.request.WritingHintsRequest;
import com.multilingo.backend.modules.testing.dto.response.WritingHintsResponse;
import com.multilingo.backend.modules.testing.exception.WritingHintsRetryAfterException;
import com.multilingo.backend.modules.testing.service.WritingHintsService;
import com.multilingo.backend.modules.testing.service.support.WritingHintsRequestValidator;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;

/**
 * Controller an toàn cung cấp API gợi ý viết (Writing hints) cho bài thi Practice Writing.
 * - Yêu cầu xác thực người dùng sở hữu bài làm.
 * - Giới hạn kích thước payload tối đa 16 KiB qua bounded stream reader.
 * - Trả về Cache-Control: no-store cho mọi phản hồi thành công và lỗi.
 * - Trả về header Retry-After cho trường hợp đang xử lý (409) hoặc cooldown (429).
 * - Exception handlers cục bộ trả thông điệp an toàn cố định, tuyệt đối không log body, prompt hoặc sentinels.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/attempts")
@RequiredArgsConstructor
public class WritingHintsController {

    private final WritingHintsService writingHintsService;
    private final WritingHintsRequestValidator requestValidator;

    /**
     * POST /api/v1/attempts/{id}/writing-hints
     *
     * @param id                 Chuỗi attempt ID từ path variable (xác thực số nguyên dương nghiêm ngặt)
     * @param httpServletRequest HttpServletRequest để đọc luồng body có giới hạn 16 KiB
     * @return ResponseEntity ApiResponse WritingHintsResponse với Cache-Control: no-store
     */
    @PostMapping("/{id}/writing-hints")
    public ResponseEntity<ApiResponse<WritingHintsResponse>> generateWritingHints(
            @PathVariable String id,
            HttpServletRequest httpServletRequest) {

        Integer attemptId = requestValidator.parseAttemptId(id);

        WritingHintsRequest hintsRequest;
        try {
            hintsRequest = requestValidator.read(httpServletRequest.getInputStream());
        } catch (AppException e) {
            throw e;
        } catch (IOException e) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "Không thể đọc dữ liệu yêu cầu");
        }

        WritingHintsResponse response = writingHintsService.generate(attemptId, hintsRequest);

        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(ApiResponse.success(response));
    }

    /**
     * Bộ xử lý ngoại lệ nghiệp vụ cục bộ.
     * Trả về mã HTTP, mã lỗi hệ thống và thông điệp cố định an toàn từ ErrorCode.
     * Bổ sung header Retry-After nếu yêu cầu đang xử lý hoặc bị rate limit.
     */
    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiResponse<Void>> handleAppException(AppException ex) {
        ErrorCode errorCode = ex.getErrorCode();
        // An toàn quyền riêng tư: chỉ ghi log mã lỗi, không in ex.getMessage() hay body chứa dữ liệu thô
        log.warn("Writing hints request failed with error code: {}", errorCode);

        var builder = ResponseEntity.status(errorCode.getHttpStatus())
                .header(HttpHeaders.CACHE_CONTROL, "no-store");

        if (ex instanceof WritingHintsRetryAfterException retryEx && retryEx.getRetryAfterSeconds() != null) {
            builder.header(HttpHeaders.RETRY_AFTER, String.valueOf(retryEx.getRetryAfterSeconds()));
        } else if (errorCode == ErrorCode.WRITING_HINTS_IN_PROGRESS || errorCode == ErrorCode.WRITING_HINTS_RATE_LIMITED) {
            builder.header(HttpHeaders.RETRY_AFTER, "10");
        }

        return builder.body(ApiResponse.error(errorCode.getCode(), errorCode.getMessage()));
    }

    /**
     * Bộ xử lý ngoại lệ khi request body không thể phân tích cú pháp.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleHttpMessageNotReadable(HttpMessageNotReadableException ex) {
        log.warn("Writing hints request unreadable payload");
        ErrorCode errorCode = ErrorCode.VALIDATION_FAILED;
        return ResponseEntity.status(errorCode.getHttpStatus())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(ApiResponse.error(errorCode.getCode(), errorCode.getMessage()));
    }

    /**
     * Bộ xử lý ngoại lệ chung không xác định.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGenericException(Exception ex) {
        log.warn("Writing hints uncategorized exception occurred");
        ErrorCode errorCode = ErrorCode.UNCATEGORIZED_EXCEPTION;
        return ResponseEntity.status(errorCode.getHttpStatus())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(ApiResponse.error(errorCode.getCode(), errorCode.getMessage()));
    }
}
