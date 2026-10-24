package com.multilingo.backend.config;

import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import static org.junit.jupiter.api.Assertions.assertNotNull;

class BrevoConfigTest {

    @Test
    void brevoRestClient_ShouldBeCreatedSuccessfully() {
        BrevoProperties properties = new BrevoProperties();
        properties.setApiKey("test-api-key");
        properties.setApiUrl("https://api.brevo.com/v3/smtp/email");
        properties.setSenderEmail("no-reply@multilingo.com");
        properties.setSenderName("Multilingo");

        BrevoConfig config = new BrevoConfig(properties);
        RestClient restClient = config.brevoRestClient();

        assertNotNull(restClient);
    }
}
