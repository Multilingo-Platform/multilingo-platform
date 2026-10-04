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

@ExtendWith(MockitoExtension.class)
class AuthenServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

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

        // Act
        AuthenticationResponse response = authenService.login(request);

        // Assert
        assertNotNull(response);
        assertEquals("mockJwtToken", response.getAccessToken());
        verify(userRepository).findByEmail("test@gmail.com");
        verify(passwordEncoder).matches("password", "hashedPassword");
        verify(jwtTokenProvider).generateToken(mockUser);
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
}
