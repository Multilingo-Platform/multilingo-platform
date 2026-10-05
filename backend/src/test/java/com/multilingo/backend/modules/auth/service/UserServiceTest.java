package com.multilingo.backend.modules.auth.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.auth.dto.request.ForgotPasswordRequest;
import com.multilingo.backend.modules.auth.dto.request.ResetPasswordRequest;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.repository.UserRepository;
import com.multilingo.backend.modules.auth.service.impl.UserServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private StringRedisTemplate stringRedisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @InjectMocks
    private UserServiceImpl userService;

    private User mockUser;

    @BeforeEach
    void setUp() {
        mockUser = new User();
        mockUser.setId(1);
        mockUser.setEmail("test@gmail.com");
        mockUser.setPasswordHash("hashedPassword");
    }

    @Test
    void forgotPassword_Success() {
        ForgotPasswordRequest request = new ForgotPasswordRequest("test@gmail.com");
        when(userRepository.findByEmail("test@gmail.com")).thenReturn(Optional.of(mockUser));
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);

        userService.forgotPassword(request);

        verify(valueOperations).set(eq("OTP_RESET_PWD:test@gmail.com"), anyString(), eq(5L), eq(TimeUnit.MINUTES));
    }

    @Test
    void forgotPassword_UserNotFound() {
        ForgotPasswordRequest request = new ForgotPasswordRequest("notfound@gmail.com");
        when(userRepository.findByEmail("notfound@gmail.com")).thenReturn(Optional.empty());

        AppException ex = assertThrows(AppException.class, () -> userService.forgotPassword(request));
        assertEquals(ErrorCode.USER_NOT_FOUND, ex.getErrorCode());
    }

    @Test
    void resetPassword_Success() {
        ResetPasswordRequest request = new ResetPasswordRequest("test@gmail.com", "123456", "newPassword");
        when(userRepository.findByEmail("test@gmail.com")).thenReturn(Optional.of(mockUser));
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("OTP_RESET_PWD:test@gmail.com")).thenReturn("123456");
        when(passwordEncoder.encode("newPassword")).thenReturn("newHashedPassword");

        userService.resetPassword(request);

        verify(userRepository).save(mockUser);
        assertEquals("newHashedPassword", mockUser.getPasswordHash());
        verify(stringRedisTemplate).delete("OTP_RESET_PWD:test@gmail.com");
    }

    @Test
    void resetPassword_InvalidOTP() {
        ResetPasswordRequest request = new ResetPasswordRequest("test@gmail.com", "123456", "newPassword");
        when(userRepository.findByEmail("test@gmail.com")).thenReturn(Optional.of(mockUser));
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("OTP_RESET_PWD:test@gmail.com")).thenReturn("654321");

        AppException ex = assertThrows(AppException.class, () -> userService.resetPassword(request));
        assertEquals(ErrorCode.INVALID_OTP, ex.getErrorCode());
    }

    @Test
    void resetPassword_ExpiredOTP() {
        ResetPasswordRequest request = new ResetPasswordRequest("test@gmail.com", "123456", "newPassword");
        when(userRepository.findByEmail("test@gmail.com")).thenReturn(Optional.of(mockUser));
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("OTP_RESET_PWD:test@gmail.com")).thenReturn(null);

        AppException ex = assertThrows(AppException.class, () -> userService.resetPassword(request));
        assertEquals(ErrorCode.OTP_EXPIRED, ex.getErrorCode());
    }
}
