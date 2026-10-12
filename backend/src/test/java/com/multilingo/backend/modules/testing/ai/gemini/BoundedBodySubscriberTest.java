package com.multilingo.backend.modules.testing.ai.gemini;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Flow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BoundedBodySubscriberTest {

    private static class TestSubscription implements Flow.Subscription {
        long requested = 0;
        boolean cancelled = false;

        @Override
        public void request(long n) {
            requested += n;
        }

        @Override
        public void cancel() {
            cancelled = true;
        }
    }

    @Test
    @DisplayName("Single chunk within byte cap completes stage with exact bytes")
    void receivesSingleChunkWithinCap() throws Exception {
        BoundedBodySubscriber subscriber = new BoundedBodySubscriber(1024);
        TestSubscription subscription = new TestSubscription();
        subscriber.onSubscribe(subscription);

        assertThat(subscription.requested).isGreaterThanOrEqualTo(1);

        byte[] payload = "Hello world".getBytes(StandardCharsets.UTF_8);
        subscriber.onNext(List.of(ByteBuffer.wrap(payload)));
        subscriber.onComplete();

        CompletableFuture<byte[]> stage = subscriber.getBody().toCompletableFuture();
        assertThat(stage.isDone()).isTrue();
        assertThat(stage.get()).isEqualTo(payload);
        assertThat(subscription.cancelled).isFalse();
    }

    @Test
    @DisplayName("Multiple chunks within byte cap are joined in order")
    void receivesMultipleChunksWithinCap() throws Exception {
        BoundedBodySubscriber subscriber = new BoundedBodySubscriber(1024);
        TestSubscription subscription = new TestSubscription();
        subscriber.onSubscribe(subscription);

        subscriber.onNext(List.of(ByteBuffer.wrap("Part 1, ".getBytes(StandardCharsets.UTF_8))));
        subscriber.onNext(List.of(ByteBuffer.wrap("Part 2, ".getBytes(StandardCharsets.UTF_8))));
        subscriber.onNext(List.of(ByteBuffer.wrap("Part 3".getBytes(StandardCharsets.UTF_8))));
        subscriber.onComplete();

        CompletableFuture<byte[]> stage = subscriber.getBody().toCompletableFuture();
        assertThat(stage.isDone()).isTrue();
        assertThat(new String(stage.get(), StandardCharsets.UTF_8)).isEqualTo("Part 1, Part 2, Part 3");
    }

    @Test
    @DisplayName("Receiving bytes exactly at cap succeeds")
    void receivesExactCapBytes() throws Exception {
        int cap = 100;
        BoundedBodySubscriber subscriber = new BoundedBodySubscriber(cap);
        TestSubscription subscription = new TestSubscription();
        subscriber.onSubscribe(subscription);

        byte[] chunk1 = new byte[60];
        byte[] chunk2 = new byte[40];
        subscriber.onNext(List.of(ByteBuffer.wrap(chunk1)));
        subscriber.onNext(List.of(ByteBuffer.wrap(chunk2)));
        subscriber.onComplete();

        CompletableFuture<byte[]> stage = subscriber.getBody().toCompletableFuture();
        assertThat(stage.isDone()).isTrue();
        assertThat(stage.get().length).isEqualTo(100);
        assertThat(subscription.cancelled).isFalse();
    }

    @Test
    @DisplayName("Exceeding byte cap cancels subscription immediately and completes stage with RESPONSE_TOO_LARGE")
    void exceedingCapCancelsSubscription() {
        int cap = 100;
        BoundedBodySubscriber subscriber = new BoundedBodySubscriber(cap);
        TestSubscription subscription = new TestSubscription();
        subscriber.onSubscribe(subscription);

        byte[] chunk1 = new byte[60];
        byte[] chunk2 = new byte[41]; // Total = 101 > 100
        subscriber.onNext(List.of(ByteBuffer.wrap(chunk1)));
        subscriber.onNext(List.of(ByteBuffer.wrap(chunk2)));

        assertThat(subscription.cancelled).isTrue();

        CompletableFuture<byte[]> stage = subscriber.getBody().toCompletableFuture();
        assertThat(stage.isCompletedExceptionally()).isTrue();
        assertThatThrownBy(stage::get)
                .isInstanceOf(ExecutionException.class)
                .hasCauseInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException gce = (GeminiClientException) e.getCause();
                    assertThat(gce.getKind()).isEqualTo(GeminiClientException.Kind.RESPONSE_TOO_LARGE);
                    assertThat(gce.isRetryable()).isFalse();
                });
    }

    @Test
    @DisplayName("Single chunk exceeding cap on first onNext cancels immediately")
    void singleChunkExceedingCapCancelsImmediately() {
        int cap = 50;
        BoundedBodySubscriber subscriber = new BoundedBodySubscriber(cap);
        TestSubscription subscription = new TestSubscription();
        subscriber.onSubscribe(subscription);

        subscriber.onNext(List.of(ByteBuffer.wrap(new byte[51])));

        assertThat(subscription.cancelled).isTrue();
        CompletableFuture<byte[]> stage = subscriber.getBody().toCompletableFuture();
        assertThat(stage.isCompletedExceptionally()).isTrue();
    }

    @Test
    @DisplayName("Empty response completes with 0-length byte array")
    void emptyResponseCompletesNormally() throws Exception {
        BoundedBodySubscriber subscriber = new BoundedBodySubscriber(100);
        TestSubscription subscription = new TestSubscription();
        subscriber.onSubscribe(subscription);
        subscriber.onComplete();

        CompletableFuture<byte[]> stage = subscriber.getBody().toCompletableFuture();
        assertThat(stage.isDone()).isTrue();
        assertThat(stage.get()).isEmpty();
    }

    @Test
    @DisplayName("onError completes stage exceptionally")
    void onErrorCompletesExceptionally() {
        BoundedBodySubscriber subscriber = new BoundedBodySubscriber(100);
        TestSubscription subscription = new TestSubscription();
        subscriber.onSubscribe(subscription);

        RuntimeException upstreamError = new RuntimeException("Upstream failed");
        subscriber.onError(upstreamError);

        CompletableFuture<byte[]> stage = subscriber.getBody().toCompletableFuture();
        assertThat(stage.isCompletedExceptionally()).isTrue();
        assertThatThrownBy(stage::get)
                .isInstanceOf(ExecutionException.class)
                .hasCause(upstreamError);
    }

    @Test
    @DisplayName("onNext with multiple ByteBuffers in single list within cap joins all buffers (P2)")
    void onNextWithMultipleByteBuffersInSingleListWithinCap() throws Exception {
        BoundedBodySubscriber subscriber = new BoundedBodySubscriber(100);
        TestSubscription subscription = new TestSubscription();
        subscriber.onSubscribe(subscription);

        ByteBuffer b1 = ByteBuffer.wrap("Hello ".getBytes(StandardCharsets.UTF_8));
        ByteBuffer b2 = ByteBuffer.wrap("brave ".getBytes(StandardCharsets.UTF_8));
        ByteBuffer b3 = ByteBuffer.wrap("world".getBytes(StandardCharsets.UTF_8));

        subscriber.onNext(List.of(b1, b2, b3));
        subscriber.onComplete();

        CompletableFuture<byte[]> stage = subscriber.getBody().toCompletableFuture();
        assertThat(stage.isDone()).isTrue();
        assertThat(new String(stage.get(), StandardCharsets.UTF_8)).isEqualTo("Hello brave world");
        assertThat(subscription.cancelled).isFalse();
    }

    @Test
    @DisplayName("onNext with multiple ByteBuffers where second buffer exceeds cap cancels subscription immediately (P2)")
    void onNextWithMultipleByteBuffersWhereSecondExceedsCapCancelsImmediately() {
        BoundedBodySubscriber subscriber = new BoundedBodySubscriber(50);
        TestSubscription subscription = new TestSubscription();
        subscriber.onSubscribe(subscription);

        ByteBuffer b1 = ByteBuffer.wrap(new byte[30]);
        ByteBuffer b2 = ByteBuffer.wrap(new byte[30]); // 30 + 30 = 60 > 50

        subscriber.onNext(List.of(b1, b2));

        assertThat(subscription.cancelled).isTrue();
        CompletableFuture<byte[]> stage = subscriber.getBody().toCompletableFuture();
        assertThat(stage.isCompletedExceptionally()).isTrue();
        assertThatThrownBy(stage::get)
                .isInstanceOf(ExecutionException.class)
                .hasCauseInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException gce = (GeminiClientException) e.getCause();
                    assertThat(gce.getKind()).isEqualTo(GeminiClientException.Kind.RESPONSE_TOO_LARGE);
                });
    }
}
