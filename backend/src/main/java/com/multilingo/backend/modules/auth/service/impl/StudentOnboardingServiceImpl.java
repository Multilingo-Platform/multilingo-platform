package com.multilingo.backend.modules.auth.service.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.auth.dto.request.OnboardingRequest;
import com.multilingo.backend.modules.auth.dto.response.OnboardingResponse;
import com.multilingo.backend.modules.auth.dto.response.OnboardingStatusResponse;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.entity.UserTarget;
import com.multilingo.backend.modules.auth.repository.UserRepository;
import com.multilingo.backend.modules.auth.repository.UserTargetRepository;
import com.multilingo.backend.modules.auth.service.StudentOnboardingService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class StudentOnboardingServiceImpl implements StudentOnboardingService {

    UserRepository userRepository;
    UserTargetRepository userTargetRepository;

    @Override
    @Transactional
    public OnboardingResponse submitOnboarding(Integer userId, OnboardingRequest request) {
        log.info("Xử lý nộp Onboarding cho userId={}: native={}, target={}, cert={}, score={}",
                userId, request.getNativeLanguage(), request.getTargetLanguage(), request.getTargetCertificate(), request.getTargetScore());

        // 1. Kiểm tra ngôn ngữ
        if (request.getNativeLanguage() == null || request.getTargetLanguage() == null
                || request.getNativeLanguage().trim().equalsIgnoreCase(request.getTargetLanguage().trim())) {
            throw new AppException(ErrorCode.LANGUAGE_SAME);
        }

        // 2. Kiểm tra tính hợp lệ của thang điểm mục tiêu
        validateTargetScore(request.getTargetCertificate(), request.getTargetScore());

        // 3. Tìm kiếm user
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        // 4. Cập nhật thông tin User
        user.setNativeLanguage(request.getNativeLanguage().trim().toLowerCase());
        user.setTargetLanguage(request.getTargetLanguage().trim().toLowerCase());
        user.setHasCompletedOnboarding(true);
        userRepository.save(user);

        // 5. Cập nhật hoặc tạo mới mục tiêu cá nhân (UserTarget)
        Optional<UserTarget> existingTargetOpt = userTargetRepository.findFirstByUserId(userId);
        UserTarget target;
        if (existingTargetOpt.isPresent()) {
            target = existingTargetOpt.get();
            target.setTargetCertificate(request.getTargetCertificate());
            target.setTargetLanguage(request.getTargetLanguage().trim().toLowerCase());
            target.setTargetScore(request.getTargetScore());
            target.setDailyMinutes(request.getDailyMinutes() != null ? request.getDailyMinutes() : 30);
            target.setCurrentLevel(request.getCurrentLevel());
        } else {
            target = UserTarget.builder()
                    .user(user)
                    .targetCertificate(request.getTargetCertificate())
                    .targetLanguage(request.getTargetLanguage().trim().toLowerCase())
                    .targetScore(request.getTargetScore())
                    .dailyMinutes(request.getDailyMinutes() != null ? request.getDailyMinutes() : 30)
                    .currentLevel(request.getCurrentLevel())
                    .build();
        }
        UserTarget savedTarget = userTargetRepository.save(target);

        // 6. Gợi ý đề thi phù hợp
        String suggestedExamType = mapSuggestedExamType(request.getTargetCertificate());

        return OnboardingResponse.builder()
                .userId(user.getId())
                .nativeLanguage(user.getNativeLanguage())
                .targetLanguage(user.getTargetLanguage())
                .targetCertificate(savedTarget.getTargetCertificate())
                .targetScore(savedTarget.getTargetScore())
                .dailyMinutes(savedTarget.getDailyMinutes())
                .currentLevel(savedTarget.getCurrentLevel())
                .hasCompletedOnboarding(user.getHasCompletedOnboarding())
                .suggestedExamType(suggestedExamType)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public OnboardingStatusResponse getOnboardingStatus(Integer userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        Optional<UserTarget> targetOpt = userTargetRepository.findFirstByUserId(userId);

        OnboardingStatusResponse.OnboardingStatusResponseBuilder builder = OnboardingStatusResponse.builder()
                .hasCompletedOnboarding(Boolean.TRUE.equals(user.getHasCompletedOnboarding()))
                .nativeLanguage(user.getNativeLanguage())
                .targetLanguage(user.getTargetLanguage());

        targetOpt.ifPresent(target -> builder
                .targetCertificate(target.getTargetCertificate())
                .targetScore(target.getTargetScore())
                .dailyMinutes(target.getDailyMinutes())
                .currentLevel(target.getCurrentLevel()));

        return builder.build();
    }

    private void validateTargetScore(String cert, BigDecimal score) {
        if (cert == null || cert.trim().isEmpty()) {
            throw new AppException(ErrorCode.TARGET_CERTIFICATE_REQUIRED);
        }
        if (score == null) {
            throw new AppException(ErrorCode.INVALID_TARGET_SCORE);
        }

        String upperCert = cert.trim().toUpperCase();
        double val = score.doubleValue();

        if (upperCert.startsWith("IELTS")) {
            if (val < 4.0 || val > 9.0) {
                throw new AppException(ErrorCode.INVALID_TARGET_SCORE);
            }
        } else if (upperCert.contains("TOEIC_LR") || upperCert.equals("TOEIC")) {
            if (val < 200.0 || val > 990.0) {
                throw new AppException(ErrorCode.INVALID_TARGET_SCORE);
            }
        } else if (upperCert.contains("TOEIC_WRITING")) {
            if (val < 50.0 || val > 200.0) {
                throw new AppException(ErrorCode.INVALID_TARGET_SCORE);
            }
        } else if (upperCert.startsWith("NLTV")) {
            if (val < 1.0 || val > 6.0) {
                throw new AppException(ErrorCode.INVALID_TARGET_SCORE);
            }
        }
    }

    private String mapSuggestedExamType(String cert) {
        if (cert == null) return "IELTS_ACADEMIC";
        String upper = cert.trim().toUpperCase();
        if (upper.contains("IELTS")) return "IELTS_ACADEMIC";
        if (upper.contains("TOEIC_WRITING")) return "TOEIC_WRITING";
        if (upper.contains("TOEIC")) return "TOEIC_LR";
        if (upper.contains("NLTV")) return "NLTV";
        return upper;
    }
}
