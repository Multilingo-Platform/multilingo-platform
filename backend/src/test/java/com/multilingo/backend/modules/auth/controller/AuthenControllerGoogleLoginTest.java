package com.multilingo.backend.modules.auth.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.common.exception.GlobalExceptionHandler;
import com.multilingo.backend.modules.auth.dto.request.GoogleLoginRequest;
import com.multilingo.backend.modules.auth.dto.response.AuthenticationResponse;
import com.multilingo.backend.modules.auth.service.AuthenService;
import com.multilingo.backend.modules.auth.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class AuthenControllerGoogleLoginTest {

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
        ReflectionTestUtils.setField(authenController, "refreshTokenExpirationMs", 604800000L);
        mockMvc = MockMvcBuilders.standaloneSetup(authenController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("POST /api/auth/google - Thành công: Trả về 200 OK, accessToken và Set-Cookie refresh_token")
    void testLoginWithGoogle_Success() throws Exception {
        GoogleLoginRequest request = new GoogleLoginRequest("valid.google.id.token");
        AuthenticationResponse response = AuthenticationResponse.builder()
                .accessToken("mock.google.jwt.token")
                .refreshToken("mock.refresh.token.uuid")
                .build();

        when(authenService.loginWithGoogle(any(GoogleLoginRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.accessToken").value("mock.google.jwt.token"))
                .andExpect(header().exists("Set-Cookie"))
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("refresh_token=mock.refresh.token.uuid")));
    }

    @Test
    @DisplayName("POST /api/auth/google - Token rỗng -> Trả về 400 Bad Request")
    void testLoginWithGoogle_BlankToken_BadRequest() throws Exception {
        GoogleLoginRequest request = new GoogleLoginRequest("");

        mockMvc.perform(post("/api/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(922));
    }

    @Test
    @DisplayName("POST /api/auth/google - Token không hợp lệ -> Trả về 401 với mã lỗi 920")
    void testLoginWithGoogle_InvalidToken_Throws401() throws Exception {
        GoogleLoginRequest request = new GoogleLoginRequest("invalid.token");

        when(authenService.loginWithGoogle(any(GoogleLoginRequest.class)))
                .thenThrow(new AppException(ErrorCode.INVALID_GOOGLE_TOKEN));

        mockMvc.perform(post("/api/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(920));
    }

    @Test
    @DisplayName("POST /api/auth/google - Tài khoản bị khóa -> Trả về 403 với mã lỗi 918")
    void testLoginWithGoogle_InactiveAccount_Throws403() throws Exception {
        GoogleLoginRequest request = new GoogleLoginRequest("locked.token");

        when(authenService.loginWithGoogle(any(GoogleLoginRequest.class)))
                .thenThrow(new AppException(ErrorCode.ACCOUNT_INACTIVE));

        mockMvc.perform(post("/api/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(918));
    }
}
