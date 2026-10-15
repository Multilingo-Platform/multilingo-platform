package com.multilingo.backend.modules.testing.ai.media;

public record FetchedImage(String mimeType, byte[] data) {
    public FetchedImage {
        if (data == null || data.length == 0) throw new ImageFetchException(ImageFetchException.Kind.INVALID_CONTENT);
        if (data.length > ImageFetchProperties.MAX_IMAGE_BYTES) throw new ImageFetchException(ImageFetchException.Kind.TOO_LARGE);
        if (mimeType == null || !java.util.Set.of("image/png", "image/jpeg", "image/webp").contains(mimeType)) {
            throw new ImageFetchException(ImageFetchException.Kind.UNSUPPORTED_TYPE);
        }
        data = data.clone();
    }
    @Override public byte[] data() { return data.clone(); }
    @Override public String toString() { return "FetchedImage{mimeType=" + mimeType + ", length=" + data.length + '}'; }
}
