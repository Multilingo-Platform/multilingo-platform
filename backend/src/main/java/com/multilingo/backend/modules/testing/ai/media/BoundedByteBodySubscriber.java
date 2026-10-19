package com.multilingo.backend.modules.testing.ai.media;

import java.io.ByteArrayOutputStream;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.Flow;
import java.util.function.Supplier;

/** Provider-neutral bounded streaming primitive. */
public class BoundedByteBodySubscriber implements HttpResponse.BodySubscriber<byte[]> {
    private final int maxBytes;
    private final Supplier<? extends RuntimeException> oversized;
    private final CompletableFuture<byte[]> body = new CompletableFuture<>();
    private final ByteArrayOutputStream buffer = new ByteArrayOutputStream();
    private Flow.Subscription subscription;
    private long received;
    private boolean cancelled;
    public BoundedByteBodySubscriber(int maxBytes, Supplier<? extends RuntimeException> oversized) {
        this.maxBytes = maxBytes;
        this.oversized = java.util.Objects.requireNonNull(oversized);
    }
    @Override public CompletionStage<byte[]> getBody() { return body; }
    @Override public synchronized void onSubscribe(Flow.Subscription next) {
        if (next == null) return;
        if (subscription != null || cancelled || body.isDone()) { next.cancel(); return; }
        subscription = next;
        next.request(1);
    }
    @Override public synchronized void onNext(List<ByteBuffer> chunks) {
        if (cancelled || body.isDone() || chunks == null) return;
        for (ByteBuffer chunk : chunks) {
            int count = chunk.remaining();
            if (received + count > maxBytes) {
                cancelled = true;
                if (subscription != null) subscription.cancel();
                body.completeExceptionally(oversized.get());
                return;
            }
            byte[] bytes = new byte[count];
            chunk.get(bytes);
            buffer.write(bytes, 0, count);
            received += count;
        }
        if (subscription != null && !cancelled && !body.isDone()) subscription.request(1);
    }
    @Override public synchronized void onError(Throwable error) {
        if (!body.isDone()) body.completeExceptionally(error);
    }
    @Override public synchronized void onComplete() {
        if (!body.isDone()) body.complete(buffer.toByteArray());
    }
    public synchronized void cancel() {
        if (!cancelled) {
            cancelled = true;
            if (subscription != null) subscription.cancel();
        }
        body.cancel(true);
    }
}
