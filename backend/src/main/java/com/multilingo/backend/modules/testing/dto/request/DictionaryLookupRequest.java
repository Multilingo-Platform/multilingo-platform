package com.multilingo.backend.modules.testing.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnore;

/** Client selection plus a passage locator; the server always re-verifies both against the attempt snapshot. */
public record DictionaryLookupRequest(
        String requestId,
        Integer partId,
        String documentId,
        String selectedText,
        String contextText,
        @JsonIgnore int contractVersion,
        @JsonIgnore String meaningLanguage
) {
    public DictionaryLookupRequest(String requestId, Integer partId, String documentId, String selectedText, String contextText) {
        this(requestId, partId, documentId, selectedText, contextText, 1, null);
    }

    @Override
    public String toString() {
        return "DictionaryLookupRequest[requestId=" + requestId + ", partId=" + partId
                + ", documentId=" + documentId + ", contractVersion=" + contractVersion
                + ", selectedText=<redacted>, contextText=<redacted>]";
    }
}
