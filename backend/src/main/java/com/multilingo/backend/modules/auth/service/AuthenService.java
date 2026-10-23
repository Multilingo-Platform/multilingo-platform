package com.multilingo.backend.modules.auth.service;

import com.multilingo.backend.modules.auth.dto.request.LoginRequest;
import com.multilingo.backend.modules.auth.dto.response.AuthenticationResponse;

import com.multilingo.backend.modules.auth.dto.request.LogoutRequest;

public interface AuthenService {
    AuthenticationResponse login(LoginRequest request);
    AuthenticationResponse login(LoginRequest request, String ipAddress, String deviceInfo);
    AuthenticationResponse loginWithGoogle(com.multilingo.backend.modules.auth.dto.request.GoogleLoginRequest request);
    AuthenticationResponse loginWithGoogle(com.multilingo.backend.modules.auth.dto.request.GoogleLoginRequest request, String ipAddress, String deviceInfo);
    void logout(LogoutRequest request);
    AuthenticationResponse refreshToken(String refreshToken);
}
