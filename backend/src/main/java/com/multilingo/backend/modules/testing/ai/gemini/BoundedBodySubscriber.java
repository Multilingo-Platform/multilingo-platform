package com.multilingo.backend.modules.testing.ai.gemini;

import java.io.ByteArrayOutputStream;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.Flow;

/**
 * A finite HttpResponse.BodySubscriber that reads incoming response chunks up to maxBytes.
 * Cancels upstream subscription immediately if accumulated bytes exceed maxBytes, preventing OOM.
 */
public class BoundedBodySubscriber implements HttpResponse.BodySubscriber<byte[]> {

    private final int maxBytes;
    private final CompletableFuture<byte[]> bodyStage = new CompletableFuture<>();
    private final ByteArrayOutputStream buffer = new ByteArrayOutputStream();

    private Flow.Subscription subscription;
    private long totalBytesReceived = 0;
    private boolean cancelled = false;

    public BoundedBodySubscriber(int maxBytes) {
        this.maxBytes = maxBytes;
    }

    @Override
    public CompletionStage<byte[]> getBody() {
        return bodyStage;
    }

    @Override
    public synchronized void onSubscribe(Flow.Subscription subscription) {
        this.subscription = subscription;
        if (subscription != null) {
            subscription.request(1);
        }
    }

    @Override
    public synchronized void onNext(List<ByteBuffer> item) {
        if (cancelled || bodyStage.isDone() || item == null) {
            return;
        }

        for (ByteBuffer buf : item) {
            int remaining = buf.remaining();
            if (totalBytesReceived + remaining > maxBytes) {
                cancelled = true;
                if (subscription != null) {
                    subscription.cancel();
                }
                bodyStage.completeExceptionally(new GeminiClientException(
                        GeminiClientException.Kind.RESPONSE_TOO_LARGE,
                        "Response body exceeds maximum allowed size of " + maxBytes + " bytes"
                ));
                return;
            }

            byte[] chunk = new byte[remaining];
            buf.get(chunk);
            buffer.write(chunk, 0, chunk.length);
            totalBytesReceived += remaining;
        }

        if (subscription != null && !cancelled && !bodyStage.isDone()) {
            subscription.request(1);
        }
    }

    @Override
    public synchronized void onError(Throwable throwable) {
        if (!bodyStage.isDone()) {
            bodyStage.completeExceptionally(throwable);
        }
    }

    @Override
    public synchronized void onComplete() {
        if (!bodyStage.isDone()) {
            bodyStage.complete(buffer.toByteArray());
        }
    }
}
