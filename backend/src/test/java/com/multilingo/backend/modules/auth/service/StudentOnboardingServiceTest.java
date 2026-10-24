package com.multilingo.backend.modules.auth.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.auth.dto.request.OnboardingRequest;
import com.multilingo.backend.modules.auth.dto.response.OnboardingResponse;
import com.multilingo.backend.modules.auth.dto.response.OnboardingStatusResponse;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.entity.UserTarget;
import com.multilingo.backend.modules.auth.repository.UserRepository;
import com.multilingo.backend.modules.auth.repository.UserTargetRepository;
import com.multilingo.backend.modules.auth.service.impl.StudentOnboardingServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StudentOnboardingServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserTargetRepository userTargetRepository;

    @InjectMocks
    private StudentOnboardingServiceImpl onboardingService;

    private User mockUser;

    @BeforeEach
    void setUp() {
        mockUser = User.builder()
                .email("student@example.com")
                .hasCompletedOnboarding(false)
                .nativeLanguage("vi")
                .targetLanguage("en")
                .build();
        mockUser.setId(1);
    }

    @Test
    void submitOnboarding_Success_CreatesNewTarget() {
        OnboardingRequest request = OnboardingRequest.builder()
                .nativeLanguage("vi")
                .targetLanguage("en")
                .targetCertificate("IELTS_ACADEMIC")
                .targetScore(new BigDecimal("7.5"))
                .dailyMinutes(30)
                .currentLevel("INTERMEDIATE")
                .build();

        when(userRepository.findById(1)).thenReturn(Optional.of(mockUser));
        when(userTargetRepository.findFirstByUserId(1)).thenReturn(Optional.empty());
        when(userTargetRepository.save(any(UserTarget.class))).thenAnswer(invocation -> {
            UserTarget target = invocation.getArgument(0);
            target.setId(100);
            return target;
        });

        OnboardingResponse response = onboardingService.submitOnboarding(1, request);

        assertNotNull(response);
        assertEquals(1, response.getUserId());
        assertEquals("vi", response.getNativeLanguage());
        assertEquals("en", response.getTargetLanguage());
        assertEquals("IELTS_ACADEMIC", response.getTargetCertificate());
        assertEquals(new BigDecimal("7.5"), response.getTargetScore());
        assertEquals(30, response.getDailyMinutes());
        assertEquals("INTERMEDIATE", response.getCurrentLevel());
        assertTrue(response.getHasCompletedOnboarding());
        assertTrue(mockUser.getHasCompletedOnboarding());

        verify(userRepository, times(1)).save(mockUser);
        verify(userTargetRepository, times(1)).save(any(UserTarget.class));
    }

    @Test
    void submitOnboarding_Success_UpdatesExistingTarget() {
        OnboardingRequest request = OnboardingRequest.builder()
                .nativeLanguage("vi")
                .targetLanguage("en")
                .targetCertificate("TOEIC_LR")
                .targetScore(new BigDecimal("800"))
                .dailyMinutes(45)
                .currentLevel("ELEMENTARY")
                .build();

        UserTarget existingTarget = UserTarget.builder()
                .user(mockUser)
                .targetCertificate("IELTS_ACADEMIC")
                .targetLanguage("en")
                .targetScore(new BigDecimal("6.5"))
                .dailyMinutes(15)
                .currentLevel("BEGINNER")
                .build();
        existingTarget.setId(50);

        when(userRepository.findById(1)).thenReturn(Optional.of(mockUser));
        when(userTargetRepository.findFirstByUserId(1)).thenReturn(Optional.of(existingTarget));
        when(userTargetRepository.save(any(UserTarget.class))).thenReturn(existingTarget);

        OnboardingResponse response = onboardingService.submitOnboarding(1, request);

        assertNotNull(response);
        assertEquals("TOEIC_LR", response.getTargetCertificate());
        assertEquals(new BigDecimal("800"), response.getTargetScore());
        assertEquals(45, response.getDailyMinutes());
        assertEquals("ELEMENTARY", response.getCurrentLevel());
        assertEquals("TOEIC_LR", existingTarget.getTargetCertificate());
    }

    @Test
    void submitOnboarding_ThrowsException_WhenSameLanguage() {
        OnboardingRequest request = OnboardingRequest.builder()
                .nativeLanguage("vi")
                .targetLanguage("vi")
                .targetCertificate("IELTS_ACADEMIC")
                .targetScore(new BigDecimal("7.0"))
                .build();

        AppException ex = assertThrows(AppException.class, () -> onboardingService.submitOnboarding(1, request));
        assertEquals(ErrorCode.LANGUAGE_SAME, ex.getErrorCode());
        verify(userRepository, never()).save(any());
        verify(userTargetRepository, never()).save(any());
    }

    @Test
    void submitOnboarding_ThrowsException_WhenInvalidTargetScore() {
        OnboardingRequest request = OnboardingRequest.builder()
                .nativeLanguage("vi")
                .targetLanguage("en")
                .targetCertificate("IELTS_ACADEMIC")
                .targetScore(new BigDecimal("12.0")) // Invalid IELTS score
                .build();

        AppException ex = assertThrows(AppException.class, () -> onboardingService.submitOnboarding(1, request));
        assertEquals(ErrorCode.INVALID_TARGET_SCORE, ex.getErrorCode());
    }

    @Test
    void getOnboardingStatus_ReturnsFalse_WhenNotCompleted() {
        when(userRepository.findById(1)).thenReturn(Optional.of(mockUser));
        when(userTargetRepository.findFirstByUserId(1)).thenReturn(Optional.empty());

        OnboardingStatusResponse status = onboardingService.getOnboardingStatus(1);

        assertNotNull(status);
        assertFalse(status.getHasCompletedOnboarding());
        assertEquals("vi", status.getNativeLanguage());
        assertEquals("en", status.getTargetLanguage());
        assertNull(status.getTargetCertificate());
    }

    @Test
    void getOnboardingStatus_ReturnsTrue_WithTargetDetails_WhenCompleted() {
        mockUser.setHasCompletedOnboarding(true);
        UserTarget target = UserTarget.builder()
                .user(mockUser)
                .targetCertificate("IELTS_ACADEMIC")
                .targetLanguage("en")
                .targetScore(new BigDecimal("7.5"))
                .dailyMinutes(30)
                .currentLevel("INTERMEDIATE")
                .build();

        when(userRepository.findById(1)).thenReturn(Optional.of(mockUser));
        when(userTargetRepository.findFirstByUserId(1)).thenReturn(Optional.of(target));

        OnboardingStatusResponse status = onboardingService.getOnboardingStatus(1);

        assertNotNull(status);
        assertTrue(status.getHasCompletedOnboarding());
        assertEquals("IELTS_ACADEMIC", status.getTargetCertificate());
        assertEquals(new BigDecimal("7.5"), status.getTargetScore());
        assertEquals(30, status.getDailyMinutes());
        assertEquals("INTERMEDIATE", status.getCurrentLevel());
    }
}
