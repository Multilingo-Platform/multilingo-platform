package com.multilingo.backend.modules.auth.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.auth.dto.request.LoginRequest;
import com.multilingo.backend.modules.auth.dto.response.AuthenticationResponse;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.repository.UserRepository;
import com.multilingo.backend.modules.auth.security.JwtTokenProvider;
import com.multilingo.backend.modules.auth.service.impl.AuthenServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import com.multilingo.backend.modules.auth.dto.request.LogoutRequest;
import java.util.Date;
import java.util.concurrent.TimeUnit;

@ExtendWith(MockitoExtension.class)
class AuthenServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private StringRedisTemplate stringRedisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @Mock
    private com.multilingo.backend.modules.auth.repository.RefreshTokenRepository refreshTokenRepository;

    @InjectMocks
    private AuthenServiceImpl authenService;

    private User mockUser;

    @BeforeEach
    void setUp() {
        mockUser = new User();
        mockUser.setId(1);
        mockUser.setEmail("test@gmail.com");
        mockUser.setPasswordHash("hashedPassword");
    }

    @Test
    void login_Success() {
        // Arrange
        LoginRequest request = new LoginRequest("test@gmail.com", "password");
        when(userRepository.findByEmail("test@gmail.com")).thenReturn(Optional.of(mockUser));
        when(passwordEncoder.matches("password", "hashedPassword")).thenReturn(true);
        when(jwtTokenProvider.generateToken(mockUser)).thenReturn("mockJwtToken");
        when(refreshTokenRepository.save(any(com.multilingo.backend.modules.auth.entity.RefreshToken.class))).thenReturn(null);

        // Act
        AuthenticationResponse response = authenService.login(request);

        // Assert
        assertNotNull(response);
        assertEquals("mockJwtToken", response.getAccessToken());
        assertNotNull(response.getRefreshToken());
        verify(userRepository).findByEmail("test@gmail.com");
        verify(passwordEncoder).matches("password", "hashedPassword");
        verify(jwtTokenProvider).generateToken(mockUser);
        verify(refreshTokenRepository).save(any(com.multilingo.backend.modules.auth.entity.RefreshToken.class));
    }

    @Test
    void login_UserNotFound_ThrowsException() {
        // Arrange
        LoginRequest request = new LoginRequest("notfound@gmail.com", "password");
        when(userRepository.findByEmail("notfound@gmail.com")).thenReturn(Optional.empty());

        // Act & Assert
        AppException exception = assertThrows(AppException.class, () -> authenService.login(request));
        assertEquals(ErrorCode.USER_NOT_FOUND, exception.getErrorCode());
        verify(passwordEncoder, never()).matches(anyString(), anyString());
    }

    @Test
    void login_WrongPassword_ThrowsException() {
        // Arrange
        LoginRequest request = new LoginRequest("test@gmail.com", "wrongpassword");
        when(userRepository.findByEmail("test@gmail.com")).thenReturn(Optional.of(mockUser));
        when(passwordEncoder.matches("wrongpassword", "hashedPassword")).thenReturn(false);

        // Act & Assert
        AppException exception = assertThrows(AppException.class, () -> authenService.login(request));
        assertEquals(ErrorCode.WRONG_PASSWORD, exception.getErrorCode());
    }

    @Test
    void logout_Success() {
        // Arrange
        LogoutRequest request = new LogoutRequest("mockToken");
        when(jwtTokenProvider.validateToken("mockToken")).thenReturn(true);
        when(jwtTokenProvider.getJtiFromJWT("mockToken")).thenReturn("mockJti");
        when(jwtTokenProvider.getExpirationFromJWT("mockToken")).thenReturn(new Date(System.currentTimeMillis() + 10000));
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        
        when(jwtTokenProvider.getEmailFromJWT("mockToken")).thenReturn("test@gmail.com");
        when(userRepository.findByEmail("test@gmail.com")).thenReturn(Optional.of(mockUser));
        when(refreshTokenRepository.revokeAllUserTokens(mockUser)).thenReturn(1);

        // Act
        authenService.logout(request);

        // Assert
        verify(valueOperations).set(eq("BLACKLIST_TOKEN:mockJti"), eq("invalid"), anyLong(), eq(TimeUnit.MILLISECONDS));
        verify(refreshTokenRepository).revokeAllUserTokens(mockUser);
    }
}
