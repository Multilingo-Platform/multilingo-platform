package com.multilingo.backend.modules.testing.ai.media;

import java.util.Base64;

public final class ImageFixtures {
    private ImageFixtures() {}
    public static byte[] png() {
        return Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN0sAAAAASUVORK5CYII=");
    }
    static byte[] webp() {
        return new byte[]{'R','I','F','F',18,0,0,0,'W','E','B','P','V','P','8','L',5,0,0,0,47,0,0,0,0,0};
    }
}
