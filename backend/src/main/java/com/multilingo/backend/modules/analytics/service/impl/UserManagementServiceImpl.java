package com.multilingo.backend.modules.analytics.service.impl;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.analytics.adapter.ExamTrackingAdapter;
import com.multilingo.backend.modules.analytics.adapter.GamificationTrackingAdapter;
import com.multilingo.backend.modules.analytics.adapter.UserAccountAdapter;
import com.multilingo.backend.modules.analytics.adapter.dto.UserAccountInfo;
import com.multilingo.backend.modules.analytics.adapter.dto.UserStudyStatInfo;
import com.multilingo.backend.modules.analytics.dto.request.UpdateUserStatusRequest;
import com.multilingo.backend.modules.analytics.dto.response.AdminUserDetailResponse;
import com.multilingo.backend.modules.analytics.dto.response.AdminUserResponse;
import com.multilingo.backend.modules.analytics.entity.LoginHistory;
import com.multilingo.backend.modules.analytics.service.AuditService;
import com.multilingo.backend.modules.analytics.service.LoginHistoryService;
import com.multilingo.backend.modules.analytics.service.UserManagementService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserManagementServiceImpl implements UserManagementService {

    private final UserAccountAdapter userAccountAdapter;
    private final ExamTrackingAdapter examTrackingAdapter;
    private final GamificationTrackingAdapter gamificationTrackingAdapter;
    private final AuditService auditService;
    private final LoginHistoryService loginHistoryService;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AdminUserResponse> getUsers(String keyword, Boolean isActive, String subscriptionTier, Pageable pageable) {
        PageResponse<UserAccountInfo> pageInfo = userAccountAdapter.findUsers(keyword, isActive, subscriptionTier, pageable);
        List<AdminUserResponse> content = pageInfo.getItems().stream()
                .map(this::mapToSummaryResponse)
                .collect(Collectors.toList());

        return PageResponse.<AdminUserResponse>builder()
                .items(content)
                .page(pageInfo.getPage())
                .size(pageInfo.getSize())
                .totalElements(pageInfo.getTotalElements())
                .totalPages(pageInfo.getTotalPages())
                .last(pageInfo.isLast())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public AdminUserDetailResponse getUserDetail(Integer userId) {
        UserAccountInfo user = userAccountAdapter.findUserById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        List<LoginHistory> histories = loginHistoryService.getRecentLoginHistory(userId);
        List<AdminUserDetailResponse.LoginHistoryItem> historyItems = histories.stream()
                .map(h -> AdminUserDetailResponse.LoginHistoryItem.builder()
                        .id(h.getId())
                        .ipAddress(h.getIpAddress())
                        .deviceInfo(h.getDeviceInfo())
                        .loginTime(h.getLoginTime())
                        .status(h.getStatus())
                        .build())
                .collect(Collectors.toList());

        long attemptsCount = examTrackingAdapter.countAttemptsByUserId(userId);
        Double avgScore = examTrackingAdapter.findAverageScoreByUserId(userId);

        Optional<UserStudyStatInfo> statOpt = gamificationTrackingAdapter.findStudyStatByUserId(userId);
        Integer learningMinutes = statOpt.map(UserStudyStatInfo::getTotalLearningMinutes).orElse(0);
        Integer streak = statOpt.map(UserStudyStatInfo::getCurrentStreak).orElse(0);
        Long totalXp = statOpt.map(UserStudyStatInfo::getTotalXp).orElse(0L);

        boolean isFraudRisk = loginHistoryService.detectFraudRisk(userId);

        return AdminUserDetailResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .avatarUrl(user.getAvatarUrl())
                .role(user.getRoleName())
                .subscriptionTier(user.getSubscriptionTier())
                .isActive(user.getIsActive())
                .nativeLanguage(user.getNativeLanguage())
                .targetLanguage(user.getTargetLanguage())
                .phone(user.getPhone())
                .premiumExpiresAt(user.getPremiumExpiresAt())
                .createdAt(user.getCreatedAt())
                .lastLoginAt(user.getLastLoginAt())
                .lastLoginIp(user.getLastLoginIp())
                .isFraudRisk(isFraudRisk)
                .totalExamsAttempted(attemptsCount)
                .averageExamScore(avgScore != null ? Math.round(avgScore * 10.0) / 10.0 : null)
                .totalLearningMinutes(learningMinutes)
                .currentStreak(streak)
                .totalXp(totalXp)
                .recentLoginHistory(historyItems)
                .build();
    }

    @Override
    @Transactional
    public AdminUserResponse updateUserStatus(Integer currentAdminId, Integer targetUserId, UpdateUserStatusRequest request, String ipAddress) {
        if (currentAdminId != null && currentAdminId.equals(targetUserId) && Boolean.FALSE.equals(request.getIsActive())) {
            throw new AppException(ErrorCode.CANNOT_LOCK_SELF);
        }

        UserAccountInfo user = userAccountAdapter.findUserById(targetUserId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        boolean oldStatus = Boolean.TRUE.equals(user.getIsActive());
        boolean newStatus = Boolean.TRUE.equals(request.getIsActive());

        UserAccountInfo updated = userAccountAdapter.updateUserActiveStatus(targetUserId, newStatus);

        // Nếu khóa tài khoản, thu hồi và xóa sạch Refresh Tokens để ép logout khỏi các thiết bị
        if (!newStatus) {
            userAccountAdapter.revokeUserSessions(targetUserId);
            log.info("Revoked all refresh tokens for locked user id: {}", targetUserId);
        }

        // Ghi nhận Audit Log thông qua AuditService
        String action = newStatus ? "UNLOCK_USER" : "LOCK_USER";
        Map<String, Object> details = new HashMap<>();
        details.put("oldStatus", oldStatus);
        details.put("newStatus", newStatus);
        details.put("reason", request.getReason() != null ? request.getReason() : "");

        auditService.log(currentAdminId, action, "USER", targetUserId.toString(), details, ipAddress);

        return mapToSummaryResponse(updated);
    }

    private AdminUserResponse mapToSummaryResponse(UserAccountInfo user) {
        return AdminUserResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .avatarUrl(user.getAvatarUrl())
                .role(user.getRoleName())
                .subscriptionTier(user.getSubscriptionTier())
                .isActive(user.getIsActive())
                .createdAt(user.getCreatedAt())
                .lastLoginAt(user.getLastLoginAt())
                .lastLoginIp(user.getLastLoginIp())
                .isFraudRisk(false)
                .build();
    }
}
