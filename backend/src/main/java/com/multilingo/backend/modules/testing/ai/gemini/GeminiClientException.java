package com.multilingo.backend.modules.testing.ai.gemini;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import lombok.Getter;

import java.util.Objects;

/**
 * Safe exception thrown by the internal Gemini client.
 * Does not expose raw causal exceptions, request payloads, or un-sanitized upstream bodies.
 */
@Getter
public class GeminiClientException extends AppException {

    public enum Kind {
        DISABLED(false),
        INVALID_INPUT(false),
        AUTHENTICATION(false),
        PROVIDER_REQUEST_REJECTED(false),
        RATE_LIMITED(true),
        TIMEOUT(true),
        TRANSPORT(true),
        UPSTREAM(true),
        INTERRUPTED(false),
        REDIRECT_REJECTED(false),
        BLOCKED(false),
        INCOMPLETE(false),
        INVALID_RESPONSE(false),
        RESPONSE_TOO_LARGE(false);

        private final boolean retryable;

        Kind(boolean retryable) {
            this.retryable = retryable;
        }

        public boolean isRetryable() {
            return retryable;
        }
    }

    private final Kind kind;
    private final boolean retryable;
    private final Integer upstreamStatus;

    public GeminiClientException(Kind kind, String safeMessage) {
        this(kind, safeMessage, null);
    }

    public GeminiClientException(Kind kind, String safeMessage, Integer upstreamStatus) {
        super(ErrorCode.UNCATEGORIZED_EXCEPTION, safeMessage);
        this.kind = Objects.requireNonNull(kind, "kind must not be null");
        this.retryable = kind.isRetryable();
        this.upstreamStatus = upstreamStatus;
    }

    @Override
    public String toString() {
        return "GeminiClientException{" +
                "kind=" + kind +
                ", retryable=" + retryable +
                ", upstreamStatus=" + upstreamStatus +
                ", message='" + getMessage() + '\'' +
                '}';
    }
}
