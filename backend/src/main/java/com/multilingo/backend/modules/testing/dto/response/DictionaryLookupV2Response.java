package com.multilingo.backend.modules.testing.dto.response;

public record DictionaryLookupV2Response(
        String requestId,
        Integer attemptId,
        Integer partId,
        String documentId,
        String selectedText,
        String sourceContext,
        DictionaryDefinitionV2 definition
) {
    @Override
    public String toString() {
        return "DictionaryLookupV2Response[requestId=" + requestId + ", attemptId=" + attemptId
                + ", partId=" + partId + ", documentId=" + documentId + ", content=<redacted>]";
    }

    public record DictionaryDefinitionV2(
            int schemaVersion,
            String learningLanguage,
            String meaningLanguage,
            String meaning,
            String phonetic,
            String partOfSpeech,
            String example,
            String exampleTranslation
    ) {
        @Override
        public String toString() {
            return "DictionaryDefinitionV2[schemaVersion=" + schemaVersion + ", learningLanguage="
                    + learningLanguage + ", meaningLanguage=" + meaningLanguage + ", content=<redacted>]";
        }
    }
}
