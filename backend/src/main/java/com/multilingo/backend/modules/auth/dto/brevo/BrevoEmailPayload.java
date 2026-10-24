package com.multilingo.backend.modules.auth.dto.brevo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BrevoEmailPayload {
    private Sender sender;
    private List<Recipient> to;
    private String subject;
    private String htmlContent;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Sender {
        private String name;
        private String email;
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Recipient {
        private String email;
        private String name;
    }
}
