package com.multilingo.backend.modules.testing.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupV3Request;
import com.multilingo.backend.modules.testing.dto.response.DictionaryLookupV3Response;
import com.multilingo.backend.modules.testing.exception.DictionaryLookupRetryAfterException;
import com.multilingo.backend.modules.testing.service.PracticeDictionaryV3Service;
import com.multilingo.backend.modules.testing.service.support.DictionaryLookupV3RequestValidator;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;

@Slf4j
@RestController
@RequestMapping("/api/v3/attempts")
@RequiredArgsConstructor
public class PracticeDictionaryV3Controller {
    private final PracticeDictionaryV3Service service;
    private final DictionaryLookupV3RequestValidator validator;

    @PostMapping("/{id}/dictionary-lookups")
    public ResponseEntity<ApiResponse<DictionaryLookupV3Response>> lookup(
            @PathVariable String id, HttpServletRequest request) {
        Integer attemptId = validator.parseAttemptId(id);
        DictionaryLookupV3Request body;
        try {
            body = validator.read(request.getInputStream());
        } catch (AppException e) {
            throw e;
        } catch (IOException e) {
            throw new AppException(ErrorCode.VALIDATION_FAILED);
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(ApiResponse.success(service.lookup(attemptId, body)));
    }

    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiResponse<Void>> appError(AppException exception) {
        ErrorCode error = exception.getErrorCode();
        log.warn("Dictionary lookup v3 failed: {}", error);
        var response = ResponseEntity.status(error.getHttpStatus()).header(HttpHeaders.CACHE_CONTROL, "no-store");
        if (exception instanceof DictionaryLookupRetryAfterException retry) {
            response.header(HttpHeaders.RETRY_AFTER, Long.toString(retry.getRetryAfterSeconds()));
        } else if (error == ErrorCode.DICTIONARY_LOOKUP_IN_PROGRESS) {
            response.header(HttpHeaders.RETRY_AFTER, "2");
        }
        return response.body(ApiResponse.error(error.getCode(), error.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> unexpected(Exception ignored) {
        ErrorCode error = ErrorCode.UNCATEGORIZED_EXCEPTION;
        log.warn("Dictionary lookup v3 failed with an unexpected server error");
        return ResponseEntity.status(error.getHttpStatus()).header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(ApiResponse.error(error.getCode(), error.getMessage()));
    }
}
