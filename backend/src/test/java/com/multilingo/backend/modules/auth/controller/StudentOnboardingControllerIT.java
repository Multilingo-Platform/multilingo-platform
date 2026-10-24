package com.multilingo.backend.modules.auth.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.common.exception.GlobalExceptionHandler;
import com.multilingo.backend.modules.auth.dto.request.OnboardingRequest;
import com.multilingo.backend.modules.auth.dto.response.OnboardingResponse;
import com.multilingo.backend.modules.auth.dto.response.OnboardingStatusResponse;
import com.multilingo.backend.modules.auth.entity.Role;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.security.CustomUserDetails;
import com.multilingo.backend.modules.auth.service.StudentOnboardingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.math.BigDecimal;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class StudentOnboardingControllerIT {

    private MockMvc mockMvc;

    @Mock
    private StudentOnboardingService onboardingService;

    @InjectMocks
    private StudentOnboardingController onboardingController;

    private ObjectMapper objectMapper;
    private CustomUserDetails mockUserDetails;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();

        User user = User.builder()
                .email("student@example.com")
                .nativeLanguage("vi")
                .targetLanguage("en")
                .hasCompletedOnboarding(false)
                .role(Role.builder().name("STUDENT").build())
                .build();
        user.setId(1);
        mockUserDetails = new CustomUserDetails(user);

        HandlerMethodArgumentResolver authPrincipalResolver = new HandlerMethodArgumentResolver() {
            @Override
            public boolean supportsParameter(MethodParameter parameter) {
                return parameter.hasParameterAnnotation(AuthenticationPrincipal.class);
            }

            @Override
            public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                          NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
                return mockUserDetails;
            }
        };

        mockMvc = MockMvcBuilders.standaloneSetup(onboardingController)
                .setCustomArgumentResolvers(authPrincipalResolver)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("GET /api/v1/student/onboarding/status - Success")
    void getStatus_Success() throws Exception {
        OnboardingStatusResponse response = OnboardingStatusResponse.builder()
                .hasCompletedOnboarding(false)
                .nativeLanguage("vi")
                .targetLanguage("en")
                .build();

        when(onboardingService.getOnboardingStatus(1)).thenReturn(response);

        mockMvc.perform(get("/api/v1/student/onboarding/status")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.hasCompletedOnboarding").value(false))
                .andExpect(jsonPath("$.data.nativeLanguage").value("vi"))
                .andExpect(jsonPath("$.data.targetLanguage").value("en"));
    }

    @Test
    @DisplayName("POST /api/v1/student/onboarding - Success")
    void submitOnboarding_Success() throws Exception {
        OnboardingRequest request = OnboardingRequest.builder()
                .nativeLanguage("vi")
                .targetLanguage("en")
                .targetCertificate("IELTS_ACADEMIC")
                .targetScore(new BigDecimal("7.5"))
                .dailyMinutes(30)
                .currentLevel("INTERMEDIATE")
                .build();

        OnboardingResponse response = OnboardingResponse.builder()
                .userId(1)
                .nativeLanguage("vi")
                .targetLanguage("en")
                .targetCertificate("IELTS_ACADEMIC")
                .targetScore(new BigDecimal("7.5"))
                .dailyMinutes(30)
                .currentLevel("INTERMEDIATE")
                .hasCompletedOnboarding(true)
                .suggestedExamType("IELTS_ACADEMIC")
                .build();

        when(onboardingService.submitOnboarding(eq(1), any(OnboardingRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/student/onboarding")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.userId").value(1))
                .andExpect(jsonPath("$.data.targetCertificate").value("IELTS_ACADEMIC"))
                .andExpect(jsonPath("$.data.targetScore").value(7.5))
                .andExpect(jsonPath("$.data.hasCompletedOnboarding").value(true));
    }

    @Test
    @DisplayName("POST /api/v1/student/onboarding - Fail when same languages")
    void submitOnboarding_Fail_SameLanguage() throws Exception {
        OnboardingRequest request = OnboardingRequest.builder()
                .nativeLanguage("vi")
                .targetLanguage("vi")
                .targetCertificate("IELTS_ACADEMIC")
                .targetScore(new BigDecimal("7.0"))
                .build();

        when(onboardingService.submitOnboarding(eq(1), any(OnboardingRequest.class)))
                .thenThrow(new AppException(ErrorCode.LANGUAGE_SAME));

        mockMvc.perform(post("/api/v1/student/onboarding")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCode.LANGUAGE_SAME.getCode()));
    }
}
