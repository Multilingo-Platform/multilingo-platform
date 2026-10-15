package com.multilingo.backend.modules.testing.ai.media;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import java.net.InetAddress;
import java.net.http.HttpClient;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Configuration
@EnableConfigurationProperties(ImageFetchProperties.class)
public class ImageFetchConfiguration {
    @Bean
    @ConditionalOnProperty(prefix = "testing.image-fetch", name = "enabled", havingValue = "true")
    ImageFetchProperties.Settings imageFetchSettings(ImageFetchProperties properties) { return properties.snapshot(); }

    @Bean(destroyMethod = "")
    @ConditionalOnProperty(prefix = "testing.image-fetch", name = "enabled", havingValue = "true")
    HttpClient imageFetchHttpClient(ImageFetchProperties.Settings settings) {
        return HttpClient.newBuilder().connectTimeout(settings.connectTimeout()).followRedirects(HttpClient.Redirect.NEVER).build();
    }

    @Bean(destroyMethod = "shutdownNow")
    @ConditionalOnProperty(prefix = "testing.image-fetch", name = "enabled", havingValue = "true")
    ExecutorService imageFetchResolverExecutor(ImageFetchProperties.Settings settings) {
        return Executors.newVirtualThreadPerTaskExecutor();
    }

    @Bean
    @ConditionalOnProperty(prefix = "testing.image-fetch", name = "enabled", havingValue = "true")
    DisposableBean imageFetchHttpClientShutdown(@Qualifier("imageFetchHttpClient") HttpClient client) {
        return client::shutdownNow;
    }

    @Bean
    ImageFetcher imageFetcher(ImageFetchProperties properties,
                              ObjectProvider<ImageFetchProperties.Settings> settings,
                              @Qualifier("imageFetchHttpClient") ObjectProvider<HttpClient> client,
                              @Qualifier("imageFetchResolverExecutor") ObjectProvider<ExecutorService> executor) {
        if (!properties.isEnabled()) return url -> { throw new ImageFetchException(ImageFetchException.Kind.DISABLED); };
        return new HttpImageFetcher(client.getObject(), settings.getObject(), new ImageAddressPolicy(),
                InetAddress::getAllByName, executor.getObject());
    }
}
