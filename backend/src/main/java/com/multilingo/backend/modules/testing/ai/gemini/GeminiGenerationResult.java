package com.multilingo.backend.modules.testing.ai.gemini;

/**
 * Normalized result of a successful Gemini generation call.
 * Result text is deliberately excluded from {@link #toString()} to prevent leaking model outputs to logs.
 */
public record GeminiGenerationResult(
        String text,
        Usage usage
) {
    public record Usage(
            Integer promptTokens,
            Integer candidateTokens,
            Integer totalTokens
    ) {
        public Usage {
            if ((promptTokens != null && promptTokens < 0) ||
                    (candidateTokens != null && candidateTokens < 0) ||
                    (totalTokens != null && totalTokens < 0)) {
                throw new GeminiClientException(
                        GeminiClientException.Kind.INVALID_RESPONSE,
                        "Token counts in Usage must not be negative"
                );
            }
        }
    }

    @Override
    public String toString() {
        return "GeminiGenerationResult{" +
                "usage=" + usage +
                ", textLength=" + (text != null ? text.length() : 0) +
                '}';
    }
}
