package com.multilingo.backend.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "brevo")
@Data
public class BrevoProperties {
    private String apiKey = "";
    private String apiUrl = "https://api.brevo.com/v3/smtp/email";
    private String senderEmail = "no-reply@multilingo.com";
    private String senderName = "Multilingo Platform";
    private Sender sender = new Sender();

    @Data
    public static class Sender {
        private String email;
        private String name;
    }

    public String getSenderEmail() {
        if (sender != null && sender.getEmail() != null && !sender.getEmail().isBlank()) {
            return sender.getEmail();
        }
        return senderEmail;
    }

    public String getSenderName() {
        if (sender != null && sender.getName() != null && !sender.getName().isBlank()) {
            return sender.getName();
        }
        return senderName;
    }
}

