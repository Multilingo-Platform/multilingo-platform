package com.multilingo.backend.modules.testing.ai.gemini;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.common.exception.GlobalExceptionHandler;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.ResponseEntity;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@ExtendWith(OutputCaptureExtension.class)
class GeminiSecurityTest {

    @Test
    void r2ImageBytesAndBase64NeverLeakThroughProductionFailure(CapturedOutput output) {
        byte[] bytes = "PRIVATE_IMAGE_BYTES_SENTINEL".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        var image = new GeminiImagePart("image/png", bytes);
        var request = new GeminiGenerationRequest("PRIVATE_SYSTEM", "PRIVATE_ESSAY", 32,
                GeminiGenerationRequest.OutputFormat.JSON, java.util.List.of(image));
        var codec = new GeminiPayloadCodec();
        assertThat(codec.encode(request).length).isGreaterThan(bytes.length);
        String base64 = java.util.Base64.getEncoder().encodeToString(bytes);
        GeminiClientException error = null;
        try { codec.decode(("{PRIVATE_PROVIDER_BODY:" + base64).getBytes(java.nio.charset.StandardCharsets.UTF_8)); }
        catch (GeminiClientException safe) { error = safe; }
        assertThat(error).isNotNull();
        var response = new GlobalExceptionHandler().handleAppException(error);
        assertThat(response.getBody().getMessage()).doesNotContain(base64, "PRIVATE_PROVIDER_BODY");
        assertThat(image.toString() + request.toString() + output.getAll()).doesNotContain(base64,
                "PRIVATE_IMAGE_BYTES_SENTINEL", "PRIVATE_ESSAY", "PRIVATE_SYSTEM", "PRIVATE_PROVIDER_BODY");
    }

    private HttpServer primaryServer;
    private HttpServer secondaryServer;
    private HttpClient httpClient;

    @AfterEach
    void tearDown() {
        if (primaryServer != null) {
            primaryServer.stop(0);
        }
        if (secondaryServer != null) {
            secondaryServer.stop(0);
        }
        if (httpClient != null) {
            httpClient.shutdownNow();
        }
    }

