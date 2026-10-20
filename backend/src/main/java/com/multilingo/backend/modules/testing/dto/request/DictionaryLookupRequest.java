package com.multilingo.backend.modules.testing.dto.request;

/** Client selection plus a passage locator; the server always re-verifies both against the attempt snapshot. */
public record DictionaryLookupRequest(
        String requestId,
        Integer partId,
        String documentId,
        String selectedText,
        String contextText
) {
    @Override
    public String toString() {
        return "DictionaryLookupRequest[requestId=" + requestId + ", partId=" + partId
                + ", documentId=" + documentId + ", selectedText=<redacted>, contextText=<redacted>]";
    }
}
