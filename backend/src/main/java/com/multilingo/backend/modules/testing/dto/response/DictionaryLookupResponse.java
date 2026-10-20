package com.multilingo.backend.modules.testing.dto.response;

public record DictionaryLookupResponse(
        String requestId,
        Integer attemptId,
        Integer partId,
        String documentId,
        String selectedText,
        String sourceContext,
        String learningLanguage,
        String meaningLanguage,
        String meaningVi,
        String phonetic,
        String partOfSpeech,
        String exampleEn,
        String exampleVi
) {
    @Override
    public String toString() {
        return "DictionaryLookupResponse[requestId=" + requestId + ", attemptId=" + attemptId
                + ", partId=" + partId + ", documentId=" + documentId + ", content=<redacted>]";
    }
}
