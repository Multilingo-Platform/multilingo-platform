package com.multilingo.backend.modules.auth.service;

import com.multilingo.backend.modules.auth.dto.request.LoginRequest;
import com.multilingo.backend.modules.auth.dto.response.AuthenticationResponse;

import com.multilingo.backend.modules.auth.dto.request.LogoutRequest;

public interface AuthenService {
    AuthenticationResponse login(LoginRequest request);
    void logout(LogoutRequest request);
}
