package com.multilingo.backend.modules.testing.ai.gemini;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GeminiHttpContractTest {

    private HttpServer server;
    private int port;
    private HttpClient httpClient;
    private GeminiProperties properties;
    private GeminiPayloadCodec codec;
    private HttpGeminiClient client;
    private ExecutorService serverExecutor;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        serverExecutor = Executors.newCachedThreadPool();
        server.setExecutor(serverExecutor);
        port = server.getAddress().getPort();
        server.start();

        httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();

        properties = new GeminiProperties();
        properties.setEnabled(true);
        properties.setApiKey("test-loopback-api-key");
        properties.setModel("gemini-1.5-flash");
        properties.setRequestTimeout(Duration.ofSeconds(2));

        codec = new GeminiPayloadCodec();

        URI endpointUri = URI.create("http://127.0.0.1:" + port + "/v1beta/models/gemini-1.5-flash:generateContent");
        client = new HttpGeminiClient(httpClient, endpointUri, properties, codec);
    }

    @AfterEach
    void tearDown() {
        if (server != null) {
            server.stop(0);
        }
        if (serverExecutor != null) {
            serverExecutor.shutdownNow();
        }
        if (httpClient != null) {
            httpClient.shutdownNow();
        }
    }

    @Test
    @DisplayName("Loopback integration: successful TEXT generation verifies HTTP contract and parses response")
    void successfulGenerationText() {
        AtomicReference<String> receivedApiKey = new AtomicReference<>();
        AtomicReference<String> receivedContentType = new AtomicReference<>();
        AtomicReference<String> receivedAccept = new AtomicReference<>();
        AtomicReference<String> receivedMethod = new AtomicReference<>();
        AtomicReference<String> receivedQuery = new AtomicReference<>();
        AtomicReference<String> receivedPath = new AtomicReference<>();

        String responseBody = """
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [
                          { "text": "Loopback generated answer" }
                        ]
                      },
                      "finishReason": "STOP"
                    }
                  ],
                  "usageMetadata": {
                    "promptTokenCount": 15,
                    "candidatesTokenCount": 25,
                    "totalTokenCount": 40
                  }
                }
                """;

        server.createContext("/v1beta/models/gemini-1.5-flash:generateContent", exchange -> {
            receivedMethod.set(exchange.getRequestMethod());
            receivedApiKey.set(exchange.getRequestHeaders().getFirst("x-goog-api-key"));
            receivedContentType.set(exchange.getRequestHeaders().getFirst("Content-Type"));
            receivedAccept.set(exchange.getRequestHeaders().getFirst("Accept"));
            receivedQuery.set(exchange.getRequestURI().getQuery());
            receivedPath.set(exchange.getRequestURI().getPath());

            // Consume request body
            try (InputStream is = exchange.getRequestBody()) {
                is.readAllBytes();
            }

            byte[] bytes = responseBody.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });

        GeminiGenerationRequest request = new GeminiGenerationRequest(
                "System instruction",
                "User prompt text",
                1024,
                GeminiGenerationRequest.OutputFormat.TEXT
        );

        GeminiGenerationResult result = client.generate(request);

        assertThat(result.text()).isEqualTo("Loopback generated answer");
        assertThat(result.usage()).isNotNull();
        assertThat(result.usage().promptTokens()).isEqualTo(15);
        assertThat(result.usage().candidateTokens()).isEqualTo(25);
        assertThat(result.usage().totalTokens()).isEqualTo(40);

        assertThat(receivedMethod.get()).isEqualTo("POST");
        assertThat(receivedApiKey.get()).isEqualTo("test-loopback-api-key");
        assertThat(receivedContentType.get()).isEqualTo("application/json");
        assertThat(receivedAccept.get()).isEqualTo("application/json");
        assertThat(receivedQuery.get()).isNull();
        assertThat(receivedPath.get()).isEqualTo("/v1beta/models/gemini-1.5-flash:generateContent");
    }

    @Test
    @DisplayName("Loopback integration: slow chunked body exceeding deadline triggers TIMEOUT and cancels")
    void slowChunkedBodyTimesOut() {
        properties.setRequestTimeout(Duration.ofMillis(300));
        URI endpointUri = URI.create("http://127.0.0.1:" + port + "/v1beta/models/gemini-1.5-flash:generateContent");
        HttpGeminiClient timeoutClient = new HttpGeminiClient(httpClient, endpointUri, properties, codec);

        server.createContext("/v1beta/models/gemini-1.5-flash:generateContent", exchange -> {
            try (InputStream is = exchange.getRequestBody()) {
                is.readAllBytes();
            }
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            // Chunked transfer
            exchange.sendResponseHeaders(200, 0);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write("{\"candi".getBytes(StandardCharsets.UTF_8));
                os.flush();
                // Sleep longer than requestTimeout
                Thread.sleep(1500);
                os.write("dates\":[]}".getBytes(StandardCharsets.UTF_8));
                os.flush();
            } catch (Exception ignored) {
            }
        });

        GeminiGenerationRequest request = new GeminiGenerationRequest(
                null,
                "Prompt",
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
    }

    @Test
    @DisplayName("Loopback integration: oversize response (>512KB) triggers RESPONSE_TOO_LARGE")
    void oversizeResponseBodyThrowsResponseTooLarge() {
        server.createContext("/v1beta/models/gemini-1.5-flash:generateContent", exchange -> {
            try (InputStream is = exchange.getRequestBody()) {
                is.readAllBytes();
            }
            int oversizeBytes = 524_288 + 10;
            byte[] largePayload = new byte[oversizeBytes];
            for (int i = 0; i < oversizeBytes; i++) {
                largePayload[i] = (byte) 'A';
            }
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, largePayload.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(largePayload);
            }
        });

        GeminiGenerationRequest request = new GeminiGenerationRequest(
                null,
                "Prompt",
                1024,
                GeminiGenerationRequest.OutputFormat.TEXT
        );

        assertThatThrownBy(() -> client.generate(request))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.RESPONSE_TOO_LARGE);
                    assertThat(ex.isRetryable()).isFalse();
                });
    }

    @Test
    @DisplayName("Loopback integration: malformed JSON response triggers INVALID_RESPONSE without leaking raw body")
    void malformedJsonResponseBodyThrowsInvalidResponse() {
        server.createContext("/v1beta/models/gemini-1.5-flash:generateContent", exchange -> {
            try (InputStream is = exchange.getRequestBody()) {
                is.readAllBytes();
            }
            byte[] bytes = "INVALID_JSON_PAYLOAD_BODY_xyz{{{".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });

        GeminiGenerationRequest request = new GeminiGenerationRequest(
                null,
                "Prompt",
                1024,
                GeminiGenerationRequest.OutputFormat.TEXT
        );

        assertThatThrownBy(() -> client.generate(request))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE);
                    assertThat(ex.isRetryable()).isFalse();
                    assertThat(ex.getMessage()).doesNotContain("INVALID_JSON_PAYLOAD_BODY_xyz");
                });
    }

    @ParameterizedTest(name = "Loopback status {0} -> kind {1}, retryable {2}")
    @CsvSource({
            "401, AUTHENTICATION, false",
            "403, AUTHENTICATION, false",
            "408, TIMEOUT, true",
            "429, RATE_LIMITED, true",
            "500, UPSTREAM, true",
            "503, UPSTREAM, true"
    })
    @DisplayName("Loopback integration: provider HTTP error statuses map safely without leaking body")
    void errorHttpStatusesCategorizedSafely(int status, GeminiClientException.Kind expectedKind, boolean expectedRetryable) {
        server.createContext("/v1beta/models/gemini-1.5-flash:generateContent", exchange -> {
            try (InputStream is = exchange.getRequestBody()) {
                is.readAllBytes();
            }
            byte[] bytes = "{\"error\": {\"message\": \"RAW_SECRET_ERROR_FROM_PROVIDER\"}}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });

        GeminiGenerationRequest request = new GeminiGenerationRequest(
                null,
                "Prompt",
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
                    assertThat(ex.getMessage()).doesNotContain("RAW_SECRET_ERROR_FROM_PROVIDER");
                });
    }

    @Test
    @DisplayName("Loopback integration: two concurrent calls do not cross-talk or mix responses")
    void concurrentCallsDoNotInterfereOrCrossTalk() throws Exception {
        server.createContext("/v1beta/models/gemini-1.5-flash:generateContent", exchange -> {
            String requestBody;
            try (InputStream is = exchange.getRequestBody()) {
                requestBody = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            }

            String answerText;
            if (requestBody.contains("PROMPT_ALPHA")) {
                answerText = "RESPONSE_FOR_ALPHA";
            } else {
                answerText = "RESPONSE_FOR_BETA";
            }

            String json = """
                    {
                      "candidates": [
                        {
                          "content": { "parts": [ { "text": "%s" } ] },
                          "finishReason": "STOP"
                        }
                      ]
                    }
                    """.formatted(answerText);

            byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });

        GeminiGenerationRequest requestAlpha = new GeminiGenerationRequest(
                null, "PROMPT_ALPHA", 1024, GeminiGenerationRequest.OutputFormat.TEXT
        );
        GeminiGenerationRequest requestBeta = new GeminiGenerationRequest(
                null, "PROMPT_BETA", 1024, GeminiGenerationRequest.OutputFormat.TEXT
        );

        ExecutorService testExecutor = Executors.newFixedThreadPool(2);
        try {
            CompletableFuture<GeminiGenerationResult> futureAlpha = CompletableFuture.supplyAsync(
                    () -> client.generate(requestAlpha), testExecutor
            );
            CompletableFuture<GeminiGenerationResult> futureBeta = CompletableFuture.supplyAsync(
                    () -> client.generate(requestBeta), testExecutor
            );

            GeminiGenerationResult resultAlpha = futureAlpha.get(5, TimeUnit.SECONDS);
            GeminiGenerationResult resultBeta = futureBeta.get(5, TimeUnit.SECONDS);

            assertThat(resultAlpha.text()).isEqualTo("RESPONSE_FOR_ALPHA");
            assertThat(resultBeta.text()).isEqualTo("RESPONSE_FOR_BETA");
        } finally {
            testExecutor.shutdownNow();
        }
    }
}
