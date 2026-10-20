package com.multilingo.backend.modules.testing.exception;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;

public class DictionaryLookupRetryAfterException extends AppException {
    private final long retryAfterSeconds;

    public DictionaryLookupRetryAfterException(ErrorCode errorCode, long retryAfterSeconds) {
        super(errorCode);
        this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
    }

    public long getRetryAfterSeconds() { return retryAfterSeconds; }
}
