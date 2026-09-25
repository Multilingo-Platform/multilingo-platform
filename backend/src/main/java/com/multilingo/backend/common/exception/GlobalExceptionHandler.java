package com.multilingo.backend.common.exception;

import com.multilingo.backend.common.dto.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiResponse<Void>> handleAppException(AppException ex) {
        ErrorCode errorCode = ex.getErrorCode();
        String message = ex.getMessage() != null ? ex.getMessage() : errorCode.getMessage();

        log.warn("Nghiệp vụ ném AppException: code={}, message={}", errorCode.getCode(), message);

        ApiResponse<Void> response = ApiResponse.error(errorCode.getCode(), message);
        return ResponseEntity.status(errorCode.getHttpStatus()).body(response);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationException(MethodArgumentNotValidException ex) {
        String details = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "));

        log.warn("Lỗi Validation đầu vào: {}", details);

        ErrorCode errorCode = ErrorCode.VALIDATION_FAILED;
        ApiResponse<Void> response = ApiResponse.error(errorCode.getCode(), details);
        return ResponseEntity.status(errorCode.getHttpStatus()).body(response);
    }

    @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoResourceFound(org.springframework.web.servlet.resource.NoResourceFoundException ex) {
        log.warn("Không tìm thấy tài nguyên: {}", ex.getResourcePath());
        ErrorCode errorCode = ErrorCode.RESOURCE_NOT_FOUND;
        ApiResponse<Void> response = ApiResponse.error(errorCode.getCode(), "Không tìm thấy endpoint hoặc tài nguyên: " + ex.getResourcePath());
        return ResponseEntity.status(errorCode.getHttpStatus()).body(response);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGenericException(Exception ex) {
        log.error("Lỗi không mong muốn phát sinh (Uncaught Exception): ", ex);

        ErrorCode errorCode = ErrorCode.UNCATEGORIZED_EXCEPTION;
        ApiResponse<Void> response = ApiResponse.error(errorCode.getCode(), errorCode.getMessage());
        return ResponseEntity.status(errorCode.getHttpStatus()).body(response);
    }
}
