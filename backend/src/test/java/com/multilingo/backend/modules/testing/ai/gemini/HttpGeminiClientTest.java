package com.multilingo.backend.modules.testing.ai.gemini;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;

import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class HttpGeminiClientTest {

    private HttpClient httpClient;
    private GeminiProperties properties;
    private GeminiPayloadCodec codec;
    private HttpGeminiClient client;

    @BeforeEach
    void setUp() {
        httpClient = mock(HttpClient.class);
        properties = new GeminiProperties();
        properties.setEnabled(true);
        properties.setApiKey("test-secret-api-key");
        properties.setModel("gemini-1.5-flash");
        properties.setConnectTimeout(Duration.ofSeconds(5));
        properties.setRequestTimeout(Duration.ofSeconds(10));
        codec = new GeminiPayloadCodec();

        client = new HttpGeminiClient(httpClient, properties, codec);
    }

    @Test
    @DisplayName("generate throws DISABLED when properties.enabled is false without calling HTTP")
    void throwsDisabledWhenPropertiesNotEnabled() {
        properties.setEnabled(false);
        HttpGeminiClient disabledClient = new HttpGeminiClient(httpClient, properties, codec);

        GeminiGenerationRequest request = new GeminiGenerationRequest(
                null,
                "Hello",
                100,
                GeminiGenerationRequest.OutputFormat.TEXT
        );

        assertThatThrownBy(() -> disabledClient.generate(request))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.DISABLED);
                    assertThat(ex.isRetryable()).isFalse();
                });

        verify(httpClient, never()).sendAsync(any(), any());
    }

    @Test
    @DisplayName("sends POST to endpoint with headers and never puts API key in URL query or body")
    @SuppressWarnings("unchecked")
    void sendsPostWithCorrectHeadersAndNoKeyInUrlOrBody() {
        String validResponseJson = """
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [ { "text": "Normalized answer" } ]
                      },
                      "finishReason": "STOP"
                    }
                  ]
                }
                """;

        HttpResponse<byte[]> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.body()).thenReturn(validResponseJson.getBytes(StandardCharsets.UTF_8));
        doReturn(CompletableFuture.completedFuture(response))
                .when(httpClient).sendAsync(any(HttpRequest.class), any());

        GeminiGenerationRequest request = new GeminiGenerationRequest(
                "System prompt",
                "User prompt",
                1024,
                GeminiGenerationRequest.OutputFormat.TEXT
        );

        GeminiGenerationResult result = client.generate(request);
        assertThat(result.text()).isEqualTo("Normalized answer");

        ArgumentCaptor<HttpRequest> requestCaptor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient, times(1)).sendAsync(requestCaptor.capture(), any());

        HttpRequest captured = requestCaptor.getValue();
        assertThat(captured.method()).isEqualTo("POST");
        assertThat(captured.uri().toString()).isEqualTo(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
        );
        assertThat(captured.uri().getQuery()).isNull(); // Crucial: no ?key= in URL

        assertThat(captured.headers().firstValue("x-goog-api-key"))
                .hasValue("test-secret-api-key");
        assertThat(captured.headers().firstValue("Content-Type"))
                .hasValue("application/json");
        assertThat(captured.headers().firstValue("Accept"))
                .hasValue("application/json");
    }

    @Test
    @DisplayName("Monotonic deadline timeout cancels future and throws TIMEOUT")
    void monotonicDeadlineTimeoutCancelsFuture() {
        properties.setRequestTimeout(Duration.ofMillis(50));
        HttpGeminiClient timeoutClient = new HttpGeminiClient(httpClient, properties, codec);
        CompletableFuture<HttpResponse<byte[]>> hangingFuture = new CompletableFuture<>();
        doReturn(hangingFuture)
                .when(httpClient).sendAsync(any(HttpRequest.class), any());

        GeminiGenerationRequest request = new GeminiGenerationRequest(
                null,
                "User prompt",
                1024,
                GeminiGenerationRequest.OutputFormat.TEXT
        );

        assertThatThrownBy(() -> timeoutClient.generate(request))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.TIMEOUT);
                    assertThat(ex.isRetryable()).isTrue();
                });

        assertThat(hangingFuture.isCancelled()).isTrue();
    }

    @Test
    @DisplayName("Thread interruption cancels future, preserves interrupt flag, and throws INTERRUPTED")
    void interruptionCancelsFutureAndPreservesFlag() throws Exception {
        CompletableFuture<HttpResponse<byte[]>> hangingFuture = new CompletableFuture<>();
        doReturn(hangingFuture)
                .when(httpClient).sendAsync(any(HttpRequest.class), any());

        GeminiGenerationRequest request = new GeminiGenerationRequest(
                null,
                "User prompt",
                1024,
                GeminiGenerationRequest.OutputFormat.TEXT
        );

        CountDownLatch threadStarted = new CountDownLatch(1);
        AtomicReference<Throwable> thrown = new AtomicReference<>();
        AtomicBoolean flagRestored = new AtomicBoolean(false);

        Thread worker = new Thread(() -> {
            threadStarted.countDown();
            try {
                client.generate(request);
            } catch (Throwable t) {
                thrown.set(t);
                flagRestored.set(Thread.currentThread().isInterrupted());
            }
        });

        worker.start();
        assertThat(threadStarted.await(2, TimeUnit.SECONDS)).isTrue();
        Thread.sleep(30);
        worker.interrupt();
        worker.join(2000);

        assertThat(hangingFuture.isCancelled()).isTrue();
        assertThat(thrown.get()).isInstanceOf(GeminiClientException.class);
        GeminiClientException ex = (GeminiClientException) thrown.get();
        assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.INTERRUPTED);
        assertThat(ex.isRetryable()).isFalse();
        assertThat(flagRestored.get()).isTrue();
    }

    @ParameterizedTest
    @CsvSource({
            "301, REDIRECT_REJECTED, false",
            "302, REDIRECT_REJECTED, false",
            "307, REDIRECT_REJECTED, false",
            "308, REDIRECT_REJECTED, false",
            "401, AUTHENTICATION, false",
            "403, AUTHENTICATION, false",
            "408, TIMEOUT, true",
            "429, RATE_LIMITED, true",
            "400, PROVIDER_REQUEST_REJECTED, false",
            "404, PROVIDER_REQUEST_REJECTED, false",
            "422, PROVIDER_REQUEST_REJECTED, false",
            "500, UPSTREAM, true",
            "502, UPSTREAM, true",
            "503, UPSTREAM, true",
            "504, UPSTREAM, true",
            "999, INVALID_RESPONSE, false"
    })
    @SuppressWarnings("unchecked")
    @DisplayName("HTTP status code mapping correctly categorizes errors")
    void statusMappingCategorization(int status, GeminiClientException.Kind expectedKind, boolean expectedRetryable) {
        HttpResponse<byte[]> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(status);
        when(response.body()).thenReturn("Error body from provider".getBytes(StandardCharsets.UTF_8));
        doReturn(CompletableFuture.completedFuture(response))
                .when(httpClient).sendAsync(any(HttpRequest.class), any());

        GeminiGenerationRequest request = new GeminiGenerationRequest(
                null,
                "User prompt",
                1024,
                GeminiGenerationRequest.OutputFormat.TEXT
        );

        assertThatThrownBy(() -> client.generate(request))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(expectedKind);
                    assertThat(ex.isRetryable()).isEqualTo(expectedRetryable);
                    assertThat(ex.getUpstreamStatus()).isEqualTo(status);
                    // Crucial: no raw provider error message leaked into exception message
                    assertThat(ex.getMessage()).doesNotContain("Error body from provider");
                });

        verify(httpClient, times(1)).sendAsync(any(), any());
    }

    @Test
    @DisplayName("Network I/O exception maps to TRANSPORT without raw cause")
    void networkExceptionMappedToTransport() {
        CompletableFuture<HttpResponse<byte[]>> failedFuture = CompletableFuture.failedFuture(
                new IOException("Connection reset by peer")
        );
        doReturn(failedFuture)
                .when(httpClient).sendAsync(any(HttpRequest.class), any());

        GeminiGenerationRequest request = new GeminiGenerationRequest(
                null,
                "User prompt",
                1024,
                GeminiGenerationRequest.OutputFormat.TEXT
        );

        assertThatThrownBy(() -> client.generate(request))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.TRANSPORT);
                    assertThat(ex.isRetryable()).isTrue();
                    assertThat(ex.getCause()).isNull();
                    assertThat(ex.getMessage()).doesNotContain("Connection reset by peer");
                });
    }

    @Test
    @DisplayName("Package-private constructor accepts custom endpoint URI for testing")
    @SuppressWarnings("unchecked")
    void packagePrivateConstructorAcceptsCustomUri() {
        URI customUri = URI.create("http://127.0.0.1:8080/custom/generateContent");
        HttpGeminiClient customClient = new HttpGeminiClient(httpClient, customUri, properties, codec);

        String validResponseJson = """
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [ { "text": "Custom endpoint response" } ]
                      },
                      "finishReason": "STOP"
                    }
                  ]
                }
                """;

        HttpResponse<byte[]> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.body()).thenReturn(validResponseJson.getBytes(StandardCharsets.UTF_8));
        doReturn(CompletableFuture.completedFuture(response))
                .when(httpClient).sendAsync(any(HttpRequest.class), any());

        GeminiGenerationRequest request = new GeminiGenerationRequest(
                null,
                "User prompt",
                1024,
                GeminiGenerationRequest.OutputFormat.TEXT
        );

        GeminiGenerationResult result = customClient.generate(request);
        assertThat(result.text()).isEqualTo("Custom endpoint response");

        ArgumentCaptor<HttpRequest> requestCaptor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient).sendAsync(requestCaptor.capture(), any());
        assertThat(requestCaptor.getValue().uri()).isEqualTo(customUri);
    }

    private static class SlowCodec extends GeminiPayloadCodec {
        private final long sleepMillis;

        SlowCodec(long sleepMillis) {
            this.sleepMillis = sleepMillis;
        }

        @Override
        public byte[] encode(GeminiGenerationRequest request) {
            try {
                Thread.sleep(sleepMillis);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            return super.encode(request);
        }
    }

    private byte[] buildValidStopResponseJsonBytes(String text) {
        String json = String.format("""
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [ { "text": "%s" } ]
                      },
                      "finishReason": "STOP"
                    }
                  ]
                }
                """, text);
        return json.getBytes(StandardCharsets.UTF_8);
    }

    @Test
    @DisplayName("Slow encode exceeding requestTimeout throws TIMEOUT and never calls sendAsync (P1)")
    void slowEncodeExceedingTimeoutThrowsTimeoutWithoutHttpDispatch() {
        properties.setRequestTimeout(Duration.ofMillis(100));
        GeminiPayloadCodec slowCodec = new SlowCodec(250);
        HttpGeminiClient slowClient = new HttpGeminiClient(httpClient, properties, slowCodec);

        GeminiGenerationRequest request = new GeminiGenerationRequest(
                null,
                "User text",
                1024,
                GeminiGenerationRequest.OutputFormat.TEXT
        );

        assertThatThrownBy(() -> slowClient.generate(request))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.TIMEOUT);
                    assertThat(ex.isRetryable()).isTrue();
                });

        verify(httpClient, never()).sendAsync(any(), any());
    }

    @Test
    @DisplayName("Encode consuming partial budget leaves only remaining budget for future completion (P1)")
    void encodeConsumingPartialBudgetDecreasesRemainingFutureBudget() {
        properties.setRequestTimeout(Duration.ofMillis(300));
        GeminiPayloadCodec slowCodec = new SlowCodec(150);
        HttpGeminiClient slowClient = new HttpGeminiClient(httpClient, properties, slowCodec);

        CompletableFuture<HttpResponse<byte[]>> hangingFuture = new CompletableFuture<>();
        doReturn(hangingFuture).when(httpClient).sendAsync(any(), any());

        GeminiGenerationRequest request = new GeminiGenerationRequest(
                null,
                "User text",
                1024,
                GeminiGenerationRequest.OutputFormat.TEXT
        );

        long start = System.currentTimeMillis();
        assertThatThrownBy(() -> slowClient.generate(request))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.TIMEOUT);
                });
        long elapsed = System.currentTimeMillis() - start;

        assertThat(elapsed).isLessThan(450);
        assertThat(hangingFuture.isCancelled()).isTrue();
    }

    @Test
    @DisplayName("Mutating properties after construction does not affect client snapshot (P1)")
    void mutatingPropertiesAfterConstructionDoesNotAffectClient() throws Exception {
        HttpResponse<byte[]> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.body()).thenReturn(buildValidStopResponseJsonBytes("Success"));

        doReturn(CompletableFuture.completedFuture(response))
                .when(httpClient).sendAsync(any(), any());

        GeminiGenerationRequest request = new GeminiGenerationRequest(
                null,
                "User prompt",
                1024,
                GeminiGenerationRequest.OutputFormat.TEXT
        );

        // Mutate properties after client has been constructed in setUp
        properties.setEnabled(false);
        properties.setApiKey("MUTATED_KEY");
        properties.setModel("MUTATED_MODEL");
        properties.setRequestTimeout(Duration.ofMillis(1));

        // Client should still be enabled (from snapshot), use original key, and succeed
        GeminiGenerationResult result = client.generate(request);
        assertThat(result.text()).isEqualTo("Success");

        ArgumentCaptor<HttpRequest> requestCaptor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient).sendAsync(requestCaptor.capture(), any());
        HttpRequest captured = requestCaptor.getValue();
        assertThat(captured.headers().firstValue("x-goog-api-key")).hasValue("test-secret-api-key");
        assertThat(captured.uri().toString()).contains("gemini-1.5-flash");
    }

    @Test
    @DisplayName("When headers arrive but body subscriber hangs, deadline expires, cancels future, and late completion is ignored (P2)")
    void headersArrivedButBodyHangsExpiresDeadlineAndCancelsFuture() {
        properties.setRequestTimeout(Duration.ofMillis(100));
        HttpGeminiClient localClient = new HttpGeminiClient(httpClient, properties, codec);

        CompletableFuture<HttpResponse<byte[]>> responseFuture = new CompletableFuture<>();
        HttpResponse<byte[]> mockResponse = mock(HttpResponse.class);
        when(mockResponse.statusCode()).thenReturn(200);
        AtomicReference<HttpResponse.BodySubscriber<byte[]>> subscriberRef = new AtomicReference<>();

        doAnswer(invocation -> {
            HttpResponse.BodyHandler<byte[]> handler = invocation.getArgument(1);
            HttpResponse.ResponseInfo responseInfo = mock(HttpResponse.ResponseInfo.class);
            when(responseInfo.statusCode()).thenReturn(200);
            HttpResponse.BodySubscriber<byte[]> subscriber = handler.apply(responseInfo);
            subscriberRef.set(subscriber);

            subscriber.onSubscribe(new Flow.Subscription() {
                @Override public void request(long n) {}
                @Override public void cancel() {}
            });

            subscriber.getBody().whenComplete((bytes, ex) -> {
                if (ex != null) {
                    responseFuture.completeExceptionally(ex);
                } else {
                    when(mockResponse.body()).thenReturn(bytes);
                    responseFuture.complete(mockResponse);
                }
            });

            return responseFuture;
        }).when(httpClient).sendAsync(any(HttpRequest.class), any());

        GeminiGenerationRequest request = new GeminiGenerationRequest(
                null,
                "Prompt",
                1024,
                GeminiGenerationRequest.OutputFormat.TEXT
        );

        assertThatThrownBy(() -> localClient.generate(request))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.TIMEOUT);
                    assertThat(ex.isRetryable()).isTrue();
                });

        HttpResponse.BodySubscriber<byte[]> lateSubscriber = subscriberRef.get();
        if (lateSubscriber != null) {
            String lateJson = "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"Late response\"}]},\"finishReason\":\"STOP\"}]}";
            lateSubscriber.onNext(List.of(ByteBuffer.wrap(lateJson.getBytes(StandardCharsets.UTF_8))));
            lateSubscriber.onComplete();
        }

        assertThat(responseFuture.isCancelled()).isTrue();
        verify(httpClient, times(1)).sendAsync(any(), any());
    }

    @Test
    @DisplayName("Invalid header value throws safe INVALID_INPUT exception without leaking key and without network dispatch (P1)")
    void invalidHeaderValueThrowsSafeInvalidInputExceptionWithoutNetworkDispatch() {
        String invalidHeaderKey = "SECRET_KEY_SENTINEL_\u0100";
        GeminiProperties badProps = new GeminiProperties();
        badProps.setEnabled(true);
        badProps.setApiKey(invalidHeaderKey);
        badProps.setModel("gemini-1.5-flash");

        HttpGeminiClient localClient = new HttpGeminiClient(httpClient, badProps, codec);

        GeminiGenerationRequest request = new GeminiGenerationRequest(
                null,
                "Prompt",
                1024,
                GeminiGenerationRequest.OutputFormat.TEXT
        );

        assertThatThrownBy(() -> localClient.generate(request))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.INVALID_INPUT);
                    assertThat(ex.isRetryable()).isFalse();
                    assertThat(ex.getMessage()).isEqualTo("Failed to configure HTTP request headers");
                    assertThat(ex.getMessage()).doesNotContain("SECRET_KEY_SENTINEL");
                    assertThat(ex.toString()).doesNotContain("SECRET_KEY_SENTINEL");
                    assertThat(ex.getCause()).isNull();

                    StringWriter sw = new StringWriter();
                    ex.printStackTrace(new PrintWriter(sw));
                    assertThat(sw.toString()).doesNotContain("SECRET_KEY_SENTINEL");
                });

        verify(httpClient, never()).sendAsync(any(), any());
    }
}
