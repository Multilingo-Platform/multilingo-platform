package com.multilingo.backend.modules.testing.ai.media;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.net.InetAddress;
import java.nio.ByteBuffer;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

public final class HttpImageFetcher implements ImageFetcher {
    private final HttpClient client;
    private final ImageFetchProperties.Settings settings;
    private final ImageAddressPolicy addressPolicy;
    private final ImageAddressPolicy.Resolver resolver;
    private final ExecutorService executor;

    HttpImageFetcher(HttpClient client, ImageFetchProperties.Settings settings, ImageAddressPolicy addressPolicy,
                     ImageAddressPolicy.Resolver resolver, ExecutorService executor) {
        this.client = java.util.Objects.requireNonNull(client);
        this.settings = java.util.Objects.requireNonNull(settings);
        this.addressPolicy = java.util.Objects.requireNonNull(addressPolicy);
        this.resolver = java.util.Objects.requireNonNull(resolver);
        this.executor = java.util.Objects.requireNonNull(executor);
    }

    @Override public FetchedImage fetch(String url) {
        long start = System.nanoTime();
        long budget = settings.requestTimeout().toNanos();
        Future<InetAddress[]> dns = null;
        CompletableFuture<HttpResponse<byte[]>> responseFuture = null;
        var subscriber = new AtomicReference<BoundedByteBodySubscriber>();
        boolean resolving = true;
        boolean success = false;
        try {
            var uri = settings.urlPolicy().validate(url);
            dns = executor.submit(() -> resolver.resolve(uri.getHost()));
            addressPolicy.requirePublic(dns.get(remaining(start, budget), TimeUnit.NANOSECONDS));
            resolving = false;
            var request = HttpRequest.newBuilder(uri).timeout(Duration.ofNanos(remaining(start, budget)))
                    .header("Accept", "image/png, image/jpeg, image/webp").GET().build();
            responseFuture = client.sendAsync(request, info -> bodySubscriber(info, subscriber));
            var response = responseFuture.get(remaining(start, budget), TimeUnit.NANOSECONDS);
            String mime = ImageSniffer.sniff(response.body(), response.headers().firstValue("Content-Type").orElse(null));
            var result = new FetchedImage(mime, response.body());
            remaining(start, budget);
            success = true;
            return result;
        } catch (ImageFetchException error) {
            throw error;
        } catch (TimeoutException error) {
            throw new ImageFetchException(ImageFetchException.Kind.TIMEOUT);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new ImageFetchException(ImageFetchException.Kind.INTERRUPTED);
        } catch (ExecutionException error) {
            for (Throwable cause = error.getCause(); cause != null; cause = cause.getCause()) {
                if (cause instanceof ImageFetchException safe) throw safe;
                if (cause instanceof HttpTimeoutException) throw new ImageFetchException(ImageFetchException.Kind.TIMEOUT);
            }
            throw new ImageFetchException(resolving ? ImageFetchException.Kind.ADDRESS_REJECTED : ImageFetchException.Kind.TRANSPORT);
        } catch (RuntimeException error) {
            throw new ImageFetchException(ImageFetchException.Kind.TRANSPORT);
        } finally {
            if (!success) {
                if (dns != null) dns.cancel(true);
                if (responseFuture != null) responseFuture.cancel(true);
                if (subscriber.get() != null) subscriber.get().cancel();
            }
        }
    }

    private static long remaining(long start, long budget) throws TimeoutException {
        long result = budget - (System.nanoTime() - start);
        if (result <= 0) throw new TimeoutException();
        return result;
    }

    private static HttpResponse.BodySubscriber<byte[]> bodySubscriber(HttpResponse.ResponseInfo info,
                                                                      AtomicReference<BoundedByteBodySubscriber> active) {
        ImageFetchException error = statusError(info.statusCode());
        boolean encoded = info.headers().allValues("Content-Encoding").stream()
                .flatMap(value -> java.util.Arrays.stream(value.split(",", -1)))
                .anyMatch(value -> !value.trim().equalsIgnoreCase("identity"));
        if (error == null && encoded) {
            error = new ImageFetchException(ImageFetchException.Kind.UNSUPPORTED_TYPE);
        }
        if (error == null && info.headers().firstValue("Content-Length").isPresent()) {
            try {
                long length = Long.parseLong(info.headers().firstValue("Content-Length").orElseThrow());
                if (length < 0) error = new ImageFetchException(ImageFetchException.Kind.INVALID_CONTENT);
                else if (length > ImageFetchProperties.MAX_IMAGE_BYTES) error = new ImageFetchException(ImageFetchException.Kind.TOO_LARGE);
            } catch (RuntimeException malformed) { error = new ImageFetchException(ImageFetchException.Kind.INVALID_CONTENT); }
        }
        if (error != null) return new RejectedBodySubscriber(error);
        var subscriber = new BoundedByteBodySubscriber(ImageFetchProperties.MAX_IMAGE_BYTES,
                () -> new ImageFetchException(ImageFetchException.Kind.TOO_LARGE));
        active.set(subscriber);
        return subscriber;
    }

    private static ImageFetchException statusError(int status) {
        if (status == 200) return null;
        ImageFetchException.Kind kind;
        if (status >= 300 && status < 400) kind = ImageFetchException.Kind.REDIRECT_REJECTED;
        else if (status == 404 || status == 410) kind = ImageFetchException.Kind.UPSTREAM_NOT_FOUND;
        else if (status == 408) kind = ImageFetchException.Kind.TIMEOUT;
        else if (status == 429) kind = ImageFetchException.Kind.RATE_LIMITED;
        else if (status >= 500 && status < 600) kind = ImageFetchException.Kind.UPSTREAM;
        else if (status >= 200 && status < 300) kind = ImageFetchException.Kind.INVALID_CONTENT;
        else kind = ImageFetchException.Kind.UPSTREAM_REJECTED;
        return new ImageFetchException(kind, status);
    }

    private static final class RejectedBodySubscriber implements HttpResponse.BodySubscriber<byte[]> {
        private final CompletableFuture<byte[]> body;
        RejectedBodySubscriber(ImageFetchException error) { body = CompletableFuture.failedFuture(error); }
        public CompletionStage<byte[]> getBody() { return body; }
        public void onSubscribe(Flow.Subscription subscription) { subscription.cancel(); }
        public void onNext(List<ByteBuffer> item) {}
        public void onError(Throwable error) {}
        public void onComplete() {}
    }
    @Override public String toString() { return "HttpImageFetcher{}"; }
}
