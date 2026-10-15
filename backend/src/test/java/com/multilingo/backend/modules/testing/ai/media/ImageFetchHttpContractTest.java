package com.multilingo.backend.modules.testing.ai.media;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import java.net.InetSocketAddress;
import java.time.Duration;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ImageFetchHttpContractTest {
    private HttpServer server;
    private ExecutorService workers;
    private String base;

    @BeforeEach void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        workers = Executors.newVirtualThreadPerTaskExecutor();
        server.setExecutor(workers);
        server.start();
        base = "http://127.0.0.1:" + server.getAddress().getPort();
    }
    @AfterEach void stop() { server.stop(0); workers.shutdownNow(); }

    @Test void realTransportReadsImageAndNeverFollowsRedirect() throws Exception {
        var requests = new AtomicInteger();
        var image = ImageFixtures.png();
        server.createContext("/image", exchange -> {
            requests.incrementAndGet();
            assertThat(exchange.getRequestMethod()).isEqualTo("GET");
            for (String header : List.of("x-goog-api-key", "Authorization", "Cookie")) {
                assertThat(exchange.getRequestHeaders().getFirst(header)).isNull();
            }
            exchange.getResponseHeaders().set("Content-Type", "image/png");
            exchange.sendResponseHeaders(200, image.length);
            try (var output = exchange.getResponseBody()) { output.write(image); }
        });
        var second = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var redirected = new AtomicInteger();
        second.createContext("/leak", exchange -> { redirected.incrementAndGet(); exchange.sendResponseHeaders(204, -1); exchange.close(); });
        second.start();
        server.createContext("/redirect", exchange -> {
            exchange.getResponseHeaders().set("Location", "http://127.0.0.1:" + second.getAddress().getPort() + "/leak");
            exchange.sendResponseHeaders(302, -1);
            exchange.close();
        });
        try (var harness = new ImageFetcherHarness(Duration.ofSeconds(2))) {
            assertThat(harness.fetcher().fetch(base + "/image").data()).isEqualTo(image);
            assertThat(requests.get()).isEqualTo(1);
            assertThatThrownBy(() -> harness.fetcher().fetch(base + "/redirect"))
                    .isInstanceOfSatisfying(ImageFetchException.class,
                            e -> assertThat(e.getKind()).isEqualTo(ImageFetchException.Kind.REDIRECT_REJECTED));
            assertThat(redirected.get()).isZero();
        } finally { second.stop(0); }
    }

    @Test void realBodyStallsAfterHeadersAndExpiresWithinBudget() {
        server.createContext("/slow", exchange -> {
            exchange.getResponseHeaders().set("Content-Type", "image/png");
            exchange.sendResponseHeaders(200, 0);
            try (var output = exchange.getResponseBody()) {
                output.write(ImageFixtures.png(), 0, 8);
                output.flush();
                new CountDownLatch(1).await();
            } catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); }
            catch (java.io.IOException cancelled) { /* Client cancellation is expected. */ }
        });
        try (var harness = new ImageFetcherHarness(Duration.ofMillis(150))) {
            assertThatThrownBy(() -> harness.fetcher().fetch(base + "/slow"))
                    .isInstanceOfSatisfying(ImageFetchException.class,
                            e -> assertThat(e.getKind()).isEqualTo(ImageFetchException.Kind.TIMEOUT));
        }
    }

    @Test void overlappingFailureAndSuccessStayIndependent() throws Exception {
        var overlap = new CountDownLatch(2);
        server.createContext("/parallel", exchange -> {
            overlap.countDown();
            try {
                if (!overlap.await(2, TimeUnit.SECONDS)) throw new AssertionError("Calls did not overlap");
                boolean failure = exchange.getRequestURI().getQuery().equals("fail");
                byte[] bytes = failure ? "SECRET_ERROR_BODY".getBytes() : ImageFixtures.png();
                exchange.getResponseHeaders().set("Content-Type", "image/png");
                exchange.sendResponseHeaders(failure ? 429 : 200, bytes.length);
                try (var output = exchange.getResponseBody()) { output.write(bytes); }
            } catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); exchange.close(); }
        });
        try (var harness = new ImageFetcherHarness(Duration.ofSeconds(3));
             var callers = Executors.newVirtualThreadPerTaskExecutor()) {
            Future<byte[]> good = callers.submit(() -> harness.fetcher().fetch(base + "/parallel?ok").data());
            Future<ImageFetchException.Kind> bad = callers.submit(() -> {
                try { harness.fetcher().fetch(base + "/parallel?fail"); throw new AssertionError("Expected rate limit"); }
                catch (ImageFetchException error) { return error.getKind(); }
            });
            assertThat(good.get(4, TimeUnit.SECONDS)).isEqualTo(ImageFixtures.png());
            assertThat(bad.get(4, TimeUnit.SECONDS)).isEqualTo(ImageFetchException.Kind.RATE_LIMITED);
        }
    }

    @Test void streamedExactCapAndCapPlusOneUseActualChunkBytes() {
        for (boolean extra : new boolean[]{false,true}) {
            var subscription = mock(java.util.concurrent.Flow.Subscription.class);
            var subscriber = new BoundedByteBodySubscriber(2_097_152,
                    () -> new ImageFetchException(ImageFetchException.Kind.TOO_LARGE));
            subscriber.onSubscribe(subscription);
            subscriber.onNext(List.of(ByteBuffer.wrap(new byte[1_048_576]), ByteBuffer.wrap(new byte[1_048_576])));
            if (extra) subscriber.onNext(List.of(ByteBuffer.wrap(new byte[1])));
            subscriber.onComplete();
            if (extra) {
                assertThatThrownBy(() -> subscriber.getBody().toCompletableFuture().join())
                        .hasCauseInstanceOf(ImageFetchException.class);
                verify(subscription).cancel();
            } else {
                assertThat(subscriber.getBody().toCompletableFuture().join()).hasSize(2_097_152);
                verify(subscription, never()).cancel();
            }
        }
    }
}
