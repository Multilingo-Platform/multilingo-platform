package com.multilingo.backend.modules.auth.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.common.exception.GlobalExceptionHandler;
import com.multilingo.backend.modules.auth.dto.request.LoginRequest;
import com.multilingo.backend.modules.auth.dto.response.AuthenticationResponse;
import com.multilingo.backend.modules.auth.service.AuthenService;
import com.multilingo.backend.modules.auth.service.UserService;
import com.multilingo.backend.modules.auth.dto.request.ForgotPasswordRequest;
import com.multilingo.backend.modules.auth.dto.request.ResetPasswordRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doNothing;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AuthenControllerTest {

    private MockMvc mockMvc;

    @Mock
    private AuthenService authenService;

    @Mock
    private UserService userService;

    @InjectMocks
    private AuthenController authenController;

    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        mockMvc = MockMvcBuilders.standaloneSetup(authenController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("POST /api/auth/login - Success")
    void login_Success() throws Exception {
        LoginRequest request = new LoginRequest("test@gmail.com", "password");
        AuthenticationResponse response = AuthenticationResponse.builder()
                .accessToken("mockToken")
                .refreshToken("mockRefreshToken")
                .build();

        when(authenService.login(any(LoginRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.accessToken").value("mockToken"));
    }

    @Test
    @DisplayName("POST /api/auth/login - Invalid Email Format")
    void login_InvalidEmailFormat() throws Exception {
        LoginRequest request = new LoginRequest("invalidemail", "password");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(422));
    }

    @Test
    @DisplayName("POST /api/auth/login - User Not Found")
    void login_UserNotFound() throws Exception {
        LoginRequest request = new LoginRequest("notfound@gmail.com", "password");

        when(authenService.login(any(LoginRequest.class)))
                .thenThrow(new AppException(ErrorCode.USER_NOT_FOUND));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(904));
    }

    @Test
    @DisplayName("POST /api/auth/logout - Success")
    void logout_Success() throws Exception {
        com.multilingo.backend.modules.auth.dto.request.LogoutRequest request = 
                new com.multilingo.backend.modules.auth.dto.request.LogoutRequest("mockToken");

        mockMvc.perform(post("/api/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("POST /api/auth/forgot-password - Success")
    void forgotPassword_Success() throws Exception {
        ForgotPasswordRequest request = new ForgotPasswordRequest("test@gmail.com");

        doNothing().when(userService).forgotPassword(any(ForgotPasswordRequest.class));

        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @DisplayName("POST /api/auth/reset-password - Success")
    void resetPassword_Success() throws Exception {
        ResetPasswordRequest request = new ResetPasswordRequest("test@gmail.com", "123456", "newPassword");

        doNothing().when(userService).resetPassword(any(ResetPasswordRequest.class));

        mockMvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }
}
