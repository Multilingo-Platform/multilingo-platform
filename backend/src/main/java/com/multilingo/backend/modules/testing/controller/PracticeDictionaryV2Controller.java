package com.multilingo.backend.modules.testing.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupV2Request;
import com.multilingo.backend.modules.testing.dto.response.DictionaryLookupV2Response;
import com.multilingo.backend.modules.testing.exception.DictionaryLookupRetryAfterException;
import com.multilingo.backend.modules.testing.service.PracticeDictionaryV2Service;
import com.multilingo.backend.modules.testing.service.support.DictionaryLookupV2RequestValidator;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;

@Slf4j
@RestController
@RequestMapping("/api/v2/attempts")
@RequiredArgsConstructor
public class PracticeDictionaryV2Controller {
    private final PracticeDictionaryV2Service service;
    private final DictionaryLookupV2RequestValidator validator;

    @PostMapping("/{id}/dictionary-lookups")
    public ResponseEntity<ApiResponse<DictionaryLookupV2Response>> lookup(@PathVariable String id, HttpServletRequest request) {
        Integer attemptId = validator.parseAttemptId(id);
        DictionaryLookupV2Request body;
        try { body = validator.read(request.getInputStream()); }
        catch (AppException e) { throw e; }
        catch (IOException e) { throw new AppException(ErrorCode.VALIDATION_FAILED); }
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(ApiResponse.success(service.lookup(attemptId, body)));
    }

    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiResponse<Void>> appError(AppException exception) {
        ErrorCode error = exception.getErrorCode();
        log.warn("Dictionary lookup v2 failed: {}", error);
        var response = ResponseEntity.status(error.getHttpStatus()).header(HttpHeaders.CACHE_CONTROL, "no-store");
        if (exception instanceof DictionaryLookupRetryAfterException retry) response.header(HttpHeaders.RETRY_AFTER, Long.toString(retry.getRetryAfterSeconds()));
        else if (error == ErrorCode.DICTIONARY_LOOKUP_IN_PROGRESS) response.header(HttpHeaders.RETRY_AFTER, "2");
        return response.body(ApiResponse.error(error.getCode(), error.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> unexpected(Exception ignored) {
        ErrorCode error = ErrorCode.UNCATEGORIZED_EXCEPTION;
        log.warn("Dictionary lookup v2 failed with an unexpected server error");
        return ResponseEntity.status(error.getHttpStatus()).header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(ApiResponse.error(error.getCode(), error.getMessage()));
    }
}
