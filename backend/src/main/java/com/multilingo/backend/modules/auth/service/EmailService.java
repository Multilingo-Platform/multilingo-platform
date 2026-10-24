package com.multilingo.backend.modules.auth.service;

public interface EmailService {
    void sendResetPasswordOtp(String recipientEmail, String recipientName, String otp);
}
