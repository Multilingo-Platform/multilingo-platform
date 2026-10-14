package com.multilingo.backend.modules.auth.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.auth.dto.GoogleTokenPayload;
import com.multilingo.backend.modules.auth.service.impl.GoogleTokenVerifierServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.security.GeneralSecurityException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GoogleTokenVerifierServiceTest {

    @Mock
    private GoogleIdTokenVerifier verifier;

    private GoogleTokenVerifierService service;

    @BeforeEach
    void setUp() {
        service = new GoogleTokenVerifierServiceImpl(verifier);
    }

    @Test
    @DisplayName("Ném INVALID_GOOGLE_TOKEN khi ID Token null hoặc rỗng")
    void testVerify_NullOrBlankToken_ThrowsInvalidGoogleToken() {
        AppException ex1 = assertThrows(AppException.class, () -> service.verify(null));
        assertEquals(ErrorCode.INVALID_GOOGLE_TOKEN, ex1.getErrorCode());

        AppException ex2 = assertThrows(AppException.class, () -> service.verify("   "));
        assertEquals(ErrorCode.INVALID_GOOGLE_TOKEN, ex2.getErrorCode());
    }

    @Test
    @DisplayName("Ném INVALID_GOOGLE_TOKEN khi verifier trả về null (token giả hoặc sai chữ ký)")
    void testVerify_InvalidSignature_ThrowsInvalidGoogleToken() throws GeneralSecurityException, IOException {
        when(verifier.verify("invalid.token")).thenReturn(null);

        AppException ex = assertThrows(AppException.class, () -> service.verify("invalid.token"));
        assertEquals(ErrorCode.INVALID_GOOGLE_TOKEN, ex.getErrorCode());
    }

    @Test
    @DisplayName("Ném INVALID_GOOGLE_TOKEN khi verifier ném ngoại lệ Security/IO")
    void testVerify_VerifierThrowsException_ThrowsInvalidGoogleToken() throws GeneralSecurityException, IOException {
        when(verifier.verify("corrupted.token")).thenThrow(new GeneralSecurityException("Invalid crypto"));

        AppException ex = assertThrows(AppException.class, () -> service.verify("corrupted.token"));
        assertEquals(ErrorCode.INVALID_GOOGLE_TOKEN, ex.getErrorCode());
    }

    @Test
    @DisplayName("Ném GOOGLE_EMAIL_NOT_VERIFIED khi email_verified = false")
    void testVerify_EmailNotVerified_ThrowsGoogleEmailNotVerified() throws GeneralSecurityException, IOException {
        GoogleIdToken googleIdToken = mock(GoogleIdToken.class);
        GoogleIdToken.Payload payload = new GoogleIdToken.Payload();
        payload.setSubject("sub_123");
        payload.setEmail("test@gmail.com");
        payload.setEmailVerified(false);

        when(googleIdToken.getPayload()).thenReturn(payload);
        when(verifier.verify("unverified.token")).thenReturn(googleIdToken);

        AppException ex = assertThrows(AppException.class, () -> service.verify("unverified.token"));
        assertEquals(ErrorCode.GOOGLE_EMAIL_NOT_VERIFIED, ex.getErrorCode());
    }

    @Test
    @DisplayName("Trả về GoogleTokenPayload hợp lệ khi token hợp lệ và email đã verified")
    void testVerify_ValidToken_ReturnsPayload() throws GeneralSecurityException, IOException {
        GoogleIdToken googleIdToken = mock(GoogleIdToken.class);
        GoogleIdToken.Payload payload = new GoogleIdToken.Payload();
        payload.setSubject("google_sub_999");
        payload.setEmail("student@gmail.com");
        payload.setEmailVerified(true);
        payload.set("name", "Nguyen Van A");
        payload.set("picture", "https://lh3.googleusercontent.com/avatar.jpg");

        when(googleIdToken.getPayload()).thenReturn(payload);
        when(verifier.verify("valid.token")).thenReturn(googleIdToken);

        GoogleTokenPayload result = service.verify("valid.token");

        assertNotNull(result);
        assertEquals("google_sub_999", result.getSub());
        assertEquals("student@gmail.com", result.getEmail());
        assertEquals("Nguyen Van A", result.getFullName());
        assertEquals("https://lh3.googleusercontent.com/avatar.jpg", result.getAvatarUrl());
        assertTrue(result.isEmailVerified());
    }
}
