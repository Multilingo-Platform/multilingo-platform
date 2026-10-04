package com.multilingo.backend.modules.auth.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.modules.auth.dto.request.LoginRequest;
import com.multilingo.backend.modules.auth.dto.response.AuthenticationResponse;
import com.multilingo.backend.modules.auth.service.AuthenService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthenController {

    private final AuthenService authenService;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthenticationResponse>> login(@Valid @RequestBody LoginRequest request) {
        AuthenticationResponse response = authenService.login(request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
