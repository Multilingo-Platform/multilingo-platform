package com.multilingo.backend.modules.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class OnboardingRequest {

    @NotBlank(message = "Ngôn ngữ mẹ đẻ không được để trống")
    String nativeLanguage;

    @NotBlank(message = "Ngôn ngữ muốn học không được để trống")
    String targetLanguage;

    @NotBlank(message = "Chứng chỉ mục tiêu không được để trống")
    String targetCertificate;

    @NotNull(message = "Điểm mục tiêu không được để trống")
    BigDecimal targetScore;

    @Builder.Default
    Integer dailyMinutes = 30;

    String currentLevel;
}
