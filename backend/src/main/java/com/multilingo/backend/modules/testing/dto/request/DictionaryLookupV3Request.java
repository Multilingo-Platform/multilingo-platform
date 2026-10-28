package com.multilingo.backend.modules.testing.dto.request;

import java.util.Objects;

/**
 * Immutable, validated request body for Dictionary Lookup API V3.
 * SECURITY: Never accepts meaningLanguage, learningLanguage, userId or arbitrary fields.
 */
public record DictionaryLookupV3Request(
        String requestId,
        Integer partId,
        WorkspaceTextSource source,
        String selectedText,
        String contextText
) {
    public DictionaryLookupV3Request {
        Objects.requireNonNull(requestId, "requestId must not be null");
        Objects.requireNonNull(partId, "partId must not be null");
        Objects.requireNonNull(source, "source must not be null");
        Objects.requireNonNull(selectedText, "selectedText must not be null");
        Objects.requireNonNull(contextText, "contextText must not be null");
    }

    @Override
    public String toString() {
        return "DictionaryLookupV3Request[requestId=" + requestId + ", partId=" + partId
                + ", source=" + (source == null ? null : source.sourceKey()) + ", content=<redacted>]";
    }
}
