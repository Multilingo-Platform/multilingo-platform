package com.multilingo.backend.modules.auth.service;

import com.multilingo.backend.modules.auth.dto.request.OnboardingRequest;
import com.multilingo.backend.modules.auth.dto.response.OnboardingResponse;
import com.multilingo.backend.modules.auth.dto.response.OnboardingStatusResponse;

public interface StudentOnboardingService {
    OnboardingResponse submitOnboarding(Integer userId, OnboardingRequest request);
    OnboardingStatusResponse getOnboardingStatus(Integer userId);
}
