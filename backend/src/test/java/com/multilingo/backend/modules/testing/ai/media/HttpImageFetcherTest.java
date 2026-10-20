package com.multilingo.backend.modules.testing.ai.media;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.net.InetAddress;
import java.net.http.*;
import java.nio.ByteBuffer;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;

class HttpImageFetcherTest {
    private static final String URL = "https://cdn.example.test/cloud/image.png?sig=SECRET_URL";

    @Test void rejectsNonIdentityEncodingEvenWhenItIsNotTheFirstHeader() throws Exception {
        try (var fixture = new Fixture()) {
            fixture.reply(200, Map.of("Content-Type", List.of("image/png"),
                    "Content-Encoding", List.of("identity", "gzip")), ImageFixtures.png(), false);
            assertThatThrownBy(() -> fixture.fetcher().fetch(URL))
                    .isInstanceOfSatisfying(ImageFetchException.class,
                            e -> assertThat(e.getKind()).isEqualTo(ImageFetchException.Kind.UNSUPPORTED_TYPE));
        }
    }

    @Test void interruptionAfterHttpDispatchCancelsFutureAndBodyAndPreservesFlag() throws Exception {
        try (var fixture = new Fixture()) {
            fixture.reply(200, Map.of("Content-Type", List.of("image/png")), new byte[0], true);
            var kind = new AtomicReference<ImageFetchException.Kind>();
            var flag = new java.util.concurrent.atomic.AtomicBoolean();
            Thread caller = Thread.ofPlatform().start(() -> {
                try { fixture.fetcher().fetch(URL); }
                catch (ImageFetchException error) { kind.set(error.getKind()); flag.set(Thread.currentThread().isInterrupted()); }
            });
            assertThat(fixture.dispatched.await(2, TimeUnit.SECONDS)).isTrue();
            caller.interrupt();
            caller.join(2_000);
            assertThat(caller.isAlive()).isFalse();
            assertThat(kind.get()).isEqualTo(ImageFetchException.Kind.INTERRUPTED);
            assertThat(flag.get()).isTrue();
            assertThat(fixture.future.get().isCancelled()).isTrue();
            verify(fixture.subscription).cancel();
        }
    }

    @Test void validatesBeforeNetworkAndDoesNotUseCredentials() throws Exception {
        try (var fixture = new Fixture()) {
            fixture.reply(200, Map.of("Content-Type", List.of("image/png")), ImageFixtures.png(), false);
            var fetched = fixture.fetcher().fetch(URL);
            assertThat(fetched.data()).isEqualTo(ImageFixtures.png());
            var request = fixture.request.get();
            assertThat(request.method()).isEqualTo("GET");
            assertThat(request.uri().getRawQuery()).isEqualTo("sig=SECRET_URL");
            assertThat(request.headers().firstValue("Accept")).hasValue("image/png, image/jpeg, image/webp");
            for (String name : List.of("x-goog-api-key", "Authorization", "Cookie")) {
                assertThat(request.headers().firstValue(name)).isEmpty();
            }
            assertThatThrownBy(() -> fixture.fetcher().fetch("https://evil.test/cloud/a"))
                    .isInstanceOf(ImageFetchException.class);
            verify(fixture.http, times(1)).sendAsync(any(), any());
        }
    }

    @ParameterizedTest
    @CsvSource({"302,REDIRECT_REJECTED,false", "404,UPSTREAM_NOT_FOUND,false", "410,UPSTREAM_NOT_FOUND,false",
            "403,UPSTREAM_REJECTED,false", "400,UPSTREAM_REJECTED,false", "408,TIMEOUT,true",
            "429,RATE_LIMITED,true", "500,UPSTREAM,true", "503,UPSTREAM,true", "204,INVALID_CONTENT,false"})
    void mapsStatusesWithoutReadingErrorBodies(int status, String kind, boolean retryable) throws Exception {
        try (var fixture = new Fixture()) {
            fixture.reply(status, Map.of(), "SECRET_UPSTREAM_BODY".getBytes(), false);
            assertThatThrownBy(() -> fixture.fetcher().fetch(URL)).isInstanceOfSatisfying(ImageFetchException.class, e -> {
                assertThat(e.getKind().name()).isEqualTo(kind);
                assertThat(e.getUpstreamStatus()).isEqualTo(status);
                assertThat(e.isRetryable()).isEqualTo(retryable);
                assertThat(e.getMessage()).doesNotContain("SECRET");
                assertThat(e.getCause()).isNull();
            });
            verify(fixture.subscription).cancel();
            verify(fixture.http).sendAsync(any(), any());
        }
    }

    @Test void rejectsInternalAndUnresolvableDnsBeforeDispatch() throws Exception {
        try (var fixture = new Fixture()) {
            assertThatThrownBy(() -> fixture.fetcher(host -> new InetAddress[]{InetAddress.getByName("127.0.0.1")})
                    .fetch(URL)).isInstanceOfSatisfying(ImageFetchException.class,
                    e -> assertThat(e.getKind()).isEqualTo(ImageFetchException.Kind.ADDRESS_REJECTED));
            assertThatThrownBy(() -> fixture.fetcher(host -> { throw new java.net.UnknownHostException("SECRET_URL"); })
                    .fetch(URL)).isInstanceOfSatisfying(ImageFetchException.class, e -> {
                        assertThat(e.getKind()).isEqualTo(ImageFetchException.Kind.ADDRESS_REJECTED);
                        assertThat(e.toString()).doesNotContain("SECRET_URL");
                    });
            verify(fixture.http, never()).sendAsync(any(), any());
        }
    }

