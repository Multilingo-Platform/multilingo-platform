package com.multilingo.backend.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

@Configuration
@RequiredArgsConstructor
public class BrevoConfig {

    private final BrevoProperties brevoProperties;

    @Bean
    public RestClient brevoRestClient() {
        return RestClient.builder()
                .baseUrl(brevoProperties.getApiUrl())
                .defaultHeader("api-key", brevoProperties.getApiKey())
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }
}
