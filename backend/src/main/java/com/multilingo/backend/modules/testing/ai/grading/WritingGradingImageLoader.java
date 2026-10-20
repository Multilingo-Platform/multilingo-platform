package com.multilingo.backend.modules.testing.ai.grading;

import com.multilingo.backend.modules.testing.ai.gemini.GeminiImagePart;
import com.multilingo.backend.modules.testing.ai.media.FetchedImage;
import com.multilingo.backend.modules.testing.ai.media.ImageFetchException;
import com.multilingo.backend.modules.testing.ai.media.ImageFetcher;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;

/**
 * Bounded loader for multimodal image references with monotonic deadline enforcement,
 * SHA-256 audit calculation, and strict R2 exception-to-failure classification.
 */
@Component
@RequiredArgsConstructor
public class WritingGradingImageLoader {

    private final ImageFetcher imageFetcher;

    public record LoadedImages(
            List<GeminiImagePart> parts,
            List<String> sha256HexDigests
    ) {
        public LoadedImages {
            parts = (parts == null) ? List.of() : List.copyOf(parts);
            sha256HexDigests = (sha256HexDigests == null) ? List.of() : List.copyOf(sha256HexDigests);
        }

        public static LoadedImages empty() {
            return new LoadedImages(List.of(), List.of());
        }
    }

    public LoadedImages load(List<WritingImageRef> refs, Instant deadline) {
        if (refs == null || refs.isEmpty()) {
            return LoadedImages.empty();
        }

        List<GeminiImagePart> parts = new ArrayList<>(refs.size());
        List<String> digests = new ArrayList<>(refs.size());

        for (WritingImageRef ref : refs) {
            if (ref == null || ref.url() == null) {
                continue;
            }

            if (deadline != null && !Instant.now().isBefore(deadline)) {
                throw new WritingGradingException(
                        WritingGradingFailure.retryable("TIMEOUT", "Image loading exceeded deadline")
                );
            }

            if (Thread.currentThread().isInterrupted()) {
                throw new WritingGradingException(
                        WritingGradingFailure.retryable("INTERRUPTED", "Image loading interrupted")
                );
            }

            FetchedImage fetched;
            try {
                fetched = imageFetcher.fetch(ref.url());
            } catch (ImageFetchException e) {
                throw new WritingGradingException(mapImageFetchFailure(e));
            } catch (WritingGradingException e) {
                throw e;
            } catch (Exception e) {
                throw new WritingGradingException(
                        WritingGradingFailure.terminal("IMAGE_FETCH_FAILED", "Image fetching failed unexpectedly")
                );
            }

            if (deadline != null && !Instant.now().isBefore(deadline)) {
                throw new WritingGradingException(
                        WritingGradingFailure.retryable("TIMEOUT", "Image loading exceeded deadline")
                );
            }

            if (Thread.currentThread().isInterrupted()) {
                throw new WritingGradingException(
                        WritingGradingFailure.retryable("INTERRUPTED", "Image loading interrupted")
                );
            }

            byte[] data = fetched.data();
            String sha256 = computeSha256(data);

            parts.add(new GeminiImagePart(fetched.mimeType(), data));
            digests.add(sha256);
        }

        return new LoadedImages(parts, digests);
    }

    public static WritingGradingFailure mapImageFetchFailure(ImageFetchException e) {
        if (e == null || e.getKind() == null) {
            return WritingGradingFailure.terminal("IMAGE_FETCH_FAILED", "Image fetch failed unexpectedly");
        }
        return switch (e.getKind()) {
            case TIMEOUT -> WritingGradingFailure.retryable("TIMEOUT", "Image fetch timed out");
            case TRANSPORT -> WritingGradingFailure.retryable("TRANSPORT", "Image fetch transport error");
            case RATE_LIMITED -> WritingGradingFailure.retryable("RATE_LIMITED", "Image fetch rate limited");
            case UPSTREAM -> WritingGradingFailure.retryable("UPSTREAM", "Image fetch upstream server error");
            case INTERRUPTED -> WritingGradingFailure.retryable("INTERRUPTED", "Image fetch interrupted");
            case INVALID_URL, HOST_NOT_ALLOWED, ADDRESS_REJECTED, REDIRECT_REJECTED ->
                    WritingGradingFailure.unavailable("IMAGE_SOURCE_NOT_ALLOWED", "Image URL or host is not allowed");
            case UPSTREAM_NOT_FOUND, UPSTREAM_REJECTED ->
                    WritingGradingFailure.unavailable("IMAGE_UNAVAILABLE", "Image is not available upstream");
            case TOO_LARGE ->
                    WritingGradingFailure.unavailable("IMAGE_TOO_LARGE", "Image exceeds maximum allowed size");
            case UNSUPPORTED_TYPE, INVALID_CONTENT ->
                    WritingGradingFailure.unavailable("IMAGE_INVALID", "Image format or content is invalid");
            case DISABLED ->
                    WritingGradingFailure.terminal("IMAGE_FETCH_FAILED", "Image fetch provider is disabled");
        };
    }

    private String computeSha256(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data);
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
    }
}
