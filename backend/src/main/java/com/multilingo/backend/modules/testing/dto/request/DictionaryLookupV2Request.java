package com.multilingo.backend.modules.testing.dto.request;

/** V2 selects the explanation language; the learning language is always read from the attempt snapshot. */
public record DictionaryLookupV2Request(
        String requestId,
        Integer partId,
        String documentId,
        String selectedText,
        String contextText,
        String meaningLanguage
) {
    @Override
    public String toString() {
        return "DictionaryLookupV2Request[requestId=" + requestId + ", partId=" + partId
                + ", documentId=" + documentId + ", meaningLanguage=" + meaningLanguage
                + ", content=<redacted>]";
    }
}
