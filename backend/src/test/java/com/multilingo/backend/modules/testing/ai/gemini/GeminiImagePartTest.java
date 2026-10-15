package com.multilingo.backend.modules.testing.ai.gemini;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

class GeminiImagePartTest {
    private static final int CAP = 2_097_152;

    @ParameterizedTest
    @ValueSource(strings = {"image/png", "image/jpeg", "image/webp"})
    void copiesBothInputAndOutput(String mime) {
        byte[] source = {1, 2, 3};
        var image = new GeminiImagePart(mime, source);
        source[0] = 9;
        image.data()[1] = 9;
        assertThat(image.data()).containsExactly(1, 2, 3);
        assertThat(image.toString()).contains(mime, "3").doesNotContain("AQID");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "IMAGE/PNG", "image/gif", "image/png; charset=utf-8", "SECRET_MIME"})
    void rejectsUnsupportedMimeWithoutEchoingIt(String mime) {
        assertThatThrownBy(() -> new GeminiImagePart(mime, new byte[]{1}))
                .isInstanceOfSatisfying(GeminiClientException.class, e -> {
                    assertThat(e.getKind()).isEqualTo(GeminiClientException.Kind.INVALID_INPUT);
                    assertThat(e.getCause()).isNull();
                    assertThat(e.getMessage()).doesNotContain("SECRET_MIME");
                });
    }

    @Test
    void validatesByteBoundaries() {
        assertThatCode(() -> new GeminiImagePart("image/png", new byte[CAP])).doesNotThrowAnyException();
        for (byte[] data : new byte[][]{null, new byte[0], new byte[CAP + 1]}) {
            invalid(() -> new GeminiImagePart("image/png", data));
        }
    }

    @Test
    void requestCopiesListAndAcceptsExactlyTwoMaximumImages() {
        var image = new GeminiImagePart("image/png", new byte[CAP]);
        var source = new ArrayList<>(List.of(image, image));
        var request = request("x", source);
        source.clear();
        assertThat(request.images()).hasSize(2);
        assertThatThrownBy(() -> request.images().clear()).isInstanceOf(UnsupportedOperationException.class);
        assertThat(request.toString()).contains("imageCount=2").doesNotContain("image/png");
        assertThat(request("x", null).images()).isEmpty();
        assertThat(request("x", List.of()).images()).isEmpty();
        invalid(() -> request("x", List.of(image, image, image)));
        invalid(() -> request("x", Arrays.asList(image, null)));
    }

    @Test
    void countsCombinedUtf8TextOnlyForMultimodalRequests() {
        var images = List.of(new GeminiImagePart("image/jpeg", new byte[]{1}));
        assertThatCode(() -> request("é".repeat(65_536), images)).doesNotThrowAnyException();
        invalid(() -> request("é".repeat(65_536) + "a", images));
        invalid(() -> new GeminiGenerationRequest("a", "x".repeat(131_072), 1,
                GeminiGenerationRequest.OutputFormat.JSON, images));
        // Text-only validation remains at the existing bounded codec, not this constructor.
        assertThatCode(() -> request("a".repeat(131_073), List.of())).doesNotThrowAnyException();
        var legacy = new GeminiGenerationRequest(null, "x", 1, GeminiGenerationRequest.OutputFormat.TEXT);
        assertThat(legacy).isEqualTo(request("x", List.of()));
    }

    private static GeminiGenerationRequest request(String text, List<GeminiImagePart> images) {
        return new GeminiGenerationRequest(null, text, 1, GeminiGenerationRequest.OutputFormat.TEXT, images);
    }

    private static void invalid(org.assertj.core.api.ThrowableAssert.ThrowingCallable action) {
        assertThatThrownBy(action).isInstanceOfSatisfying(GeminiClientException.class,
                e -> assertThat(e.getKind()).isEqualTo(GeminiClientException.Kind.INVALID_INPUT));
    }
}
