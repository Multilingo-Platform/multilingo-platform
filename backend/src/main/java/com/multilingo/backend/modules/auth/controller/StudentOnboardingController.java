package com.multilingo.backend.modules.auth.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.auth.dto.request.OnboardingRequest;
import com.multilingo.backend.modules.auth.dto.response.OnboardingResponse;
import com.multilingo.backend.modules.auth.dto.response.OnboardingStatusResponse;
import com.multilingo.backend.modules.auth.security.CustomUserDetails;
import com.multilingo.backend.modules.auth.service.StudentOnboardingService;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/student/onboarding")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class StudentOnboardingController {

    StudentOnboardingService onboardingService;

    @GetMapping("/status")
    public ResponseEntity<ApiResponse<OnboardingStatusResponse>> getStatus(
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Integer userId = extractUserId(userDetails);
        OnboardingStatusResponse response = onboardingService.getOnboardingStatus(userId);
        return ResponseEntity.ok(ApiResponse.success("Lấy trạng thái onboarding thành công", response));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<OnboardingResponse>> submitOnboarding(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody OnboardingRequest request
    ) {
        Integer userId = extractUserId(userDetails);
        OnboardingResponse response = onboardingService.submitOnboarding(userId, request);
        return ResponseEntity.ok(ApiResponse.success("Thiết lập mục tiêu học tập thành công", response));
    }

    private Integer extractUserId(CustomUserDetails userDetails) {
        if (userDetails != null && userDetails.getUser() != null) {
            return userDetails.getUser().getId();
        }
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomUserDetails cud && cud.getUser() != null) {
            return cud.getUser().getId();
        }
        throw new AppException(ErrorCode.UNAUTHENTICATED_ACCESS);
    }
}