    @Test void deadlineIncludesDnsAndDoesNotDispatchAfterItExpires() throws Exception {
        try (var fixture = new Fixture()) {
            fixture.timeout = Duration.ofMillis(40);
            assertThatThrownBy(() -> fixture.fetcher(host -> {
                try { new CountDownLatch(1).await(); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                return new InetAddress[]{InetAddress.getByName("203.0.113.10")};
            }).fetch(URL)).isInstanceOfSatisfying(ImageFetchException.class,
                    e -> assertThat(e.getKind()).isEqualTo(ImageFetchException.Kind.TIMEOUT));
            verify(fixture.http, never()).sendAsync(any(), any());
        }
    }

    @Test void bodyDeadlineCancelsSubscriptionAndIgnoresLateCompletion() throws Exception {
        try (var fixture = new Fixture()) {
            fixture.timeout = Duration.ofMillis(60);
            fixture.reply(200, Map.of("Content-Type", List.of("image/png")), new byte[0], true);
            assertThatThrownBy(() -> fixture.fetcher().fetch(URL)).isInstanceOfSatisfying(ImageFetchException.class,
                    e -> assertThat(e.getKind()).isEqualTo(ImageFetchException.Kind.TIMEOUT));
            assertThat(fixture.future.get().isCancelled()).isTrue();
            verify(fixture.subscription).cancel();
            fixture.subscriber.get().onNext(List.of(ByteBuffer.wrap(ImageFixtures.png())));
            fixture.subscriber.get().onComplete();
            assertThat(fixture.future.get().isCancelled()).isTrue();
            verify(fixture.http).sendAsync(any(), any());
        }
    }

    @Test void interruptionRestoresFlagAndCancelsRequest() throws Exception {
        try (var fixture = new Fixture()) {
            fixture.reply(200, Map.of("Content-Type", List.of("image/png")), new byte[0], true);
            Thread.currentThread().interrupt();
            try {
                assertThatThrownBy(() -> fixture.fetcher().fetch(URL)).isInstanceOfSatisfying(ImageFetchException.class,
                        e -> assertThat(e.getKind()).isEqualTo(ImageFetchException.Kind.INTERRUPTED));
                assertThat(Thread.currentThread().isInterrupted()).isTrue();
            } finally { Thread.interrupted(); }
        }
    }

    @Test void rejectsEncodingDeclaredOversizeAndActualOversize() throws Exception {
        for (var headers : List.of(Map.of("Content-Encoding", List.of("gzip")),
                Map.of("Content-Length", List.of("2097153")), Map.<String,List<String>>of())) {
            try (var fixture = new Fixture()) {
                fixture.reply(200, headers, new byte[2_097_153], false);
                assertThatThrownBy(() -> fixture.fetcher().fetch(URL)).isInstanceOf(ImageFetchException.class);
                verify(fixture.subscription).cancel();
            }
        }
    }

    static final class Fixture implements AutoCloseable {
        final HttpClient http = mock(HttpClient.class);
        final ExecutorService resolver = Executors.newVirtualThreadPerTaskExecutor();
        final java.util.concurrent.Flow.Subscription subscription = mock(java.util.concurrent.Flow.Subscription.class);
        final AtomicReference<HttpRequest> request = new AtomicReference<>();
        final AtomicReference<HttpResponse.BodySubscriber<byte[]>> subscriber = new AtomicReference<>();
        final AtomicReference<CompletableFuture<HttpResponse<byte[]>>> future = new AtomicReference<>();
        final CountDownLatch dispatched = new CountDownLatch(1);
        Duration timeout = Duration.ofSeconds(1);

        HttpImageFetcher fetcher() { return fetcher(host -> new InetAddress[]{InetAddress.getByName("203.0.113.10")}); }
        HttpImageFetcher fetcher(ImageAddressPolicy.Resolver dns) {
            var settings = new ImageFetchProperties.Settings(Duration.ofMillis(1), timeout,
                    new ImageUrlPolicy(List.of("https://cdn.example.test/cloud/")));
            return new HttpImageFetcher(http, settings, new ImageAddressPolicy(), dns, resolver);
        }

        @SuppressWarnings("unchecked")
        void reply(int status, Map<String,List<String>> headers, byte[] body, boolean hang) {
            when(http.sendAsync(any(), any())).thenAnswer(call -> {
                request.set(call.getArgument(0));
                HttpResponse.BodyHandler<byte[]> handler = call.getArgument(1);
                var info = mock(HttpResponse.ResponseInfo.class);
                when(info.statusCode()).thenReturn(status);
                when(info.headers()).thenReturn(HttpHeaders.of(headers, (k,v) -> true));
                var sub = handler.apply(info);
                subscriber.set(sub);
                sub.onSubscribe(subscription);
                if (!hang) {
                    sub.onNext(List.of(ByteBuffer.wrap(body)));
                    sub.onComplete();
                }
                CompletableFuture<HttpResponse<byte[]>> result = sub.getBody().toCompletableFuture().thenApply(bytes -> {
                    HttpResponse<byte[]> response = mock(HttpResponse.class);
                    when(response.statusCode()).thenReturn(status);
                    when(response.headers()).thenReturn(HttpHeaders.of(headers, (k,v) -> true));
                    when(response.body()).thenReturn(bytes);
                    return response;
                });
                future.set(result);
                dispatched.countDown();
                return result;
            });
        }
        public void close() { resolver.shutdownNow(); }
    }
}
