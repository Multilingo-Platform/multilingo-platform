package com.multilingo.backend.modules.testing.dto.request;

public record WritingHintsRequest(
        Integer partId,
        String questionId,
        String requestId,
        String learningLanguage,
        String hintLanguage
) {
    @Override
    public String toString() {
        return "WritingHintsRequest[partId=" + partId + ", requestId=" + requestId + "]";
    }
}
