package com.multilingo.backend.modules.testing.ai.media;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;

/** Only fixed application-owned messages; never keep upstream exceptions or URLs. */
public final class ImageFetchException extends AppException {
    public enum Kind {
        DISABLED, INVALID_URL, HOST_NOT_ALLOWED, ADDRESS_REJECTED, REDIRECT_REJECTED,
        UPSTREAM_NOT_FOUND, UPSTREAM_REJECTED, RATE_LIMITED, UPSTREAM, TIMEOUT,
        TRANSPORT, INTERRUPTED, TOO_LARGE, UNSUPPORTED_TYPE, INVALID_CONTENT
    }
    private final Kind kind;
    private final Integer upstreamStatus;

    public ImageFetchException(Kind kind) { this(kind, null); }
    public ImageFetchException(Kind kind, Integer upstreamStatus) {
        super(ErrorCode.UNCATEGORIZED_EXCEPTION, "Image fetch failed: " + java.util.Objects.requireNonNull(kind));
        this.kind = kind;
        this.upstreamStatus = upstreamStatus;
    }
    public Kind getKind() { return kind; }
    public Integer getUpstreamStatus() { return upstreamStatus; }
    public boolean isRetryable() {
        return kind == Kind.RATE_LIMITED || kind == Kind.UPSTREAM || kind == Kind.TIMEOUT || kind == Kind.TRANSPORT;
    }
    @Override public String toString() {
        return "ImageFetchException{kind=" + kind + ", upstreamStatus=" + upstreamStatus + '}';
    }
}
