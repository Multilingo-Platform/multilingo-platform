package com.multilingo.backend.modules.testing.dto.response;

import java.time.Instant;
import java.util.List;

public record WritingHintsResponse(
        Integer attemptId,
        Integer partId,
        String questionId,
        String requestId,
        String learningLanguage,
        String hintLanguage,
        Instant generatedAt,
        List<OutlineSection> outline,
        List<VocabularyItem> vocabulary,
        List<String> limitations
) {
    public record OutlineSection(String title, List<String> points) {}

    public record VocabularyItem(String term, String definition, String explanation, String example) {}

    public record Content(
            List<OutlineSection> outline,
            List<VocabularyItem> vocabulary,
            List<String> limitations
    ) {}

    public static WritingHintsResponse of(
            Integer attemptId,
            Integer partId,
            String questionId,
            String requestId,
            String learningLanguage,
            String hintLanguage,
            Instant generatedAt,
            Content content
    ) {
        return new WritingHintsResponse(
                attemptId,
                partId,
                questionId,
                requestId,
                learningLanguage,
                hintLanguage,
                generatedAt,
                content != null ? content.outline() : List.of(),
                content != null ? content.vocabulary() : List.of(),
                content != null ? content.limitations() : List.of()
        );
    }

    @Override
    public String toString() {
        return "WritingHintsResponse[attemptId=" + attemptId + ", partId=" + partId + ", requestId=" + requestId + "]";
    }
}
