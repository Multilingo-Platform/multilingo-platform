package com.multilingo.backend.modules.testing.ai.media;

import org.junit.jupiter.api.Test;
import java.util.Arrays;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import static org.assertj.core.api.Assertions.*;

class ImageSnifferTest {
    @Test void rejectsJpegScanWithoutFrameAndWithInvalidScanHeader() {
        byte[] malformed = {(byte)255,(byte)216,(byte)255,(byte)218,0,2,(byte)255,(byte)217};
        assertThatThrownBy(() -> ImageSniffer.sniff(malformed, "image/jpeg"))
                .isInstanceOfSatisfying(ImageFetchException.class,
                        e -> assertThat(e.getKind()).isEqualTo(ImageFetchException.Kind.INVALID_CONTENT));
    }
    @Test void recognizesSupportedFormatsWithoutUsingTheFilename() throws Exception {
        assertThat(ImageSniffer.sniff(ImageFixtures.png(), "image/png")).isEqualTo("image/png");
        assertThat(ImageSniffer.sniff(ImageFixtures.webp(), "image/webp")).isEqualTo("image/webp");
        var output = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB), "jpeg", output);
        assertThat(ImageSniffer.sniff(output.toByteArray(), "image/jpeg")).isEqualTo("image/jpeg");
    }

    @Test void rejectsMismatchedUnsupportedAndTruncatedContent() {
        assertThatThrownBy(() -> ImageSniffer.sniff(ImageFixtures.png(), "image/jpeg"))
                .isInstanceOfSatisfying(ImageFetchException.class,
                        e -> assertThat(e.getKind()).isEqualTo(ImageFetchException.Kind.UNSUPPORTED_TYPE));
        for (byte[] data : new byte[][]{"GIF89a".getBytes(), "<svg>SECRET_BODY</svg>".getBytes(),
                "MZfake.png".getBytes(), "<html>body</html>".getBytes()}) {
            assertThatThrownBy(() -> ImageSniffer.sniff(data, "image/png")).isInstanceOf(ImageFetchException.class);
        }
        for (byte[] data : new byte[][]{new byte[0], Arrays.copyOf(ImageFixtures.png(), 4),
                Arrays.copyOf(ImageFixtures.png(), ImageFixtures.png().length - 1),
                Arrays.copyOf(ImageFixtures.webp(), 20), new byte[]{(byte)255, (byte)216, (byte)255}}) {
            assertThatThrownBy(() -> ImageSniffer.sniff(data, "image/png"))
                    .isInstanceOfSatisfying(ImageFetchException.class,
                            e -> assertThat(e.getKind()).isEqualTo(ImageFetchException.Kind.INVALID_CONTENT));
        }
    }
}
