package com.multilingo.backend.modules.testing.ai.media;

import java.net.URI;
import java.net.InetAddress;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.*;

/** Explicit test-only loopback policy bypass; never included in production sources. */
public final class ImageFetcherHarness implements AutoCloseable {
    private final HttpClient transport;
    private final ExecutorService resolver = Executors.newVirtualThreadPerTaskExecutor();
    private final ImageFetcher fetcher;
    public ImageFetcherHarness(Duration timeout) {
        transport = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(1))
                .followRedirects(HttpClient.Redirect.NEVER).build();
        var policy = new ImageUrlPolicy(List.of("https://cdn.example.test/cloud/")) {
            @Override public URI validate(String url) { return URI.create(url); }
        };
        var addresses = new ImageAddressPolicy() { @Override public void requirePublic(InetAddress[] ips) {} };
        fetcher = new HttpImageFetcher(transport, new ImageFetchProperties.Settings(Duration.ofMillis(1), timeout, policy),
                addresses, host -> new InetAddress[]{InetAddress.getLoopbackAddress()}, resolver);
    }
    public ImageFetcher fetcher() { return fetcher; }
    public void close() { transport.shutdownNow(); resolver.shutdownNow(); }
}
