package com.multilingo.backend.modules.auth.service;

import com.multilingo.backend.modules.auth.dto.request.LoginRequest;
import com.multilingo.backend.modules.auth.dto.response.AuthenticationResponse;

public interface AuthenService {
    AuthenticationResponse login(LoginRequest request);
}
