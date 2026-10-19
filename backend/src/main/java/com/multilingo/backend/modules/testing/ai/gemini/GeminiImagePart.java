package com.multilingo.backend.modules.testing.ai.gemini;

import java.util.Set;

/** Inline image bytes; callers obtain validated content before constructing a part. */
public record GeminiImagePart(String mimeType, byte[] data) {
    private static final Set<String> MIME_TYPES = Set.of("image/png", "image/jpeg", "image/webp");

    public GeminiImagePart {
        if (mimeType == null || !MIME_TYPES.contains(mimeType)
                || data == null || data.length == 0 || data.length > GeminiProperties.MAX_IMAGE_BYTES) {
            throw new GeminiClientException(GeminiClientException.Kind.INVALID_INPUT, "Invalid inline image");
        }
        data = data.clone();
    }

    @Override
    public byte[] data() {
        return data.clone();
    }

    int dataLength() {
        return data.length;
    }

    @Override
    public String toString() {
        return "GeminiImagePart{mimeType=" + mimeType + ", length=" + data.length + '}';
    }
}
