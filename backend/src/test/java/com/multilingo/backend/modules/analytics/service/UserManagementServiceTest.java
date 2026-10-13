package com.multilingo.backend.modules.analytics.service;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.modules.analytics.adapter.ExamTrackingAdapter;
import com.multilingo.backend.modules.analytics.adapter.GamificationTrackingAdapter;
import com.multilingo.backend.modules.analytics.adapter.UserAccountAdapter;
import com.multilingo.backend.modules.analytics.adapter.dto.UserAccountInfo;
import com.multilingo.backend.modules.analytics.adapter.dto.UserStudyStatInfo;
import com.multilingo.backend.modules.analytics.dto.request.UpdateUserStatusRequest;
import com.multilingo.backend.modules.analytics.dto.response.AdminUserDetailResponse;
import com.multilingo.backend.modules.analytics.dto.response.AdminUserResponse;
import com.multilingo.backend.modules.analytics.service.AuditService;
import com.multilingo.backend.modules.analytics.service.LoginHistoryService;
import com.multilingo.backend.modules.analytics.service.impl.UserManagementServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserManagementServiceTest {

    @Mock
    private UserAccountAdapter userAccountAdapter;

    @Mock
    private ExamTrackingAdapter examTrackingAdapter;

    @Mock
    private GamificationTrackingAdapter gamificationTrackingAdapter;

    @Mock
    private AuditService auditService;

    @Mock
    private LoginHistoryService loginHistoryService;

    @InjectMocks
    private UserManagementServiceImpl userManagementService;

    private UserAccountInfo sampleUserInfo;

    @BeforeEach
    void setUp() {
        sampleUserInfo = UserAccountInfo.builder()
                .id(10)
                .email("student@example.com")
                .fullName("Nguyen Van A")
                .roleName("USER")
                .subscriptionTier("FREE")
                .isActive(true)
                .lastLoginIp("127.0.0.1")
                .lastLoginAt(Instant.now())
                .createdAt(Instant.now())
                .build();
    }

    @Test
    @DisplayName("Should query users with pagination via adapter")
    void testGetUsers() {
        PageResponse<UserAccountInfo> adapterPage = PageResponse.<UserAccountInfo>builder()
                .items(List.of(sampleUserInfo))
                .page(0)
                .size(10)
                .totalElements(1L)
                .totalPages(1)
                .last(true)
                .build();

        when(userAccountAdapter.findUsers(eq("Nguyen"), eq(true), eq("FREE"), any(PageRequest.class)))
                .thenReturn(adapterPage);

        PageResponse<AdminUserResponse> result = userManagementService.getUsers("Nguyen", true, "FREE", PageRequest.of(0, 10));

        assertThat(result.getItems()).hasSize(1);
        AdminUserResponse item = result.getItems().get(0);
        assertThat(item.getEmail()).isEqualTo("student@example.com");
        assertThat(item.getRole()).isEqualTo("USER");
        assertThat(item.getSubscriptionTier()).isEqualTo("FREE");
    }

    @Test
    @DisplayName("Should lock user, revoke sessions via adapter and record audit log via AuditService")
    void testLockUser() {
        when(userAccountAdapter.findUserById(10)).thenReturn(Optional.of(sampleUserInfo));

        UserAccountInfo updatedInfo = UserAccountInfo.builder()
                .id(10)
                .email("student@example.com")
                .fullName("Nguyen Van A")
                .roleName("USER")
                .subscriptionTier("FREE")
                .isActive(false)
                .build();
        when(userAccountAdapter.updateUserActiveStatus(10, false)).thenReturn(updatedInfo);

        UpdateUserStatusRequest request = UpdateUserStatusRequest.builder()
                .isActive(false)
                .reason("Nghi ngờ chia sẻ tài khoản")
                .build();

        AdminUserResponse response = userManagementService.updateUserStatus(1, 10, request, "10.0.0.1");

        assertThat(response.getIsActive()).isFalse();

        // Kiểm tra gọi revoke qua adapter
        verify(userAccountAdapter).revokeUserSessions(10);

        // Kiểm tra gọi ghi audit log qua AuditService
        ArgumentCaptor<Map<String, Object>> detailsCaptor = ArgumentCaptor.forClass(Map.class);
        verify(auditService).log(eq(1), eq("LOCK_USER"), eq("USER"), eq("10"), detailsCaptor.capture(), eq("10.0.0.1"));
        Map<String, Object> details = detailsCaptor.getValue();
        assertThat(details).containsEntry("reason", "Nghi ngờ chia sẻ tài khoản");
    }

    @Test
    @DisplayName("Should prevent Admin from locking themselves")
    void testAdminCannotLockSelf() {
        UpdateUserStatusRequest request = UpdateUserStatusRequest.builder()
                .isActive(false)
                .reason("Tự khóa")
                .build();

        assertThatThrownBy(() -> userManagementService.updateUserStatus(1, 1, request, "127.0.0.1"))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Không thể tự khóa tài khoản");
    }

    @Test
    @DisplayName("Should return user detail with session history via LoginHistoryService and adapter stats")
    void testGetUserDetail() {
        when(userAccountAdapter.findUserById(10)).thenReturn(Optional.of(sampleUserInfo));
        when(loginHistoryService.getRecentLoginHistory(10)).thenReturn(Collections.emptyList());
        when(loginHistoryService.detectFraudRisk(10)).thenReturn(false);
        when(examTrackingAdapter.countAttemptsByUserId(10)).thenReturn(5L);
        when(examTrackingAdapter.findAverageScoreByUserId(10)).thenReturn(8.5);
        when(gamificationTrackingAdapter.findStudyStatByUserId(10)).thenReturn(Optional.of(
                UserStudyStatInfo.builder().userId(10).totalLearningMinutes(120).currentStreak(4).totalXp(300L).build()
        ));

        AdminUserDetailResponse detail = userManagementService.getUserDetail(10);

        assertThat(detail.getId()).isEqualTo(10);
        assertThat(detail.getEmail()).isEqualTo("student@example.com");
        assertThat(detail.getTotalExamsAttempted()).isEqualTo(5L);
        assertThat(detail.getAverageExamScore()).isEqualTo(8.5);
        assertThat(detail.getTotalLearningMinutes()).isEqualTo(120);
        assertThat(detail.getCurrentStreak()).isEqualTo(4);
        assertThat(detail.getTotalXp()).isEqualTo(300L);
    }
}
