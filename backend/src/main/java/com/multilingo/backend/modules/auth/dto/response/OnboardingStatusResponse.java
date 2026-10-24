package com.multilingo.backend.modules.auth.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class OnboardingStatusResponse {
    Boolean hasCompletedOnboarding;
    String nativeLanguage;
    String targetLanguage;
    String targetCertificate;
    BigDecimal targetScore;
    Integer dailyMinutes;
    String currentLevel;
}
