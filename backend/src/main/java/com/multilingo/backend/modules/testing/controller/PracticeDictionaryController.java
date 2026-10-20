package com.multilingo.backend.modules.testing.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupRequest;
import com.multilingo.backend.modules.testing.dto.response.DictionaryLookupResponse;
import com.multilingo.backend.modules.testing.exception.DictionaryLookupRetryAfterException;
import com.multilingo.backend.modules.testing.service.PracticeDictionaryService;
import com.multilingo.backend.modules.testing.service.support.DictionaryLookupRequestValidator;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

@Slf4j
@RestController
@RequestMapping("/api/v1/attempts")
@RequiredArgsConstructor
public class PracticeDictionaryController {
    private final PracticeDictionaryService dictionaryService;
    private final DictionaryLookupRequestValidator requestValidator;

    @PostMapping("/{id}/dictionary-lookups")
    public ResponseEntity<ApiResponse<DictionaryLookupResponse>> lookup(
            @PathVariable String id, HttpServletRequest servletRequest) {
        Integer attemptId = requestValidator.parseAttemptId(id);
        DictionaryLookupRequest request;
        try {
            request = requestValidator.read(servletRequest.getInputStream());
        } catch (AppException e) {
            throw e;
        } catch (IOException e) {
            throw new AppException(ErrorCode.VALIDATION_FAILED);
        }
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(ApiResponse.success(dictionaryService.lookup(attemptId, request)));
    }

    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiResponse<Void>> handleAppException(AppException exception) {
        ErrorCode error = exception.getErrorCode();
        log.warn("Dictionary lookup failed: {}", error);
        var response = ResponseEntity.status(error.getHttpStatus()).header(HttpHeaders.CACHE_CONTROL, "no-store");
        if (exception instanceof DictionaryLookupRetryAfterException retry) {
            response.header(HttpHeaders.RETRY_AFTER, Long.toString(retry.getRetryAfterSeconds()));
        } else if (error == ErrorCode.DICTIONARY_LOOKUP_IN_PROGRESS) {
            response.header(HttpHeaders.RETRY_AFTER, "2");
        }
        return response.body(ApiResponse.error(error.getCode(), error.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception exception) {
        log.warn("Dictionary lookup failed with an unexpected server error");
        ErrorCode error = ErrorCode.UNCATEGORIZED_EXCEPTION;
        return ResponseEntity.status(error.getHttpStatus()).header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(ApiResponse.error(error.getCode(), error.getMessage()));
    }
}
