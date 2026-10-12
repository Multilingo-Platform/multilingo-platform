package com.multilingo.backend.modules.testing.ai.gemini;

import org.springframework.beans.factory.DisposableBean;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Finite HTTP transport client for Google Gemini.
 * Enforces monotonic end-to-end deadline, single-call dispatch, bounded response buffering,
 * and sanitized status code mapping.
 */
public class HttpGeminiClient implements GeminiClient, AutoCloseable, DisposableBean {

    private final HttpClient httpClient;
    private final URI endpointUri;
    private final GeminiPayloadCodec codec;
    private final boolean enabled;
    private final String apiKey;
    private final long requestTimeoutNanos;

    HttpGeminiClient(HttpClient httpClient, URI endpointUri, GeminiProperties properties, GeminiPayloadCodec codec) {
        Objects.requireNonNull(properties, "properties must not be null");
        this.codec = Objects.requireNonNull(codec, "codec must not be null");
        this.httpClient = httpClient;
        this.endpointUri = endpointUri;
        this.enabled = properties.isEnabled();
        this.apiKey = properties.getApiKey() != null ? properties.getApiKey() : "";
        Duration timeout = properties.getRequestTimeout();
        this.requestTimeoutNanos = timeout != null ? timeout.toNanos() : Duration.ofSeconds(30).toNanos();
    }

    public HttpGeminiClient(HttpClient httpClient, GeminiProperties properties, GeminiPayloadCodec codec) {
        this(
                httpClient,
                properties != null && properties.isEnabled() && properties.getModel() != null && !properties.getModel().isBlank()
                        ? URI.create("https://generativelanguage.googleapis.com/v1beta/models/" + properties.getModel() + ":generateContent")
                        : null,
                properties,
                codec
        );
    }

    @Override
    public GeminiGenerationResult generate(GeminiGenerationRequest request) {
        if (!enabled) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.DISABLED,
                    "Gemini client is disabled"
            );
        }

        if (request == null) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.INVALID_INPUT,
                    "Request must not be null"
            );
        }

        if (httpClient == null || endpointUri == null) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.INVALID_INPUT,
                    "Gemini client transport is not properly configured"
            );
        }

        long startNanos = System.nanoTime();
        long budgetNanos = this.requestTimeoutNanos;

        byte[] requestPayload = codec.encode(request);

        long elapsedNanos = System.nanoTime() - startNanos;
        long remainingNanos = budgetNanos - elapsedNanos;
        if (remainingNanos <= 0) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.TIMEOUT,
                    "Request timed out during payload preparation"
            );
        }

        HttpRequest httpRequest;
        try {
            httpRequest = HttpRequest.newBuilder()
                    .uri(endpointUri)
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("x-goog-api-key", apiKey)
                    .POST(HttpRequest.BodyPublishers.ofByteArray(requestPayload))
                    .build();
        } catch (IllegalArgumentException e) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.INVALID_INPUT,
                    "Failed to configure HTTP request headers"
            );
        }

        CompletableFuture<HttpResponse<byte[]>> future = httpClient.sendAsync(
                httpRequest,
                responseInfo -> new BoundedBodySubscriber(GeminiProperties.MAX_RESPONSE_BYTES)
        );

        HttpResponse<byte[]> response;
        try {
            long remainingForFutureNanos = budgetNanos - (System.nanoTime() - startNanos);
            if (remainingForFutureNanos <= 0) {
                future.cancel(true);
                throw new GeminiClientException(
                        GeminiClientException.Kind.TIMEOUT,
                        "Request timed out before execution could begin"
                );
            }
            response = future.get(remainingForFutureNanos, TimeUnit.NANOSECONDS);
        } catch (TimeoutException e) {
            future.cancel(true);
            throw new GeminiClientException(
                    GeminiClientException.Kind.TIMEOUT,
                    "Request timed out after deadline"
            );
        } catch (InterruptedException e) {
            future.cancel(true);
            Thread.currentThread().interrupt();
            throw new GeminiClientException(
                    GeminiClientException.Kind.INTERRUPTED,
                    "Request execution was interrupted"
            );
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof GeminiClientException gce) {
                throw gce;
            }
            if (cause instanceof HttpTimeoutException) {
                throw new GeminiClientException(
                        GeminiClientException.Kind.TIMEOUT,
                        "HTTP request timed out"
                );
            }
            throw new GeminiClientException(
                    GeminiClientException.Kind.TRANSPORT,
                    "Transport error communicating with Gemini provider"
            );
        }

        int statusCode = response.statusCode();
        if (statusCode >= 200 && statusCode < 300) {
            return codec.decode(response.body());
        } else if (statusCode >= 300 && statusCode < 400) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.REDIRECT_REJECTED,
                    "Redirect responses from provider are rejected",
                    statusCode
            );
        } else if (statusCode == 401 || statusCode == 403) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.AUTHENTICATION,
                    "Authentication failure with upstream provider",
                    statusCode
            );
        } else if (statusCode == 408) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.TIMEOUT,
                    "Upstream provider reported request timeout",
                    statusCode
            );
        } else if (statusCode == 429) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.RATE_LIMITED,
                    "Upstream provider rate limited the request",
                    statusCode
            );
        } else if (statusCode >= 400 && statusCode < 500) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.PROVIDER_REQUEST_REJECTED,
                    "Upstream provider rejected the request",
                    statusCode
            );
        } else if (statusCode >= 500 && statusCode < 600) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.UPSTREAM,
                    "Upstream provider returned server error",
                    statusCode
            );
        } else {
            throw new GeminiClientException(
                    GeminiClientException.Kind.INVALID_RESPONSE,
                    "Unexpected HTTP status from upstream provider",
                    statusCode
            );
        }
    }

    @Override
    public void close() {
        if (httpClient != null) {
            httpClient.shutdownNow();
        }
    }

    @Override
    public void destroy() {
        close();
    }
}
