package com.multilingo.backend.modules.testing.exception;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import lombok.Getter;

/**
 * Ngoại lệ ném ra khi yêu cầu gợi ý viết bị rate limit hoặc đang trong tiến trình xử lý,
 * mang theo thông tin số giây cần chờ Retry-After trước khi thử lại.
 */
@Getter
public class WritingHintsRetryAfterException extends AppException {

    private final Long retryAfterSeconds;

    public WritingHintsRetryAfterException(ErrorCode errorCode, String message, Long retryAfterSeconds) {
        super(errorCode, message);
        this.retryAfterSeconds = retryAfterSeconds;
    }
}
