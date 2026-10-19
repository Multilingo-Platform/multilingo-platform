package com.multilingo.backend.modules.testing.ai.gemini;

import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Immutable request payload for a Gemini generation call.
 * Payload text is deliberately excluded from {@link #toString()} to prevent leaking prompt/learner texts.
 */
public record GeminiGenerationRequest(
        String systemInstruction,
        String userText,
        int maxOutputTokens,
        OutputFormat outputFormat,
        List<GeminiImagePart> images
) {
    public GeminiGenerationRequest(String systemInstruction, String userText, int maxOutputTokens,
                                   OutputFormat outputFormat) {
        this(systemInstruction, userText, maxOutputTokens, outputFormat, List.of());
    }
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
        if (images == null) {
            images = List.of();
        } else {
            if (images.size() > GeminiProperties.MAX_IMAGES_PER_REQUEST || images.stream().anyMatch(i -> i == null)) {
                throw invalidImages();
            }
            images = List.copyOf(images);
        }
        if (!images.isEmpty()) {
            long total = 0;
            for (GeminiImagePart image : images) {
                total += image.dataLength();
            }
            // Reject by UTF-16 length before allocating bounded UTF-8 encodings.
            long textLength = (long) userText.length() + (systemInstruction == null ? 0 : systemInstruction.length());
            if (total > GeminiProperties.MAX_TOTAL_IMAGE_BYTES
                    || textLength > GeminiProperties.MAX_TEXT_BYTES_WITH_IMAGES
                    || (long) userText.getBytes(StandardCharsets.UTF_8).length
                        + (systemInstruction == null ? 0 : systemInstruction.getBytes(StandardCharsets.UTF_8).length)
                        > GeminiProperties.MAX_TEXT_BYTES_WITH_IMAGES) {
                throw invalidImages();
            }
        }
    }

    private static GeminiClientException invalidImages() {
        return new GeminiClientException(GeminiClientException.Kind.INVALID_INPUT, "Invalid multimodal request");
    }

    @Override
    public String toString() {
        return "GeminiGenerationRequest{" +
                "maxOutputTokens=" + maxOutputTokens +
                ", outputFormat=" + outputFormat +
                ", systemInstructionPresent=" + (systemInstruction != null) +
                ", imageCount=" + images.size() +
                '}';
    }
}
