package com.multilingo.backend.modules.auth.service.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.config.BrevoProperties;
import com.multilingo.backend.modules.auth.dto.brevo.BrevoEmailPayload;
import com.multilingo.backend.modules.auth.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class BrevoEmailServiceImpl implements EmailService {

    private final RestClient brevoRestClient;
    private final BrevoProperties brevoProperties;
    private final TemplateEngine templateEngine;

    @Override
    public void sendResetPasswordOtp(String recipientEmail, String recipientName, String otp) {
        if (brevoProperties.getApiKey() == null || brevoProperties.getApiKey().isBlank()) {
            log.warn("BREVO_API_KEY is not configured. Emulating email sending to {}: OTP={}", recipientEmail, otp);
            return;
        }

        String displayName = (recipientName != null && !recipientName.isBlank()) ? recipientName : "Học viên";

        Context context = new Context();
        context.setVariable("recipientName", displayName);
        context.setVariable("otp", otp);
        context.setVariable("validMinutes", 5);

        String htmlContent = templateEngine.process("email/reset-password-otp", context);

        BrevoEmailPayload payload = BrevoEmailPayload.builder()
                .sender(new BrevoEmailPayload.Sender(brevoProperties.getSenderName(), brevoProperties.getSenderEmail()))
                .to(List.of(new BrevoEmailPayload.Recipient(recipientEmail, displayName)))
                .subject("Mã xác nhận đặt lại mật khẩu - Multilingo")
                .htmlContent(htmlContent)
                .build();

        try {
            brevoRestClient.post()
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Reset password OTP successfully dispatched via Brevo to {}", recipientEmail);
        } catch (Exception ex) {
            log.error("Failed to send OTP email via Brevo to {}: {}", recipientEmail, ex.getMessage(), ex);
            throw new AppException(ErrorCode.UNCATEGORIZED_EXCEPTION);
        }
    }
}
