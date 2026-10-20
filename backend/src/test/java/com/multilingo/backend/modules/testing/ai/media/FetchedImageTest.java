package com.multilingo.backend.modules.testing.ai.media;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class FetchedImageTest {
    @Test void copiesBytesAndHidesContent() {
        byte[] input = {65, 66, 67};
        var result = new FetchedImage("image/png", input);
        input[0] = 0;
        result.data()[1] = 0;
        assertThat(result.data()).containsExactly(65, 66, 67);
        assertThat(result.toString()).doesNotContain("ABC", "QUJD");
        assertThatThrownBy(() -> new FetchedImage("image/png", new byte[0])).isInstanceOf(ImageFetchException.class);
        assertThatThrownBy(() -> new FetchedImage("image/png", new byte[2_097_153])).isInstanceOf(ImageFetchException.class);
    }
}
