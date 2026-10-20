package com.multilingo.backend.modules.testing.ai.grading;

import com.multilingo.backend.modules.testing.ai.media.FetchedImage;
import com.multilingo.backend.modules.testing.ai.media.ImageFetchException;
import com.multilingo.backend.modules.testing.ai.media.ImageFetcher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class WritingGradingImageLoaderTest {

    private ImageFetcher imageFetcher;
    private WritingGradingImageLoader loader;

    @BeforeEach
    void setUp() {
        imageFetcher = mock(ImageFetcher.class);
        loader = new WritingGradingImageLoader(imageFetcher);
    }

    @ParameterizedTest
    @EnumSource(ImageFetchException.Kind.class)
    @DisplayName("F6: Should strictly map all 15 ImageFetchException.Kind values according to R2 table")
    void mapImageFetchFailure_allKinds_strictlyFollowsR2Table(ImageFetchException.Kind kind) {
        ImageFetchException exception = new ImageFetchException(kind);
        WritingGradingFailure failure = WritingGradingImageLoader.mapImageFetchFailure(exception);

        assertThat(failure).isNotNull();
        assertThat(failure.safeMessage()).doesNotContain("https://", "SENTINEL", "token");

        switch (kind) {
            case TIMEOUT -> {
                assertThat(failure.errorCode()).isEqualTo("TIMEOUT");
                assertThat(failure.isRetryable()).isTrue();
                assertThat(failure.isWaiting()).isFalse();
                assertThat(failure.destination()).isEqualTo(WritingGradingFailure.TerminalDestination.NONE);
            }
            case TRANSPORT -> {
                assertThat(failure.errorCode()).isEqualTo("TRANSPORT");
                assertThat(failure.isRetryable()).isTrue();
                assertThat(failure.isWaiting()).isFalse();
                assertThat(failure.destination()).isEqualTo(WritingGradingFailure.TerminalDestination.NONE);
            }
            case RATE_LIMITED -> {
                assertThat(failure.errorCode()).isEqualTo("RATE_LIMITED");
                assertThat(failure.isRetryable()).isTrue();
                assertThat(failure.isWaiting()).isFalse();
                assertThat(failure.destination()).isEqualTo(WritingGradingFailure.TerminalDestination.NONE);
            }
            case UPSTREAM -> {
                assertThat(failure.errorCode()).isEqualTo("UPSTREAM");
                assertThat(failure.isRetryable()).isTrue();
                assertThat(failure.isWaiting()).isFalse();
                assertThat(failure.destination()).isEqualTo(WritingGradingFailure.TerminalDestination.NONE);
            }
            case INTERRUPTED -> {
                assertThat(failure.errorCode()).isEqualTo("INTERRUPTED");
                assertThat(failure.isRetryable()).isTrue();
                assertThat(failure.isWaiting()).isFalse();
                assertThat(failure.destination()).isEqualTo(WritingGradingFailure.TerminalDestination.NONE);
            }
            case INVALID_URL, HOST_NOT_ALLOWED, ADDRESS_REJECTED, REDIRECT_REJECTED -> {
                assertThat(failure.errorCode()).isEqualTo("IMAGE_SOURCE_NOT_ALLOWED");
                assertThat(failure.isRetryable()).isFalse();
                assertThat(failure.isWaiting()).isFalse();
                assertThat(failure.isUnavailable()).isTrue();
                assertThat(failure.destination()).isEqualTo(WritingGradingFailure.TerminalDestination.UNAVAILABLE);
            }
            case UPSTREAM_NOT_FOUND, UPSTREAM_REJECTED -> {
                assertThat(failure.errorCode()).isEqualTo("IMAGE_UNAVAILABLE");
                assertThat(failure.isRetryable()).isFalse();
                assertThat(failure.isWaiting()).isFalse();
                assertThat(failure.isUnavailable()).isTrue();
                assertThat(failure.destination()).isEqualTo(WritingGradingFailure.TerminalDestination.UNAVAILABLE);
            }
            case TOO_LARGE -> {
                assertThat(failure.errorCode()).isEqualTo("IMAGE_TOO_LARGE");
                assertThat(failure.isRetryable()).isFalse();
                assertThat(failure.isWaiting()).isFalse();
                assertThat(failure.isUnavailable()).isTrue();
                assertThat(failure.destination()).isEqualTo(WritingGradingFailure.TerminalDestination.UNAVAILABLE);
            }
            case UNSUPPORTED_TYPE, INVALID_CONTENT -> {
                assertThat(failure.errorCode()).isEqualTo("IMAGE_INVALID");
                assertThat(failure.isRetryable()).isFalse();
                assertThat(failure.isWaiting()).isFalse();
                assertThat(failure.isUnavailable()).isTrue();
                assertThat(failure.destination()).isEqualTo(WritingGradingFailure.TerminalDestination.UNAVAILABLE);
            }
            case DISABLED -> {
                assertThat(failure.errorCode()).isEqualTo("IMAGE_FETCH_FAILED");
                assertThat(failure.isRetryable()).isFalse();
                assertThat(failure.isWaiting()).isFalse();
                assertThat(failure.isTerminal()).isTrue();
                assertThat(failure.destination()).isEqualTo(WritingGradingFailure.TerminalDestination.FAILED);
            }
        }
    }

    @Test
    @DisplayName("F5: Expired deadline before first image should throw TIMEOUT and never call fetch")
    void load_expiredDeadlineToStart_throwsTimeoutAndDoesNotFetch() {
        Instant pastDeadline = Instant.now().minus(1, ChronoUnit.SECONDS);
        List<WritingImageRef> refs = List.of(new WritingImageRef("https://cdn.example.test/img1.png"));

        assertThatThrownBy(() -> loader.load(refs, pastDeadline))
                .isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> {
                    WritingGradingFailure failure = ((WritingGradingException) ex).getFailure();
                    assertThat(failure.errorCode()).isEqualTo("TIMEOUT");
                    assertThat(failure.isRetryable()).isTrue();
                });

        verifyNoInteractions(imageFetcher);
    }

    @Test
    @DisplayName("F5: Expired deadline between image 1 and image 2 should fetch image 1 but not image 2")
    void load_deadlinesExpiresAfterFirstImage_stopsBeforeSecondImage() {
        Instant deadline = Instant.now().plusMillis(50);
        List<WritingImageRef> refs = List.of(
                new WritingImageRef("https://cdn.example.test/img1.png"),
                new WritingImageRef("https://cdn.example.test/img2.png")
        );

        when(imageFetcher.fetch("https://cdn.example.test/img1.png")).thenAnswer(invocation -> {
            Thread.sleep(60); // sleep past deadline
            return new FetchedImage("image/png", new byte[]{1, 2, 3});
        });

        assertThatThrownBy(() -> loader.load(refs, deadline))
                .isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> {
                    WritingGradingFailure failure = ((WritingGradingException) ex).getFailure();
                    assertThat(failure.errorCode()).isEqualTo("TIMEOUT");
                    assertThat(failure.isRetryable()).isTrue();
                });

        verify(imageFetcher, times(1)).fetch("https://cdn.example.test/img1.png");
        verify(imageFetcher, never()).fetch("https://cdn.example.test/img2.png");
    }

    @Test
    @DisplayName("F12: Expired deadline during single image fetch should throw retryable TIMEOUT immediately after fetch")
    void load_deadlineExpiresDuringSingleImageFetch_throwsTimeoutAfterFetch() {
        Instant deadline = Instant.now().plusMillis(50);
        List<WritingImageRef> refs = List.of(
                new WritingImageRef("https://cdn.example.test/img1.png")
        );

        when(imageFetcher.fetch("https://cdn.example.test/img1.png")).thenAnswer(invocation -> {
            Thread.sleep(60); // sleep past deadline
            return new FetchedImage("image/png", new byte[]{1, 2, 3});
        });

        assertThatThrownBy(() -> loader.load(refs, deadline))
                .isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> {
                    WritingGradingFailure failure = ((WritingGradingException) ex).getFailure();
                    assertThat(failure.errorCode()).isEqualTo("TIMEOUT");
                    assertThat(failure.isRetryable()).isTrue();
                });

        verify(imageFetcher, times(1)).fetch("https://cdn.example.test/img1.png");
    }

    @Test
    @DisplayName("F5: Thread interrupted during load should throw retryable INTERRUPTED")
    void load_interruptedThread_throwsInterruptedFailure() {
        Thread.currentThread().interrupt();
        List<WritingImageRef> refs = List.of(new WritingImageRef("https://cdn.example.test/img1.png"));

        try {
            assertThatThrownBy(() -> loader.load(refs, Instant.now().plusSeconds(10)))
                    .isInstanceOf(WritingGradingException.class)
                    .satisfies(ex -> {
                        WritingGradingFailure failure = ((WritingGradingException) ex).getFailure();
                        assertThat(failure.errorCode()).isEqualTo("INTERRUPTED");
                        assertThat(failure.isRetryable()).isTrue();
                    });
            verifyNoInteractions(imageFetcher);
        } finally {
            Thread.interrupted(); // clear interrupted flag
        }
    }

    @Test
    @DisplayName("F5: Should successfully load images in exact order and compute correct SHA-256 digests")
    void load_multipleImages_preservesOrderAndComputesSha256() throws Exception {
        byte[] img1Bytes = "image-1-sample-data".getBytes(StandardCharsets.UTF_8);
        byte[] img2Bytes = "image-2-sample-data".getBytes(StandardCharsets.UTF_8);

        when(imageFetcher.fetch("https://cdn.example.test/img1.png"))
                .thenReturn(new FetchedImage("image/png", img1Bytes));
        when(imageFetcher.fetch("https://cdn.example.test/img2.jpeg"))
                .thenReturn(new FetchedImage("image/jpeg", img2Bytes));

        List<WritingImageRef> refs = List.of(
                new WritingImageRef("https://cdn.example.test/img1.png"),
                new WritingImageRef("https://cdn.example.test/img2.jpeg")
        );

        WritingGradingImageLoader.LoadedImages loaded = loader.load(refs, Instant.now().plusSeconds(10));

        assertThat(loaded).isNotNull();
        assertThat(loaded.parts()).hasSize(2);
        assertThat(loaded.parts().get(0).mimeType()).isEqualTo("image/png");
        assertThat(loaded.parts().get(0).data()).isEqualTo(img1Bytes);
        assertThat(loaded.parts().get(1).mimeType()).isEqualTo("image/jpeg");
        assertThat(loaded.parts().get(1).data()).isEqualTo(img2Bytes);

        String expectedSha1 = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(img1Bytes));
        String expectedSha2 = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(img2Bytes));

        assertThat(loaded.sha256HexDigests()).containsExactly(expectedSha1, expectedSha2);
    }

    @Test
    @DisplayName("Should return empty LoadedImages for empty or null refs")
    void load_emptyOrNullRefs_returnsEmpty() {
        WritingGradingImageLoader.LoadedImages loadedNull = loader.load(null, Instant.now().plusSeconds(10));
        assertThat(loadedNull.parts()).isEmpty();
        assertThat(loadedNull.sha256HexDigests()).isEmpty();

        WritingGradingImageLoader.LoadedImages loadedEmpty = loader.load(List.of(), Instant.now().plusSeconds(10));
        assertThat(loadedEmpty.parts()).isEmpty();
        assertThat(loadedEmpty.sha256HexDigests()).isEmpty();

        verifyNoInteractions(imageFetcher);
    }
}