    @Test
    @DisplayName("Security: 302 redirect is rejected; secondary server never contacted, API key never leaked")
    void redirectNeverFollowedAndNeverLeaksApiKeyToSecondaryServer() throws IOException {
        primaryServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        int primaryPort = primaryServer.getAddress().getPort();

        secondaryServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        int secondaryPort = secondaryServer.getAddress().getPort();

        AtomicBoolean secondaryContacted = new AtomicBoolean(false);

        secondaryServer.createContext("/leak", exchange -> {
            secondaryContacted.set(true);
            exchange.sendResponseHeaders(200, 0);
            exchange.close();
        });
        secondaryServer.start();

        primaryServer.createContext("/v1beta/models/gemini-1.5-flash:generateContent", exchange -> {
            try (InputStream is = exchange.getRequestBody()) {
                is.readAllBytes();
            }
            exchange.getResponseHeaders().set("Location", "http://127.0.0.1:" + secondaryPort + "/leak");
            exchange.sendResponseHeaders(302, -1);
            exchange.close();
        });
        primaryServer.start();

        httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();

        GeminiProperties properties = new GeminiProperties();
        properties.setEnabled(true);
        properties.setApiKey("SENTINEL_API_KEY_DO_NOT_LEAK");
        properties.setModel("gemini-1.5-flash");
        properties.setRequestTimeout(Duration.ofSeconds(2));

        GeminiPayloadCodec codec = new GeminiPayloadCodec();
        URI primaryUri = URI.create("http://127.0.0.1:" + primaryPort + "/v1beta/models/gemini-1.5-flash:generateContent");
        HttpGeminiClient client = new HttpGeminiClient(httpClient, primaryUri, properties, codec);

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
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.REDIRECT_REJECTED);
                    assertThat(ex.isRetryable()).isFalse();
                    assertThat(ex.getUpstreamStatus()).isEqualTo(302);
                });

        // Crucial security invariant: secondary server was NEVER contacted
        assertThat(secondaryContacted.get()).isFalse();
    }

    @Test
    @DisplayName("Security: Spring context startup and property validation with sentinel keys never leak into message, stack trace, or logs (P2)")
    void sentinelSecretsNeverLeakedInStartupFailureOrLogs(CapturedOutput output) {
        String sentinelApiKey = "REJECTED_SECRET_KEY_SENTINEL_99999_\u0100";

        // 1. Direct properties validation failure check
        GeminiProperties properties = new GeminiProperties();
        properties.setEnabled(true);
        properties.setApiKey(sentinelApiKey);
        properties.setModel("gemini-1.5-flash");

        assertThatThrownBy(properties::validate)
                .isInstanceOf(IllegalStateException.class)
                .satisfies(ex -> {
                    assertThat(ex.getMessage()).doesNotContain("SENTINEL_99999");
                    assertThat(ex.toString()).doesNotContain("SENTINEL_99999");

                    StringWriter sw = new StringWriter();
                    ex.printStackTrace(new PrintWriter(sw));
                    assertThat(sw.toString()).doesNotContain("SENTINEL_99999");
                });

        // 2. Real Spring application context startup failure check
        ApplicationContextRunner contextRunner = new ApplicationContextRunner()
                .withUserConfiguration(GeminiConfiguration.class)
                .withPropertyValues(
                        "testing.gemini.enabled=true",
                        "testing.gemini.api-key=" + sentinelApiKey,
                        "testing.gemini.model=gemini-1.5-flash"
                );

        contextRunner.run(context -> {
            assertThat(context).hasFailed();
            Throwable failure = context.getStartupFailure();
            assertThat(failure).isNotNull();

            StringWriter sw = new StringWriter();
            failure.printStackTrace(new PrintWriter(sw));
            assertThat(sw.toString()).doesNotContain("SENTINEL_99999");
            assertThat(failure.getMessage()).doesNotContain("SENTINEL_99999");

            // Verify captured logs do not contain the sentinel key
            assertThat(output.getAll()).doesNotContain("SENTINEL_99999");
        });
    }

    @Test
    @DisplayName("Security: GlobalExceptionHandler handling real production Gemini failures never leaks sentinels into response or logs (P2)")
    void sentinelSecretsNeverLeakedThroughGlobalExceptionHandlerFromProductionFailures(CapturedOutput output) throws IOException {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();

        // 1. Real production exception from GeminiPayloadCodec decoding malformed provider body with sentinel
        String sentinelBodySecret = "MALFORMED_PROVIDER_BODY_SENTINEL_SECRET_44444";
        String malformedJsonWithSentinel = "{\"candidates\": [{\"secret\": \"" + sentinelBodySecret + "\", \"finishReason\": \"STOP\"}]}";
        GeminiPayloadCodec codec = new GeminiPayloadCodec();

        GeminiClientException codecEx = null;
        try {
            codec.decode(malformedJsonWithSentinel.getBytes(StandardCharsets.UTF_8));
        } catch (GeminiClientException ex) {
            codecEx = ex;
        }
        assertThat(codecEx).isNotNull();
        assertThat(codecEx.getKind()).isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE);

        ResponseEntity<ApiResponse<Void>> responseCodec = handler.handleAppException(codecEx);
        assertThat(responseCodec.getBody()).isNotNull();
        assertThat(responseCodec.getBody().getMessage()).doesNotContain("SENTINEL_SECRET_44444");
        assertThat(output.getAll()).doesNotContain("SENTINEL_SECRET_44444");

        // 2. Real production exception from HttpGeminiClient invalid header construction with sentinel key
        String sentinelHeaderKey = "SECRET_HEADER_KEY_SENTINEL_55555_\u0100";
        GeminiProperties badKeyProps = new GeminiProperties();
        badKeyProps.setEnabled(true);
        badKeyProps.setApiKey(sentinelHeaderKey);
        badKeyProps.setModel("gemini-1.5-flash");

        httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
        HttpGeminiClient localClient = new HttpGeminiClient(httpClient, badKeyProps, codec);

        GeminiGenerationRequest request = new GeminiGenerationRequest(
                null,
                "Prompt text",
                1024,
                GeminiGenerationRequest.OutputFormat.TEXT
        );

        GeminiClientException headerEx = null;
        try {
            localClient.generate(request);
        } catch (GeminiClientException ex) {
            headerEx = ex;
        }
        assertThat(headerEx).isNotNull();
        assertThat(headerEx.getKind()).isEqualTo(GeminiClientException.Kind.INVALID_INPUT);

        ResponseEntity<ApiResponse<Void>> responseHeader = handler.handleAppException(headerEx);
        assertThat(responseHeader.getBody()).isNotNull();
        assertThat(responseHeader.getBody().getMessage()).doesNotContain("SENTINEL_55555");
        assertThat(output.getAll()).doesNotContain("SENTINEL_55555");

        // 3. Real production exception from HttpGeminiClient with provider 400 error containing sentinel body
        primaryServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        int primaryPort = primaryServer.getAddress().getPort();
        String sentinelProviderError = "UPSTREAM_PROVIDER_ERROR_SENTINEL_66666";

        primaryServer.createContext("/v1beta/models/gemini-1.5-flash:generateContent", exchange -> {
            try (InputStream is = exchange.getRequestBody()) {
                is.readAllBytes();
            }
            byte[] errorBytes = ("{\"error\": {\"message\": \"" + sentinelProviderError + "\"}}").getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(400, errorBytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(errorBytes);
            }
            exchange.close();
        });
        primaryServer.start();

        GeminiProperties validProps = new GeminiProperties();
        validProps.setEnabled(true);
        validProps.setApiKey("valid-secret-key-12345");
        validProps.setModel("gemini-1.5-flash");
        validProps.setRequestTimeout(Duration.ofSeconds(2));

        URI primaryUri = URI.create("http://127.0.0.1:" + primaryPort + "/v1beta/models/gemini-1.5-flash:generateContent");
        HttpGeminiClient serverClient = new HttpGeminiClient(httpClient, primaryUri, validProps, codec);

        GeminiClientException providerEx = null;
        try {
            serverClient.generate(request);
        } catch (GeminiClientException ex) {
            providerEx = ex;
        }
        assertThat(providerEx).isNotNull();
        assertThat(providerEx.getKind()).isEqualTo(GeminiClientException.Kind.PROVIDER_REQUEST_REJECTED);

        ResponseEntity<ApiResponse<Void>> responseProvider = handler.handleAppException(providerEx);
        assertThat(responseProvider.getBody()).isNotNull();
        assertThat(responseProvider.getBody().getMessage()).doesNotContain("SENTINEL_66666");
        assertThat(output.getAll()).doesNotContain("SENTINEL_66666");

        // 4. Real production exception with sentinel user essay and prompt on upstream failure
        String sentinelEssay = "USER_ESSAY_PROMPT_SENTINEL_77777";
        String sentinelSystem = "SYSTEM_INSTRUCTION_SENTINEL_88888";
        GeminiGenerationRequest sensitiveRequest = new GeminiGenerationRequest(
                sentinelSystem,
                sentinelEssay,
                1024,
                GeminiGenerationRequest.OutputFormat.JSON
        );

        GeminiClientException sensitiveEx = null;
        try {
            serverClient.generate(sensitiveRequest);
        } catch (GeminiClientException ex) {
            sensitiveEx = ex;
        }
        assertThat(sensitiveEx).isNotNull();

        ResponseEntity<ApiResponse<Void>> responseSensitive = handler.handleAppException(sensitiveEx);
        assertThat(responseSensitive.getBody()).isNotNull();
        assertThat(responseSensitive.getBody().getMessage()).doesNotContain("SENTINEL_77777");
        assertThat(responseSensitive.getBody().getMessage()).doesNotContain("SENTINEL_88888");
        assertThat(output.getAll()).doesNotContain("SENTINEL_77777");
        assertThat(output.getAll()).doesNotContain("SENTINEL_88888");
    }

    @Test
    @DisplayName("Security: request and result toString() never expose prompt, essay, or output text")
    void sentinelPayloadNeverPrintedInRequestOrResultToString() {
        GeminiGenerationRequest request = new GeminiGenerationRequest(
                "SECRET_SYSTEM_INSTRUCTION_SENTINEL",
                "SECRET_USER_ESSAY_SENTINEL",
                1024,
                GeminiGenerationRequest.OutputFormat.JSON
        );

        String requestStr = request.toString();
        assertThat(requestStr).doesNotContain("SECRET_SYSTEM_INSTRUCTION_SENTINEL");
        assertThat(requestStr).doesNotContain("SECRET_USER_ESSAY_SENTINEL");
        assertThat(requestStr).contains("JSON");
        assertThat(requestStr).contains("1024");

        GeminiGenerationResult result = new GeminiGenerationResult(
                "SECRET_GENERATED_OUTPUT_TEXT_SENTINEL",
                new GeminiGenerationResult.Usage(10, 20, 30)
        );

        String resultStr = result.toString();
        assertThat(resultStr).doesNotContain("SECRET_GENERATED_OUTPUT_TEXT_SENTINEL");
        assertThat(resultStr).contains("10");
        assertThat(resultStr).contains("20");
        assertThat(resultStr).contains("30");
    }
}
