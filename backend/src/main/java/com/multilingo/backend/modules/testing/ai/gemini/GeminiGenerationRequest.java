package com.multilingo.backend.modules.testing.ai.gemini;

/**
 * Immutable request payload for a Gemini generation call.
 * Payload text is deliberately excluded from {@link #toString()} to prevent leaking prompt/learner texts.
 */
public record GeminiGenerationRequest(
        String systemInstruction,
        String userText,
        int maxOutputTokens,
        OutputFormat outputFormat
) {
    public enum OutputFormat {
        TEXT,
        JSON
    }

    public GeminiGenerationRequest {
        if (userText == null || userText.isBlank()) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.INVALID_INPUT,
                    "userText must not be null or blank"
            );
        }
        if (outputFormat == null) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.INVALID_INPUT,
                    "outputFormat must not be null"
            );
        }
        if (maxOutputTokens < 1 || maxOutputTokens > 8192) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.INVALID_INPUT,
                    "maxOutputTokens must be between 1 and 8192"
            );
        }
    }

    @Override
    public String toString() {
        return "GeminiGenerationRequest{" +
                "maxOutputTokens=" + maxOutputTokens +
                ", outputFormat=" + outputFormat +
                ", systemInstructionPresent=" + (systemInstruction != null) +
                '}';
    }
}
