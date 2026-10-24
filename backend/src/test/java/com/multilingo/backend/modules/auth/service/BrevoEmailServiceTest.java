package com.multilingo.backend.modules.auth.service;

import com.multilingo.backend.config.BrevoProperties;
import com.multilingo.backend.modules.auth.service.impl.BrevoEmailServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BrevoEmailServiceTest {

    @Mock
    private RestClient brevoRestClient;

    @Mock
    private TemplateEngine templateEngine;

    @Mock
    private RestClient.RequestBodyUriSpec requestBodyUriSpec;

    @Mock
    private RestClient.RequestBodySpec requestBodySpec;

    @Mock
    private RestClient.ResponseSpec responseSpec;

    private BrevoProperties properties;
    private BrevoEmailServiceImpl emailService;

    @BeforeEach
    void setUp() {
        properties = new BrevoProperties();
        properties.setApiKey("test-key");
        properties.setSenderEmail("no-reply@multilingo.com");
        properties.setSenderName("Multilingo");
        emailService = new BrevoEmailServiceImpl(brevoRestClient, properties, templateEngine);
    }

    @Test
    void sendResetPasswordOtp_Success() {
        when(templateEngine.process(eq("email/reset-password-otp"), any(Context.class)))
                .thenReturn("<html><body>Mock Email Content</body></html>");
        when(brevoRestClient.post()).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.body(any(Object.class))).thenReturn(requestBodySpec);
        when(requestBodySpec.retrieve()).thenReturn(responseSpec);

        assertDoesNotThrow(() -> emailService.sendResetPasswordOtp("student@example.com", "Học viên", "123456"));

        verify(templateEngine).process(eq("email/reset-password-otp"), any(Context.class));
        verify(brevoRestClient).post();
    }

    @Test
    void sendResetPasswordOtp_EmptyApiKey_LogsWarningWithoutCallingBrevoApi() {
        properties.setApiKey(""); // Không có API key (local env)
        assertDoesNotThrow(() -> emailService.sendResetPasswordOtp("student@example.com", "Học viên", "123456"));
        verifyNoInteractions(brevoRestClient);
        verifyNoInteractions(templateEngine);
    }
}
