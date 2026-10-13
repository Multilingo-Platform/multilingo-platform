package com.multilingo.backend.modules.analytics.service;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.analytics.adapter.UserAccountAdapter;
import com.multilingo.backend.modules.analytics.adapter.dto.UserAccountInfo;
import com.multilingo.backend.modules.analytics.dto.response.AuditLogResponse;
import com.multilingo.backend.modules.analytics.entity.AuditLog;
import com.multilingo.backend.modules.analytics.repository.AuditLogRepository;
import com.multilingo.backend.modules.analytics.service.impl.AuditServiceImpl;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditServiceTest {

    @Mock
    private AuditLogRepository auditLogRepository;

    @Mock
    private UserAccountAdapter userAccountAdapter;

    @InjectMocks
    private AuditServiceImpl auditService;

    @Test
    @DisplayName("Should query audit logs with pagination and map user information via adapter")
    void testGetAuditLogs() {
        AuditLog logItem = AuditLog.builder()
                .userId(1)
                .action("LOCK_USER")
                .entityType("USER")
                .entityId("10")
                .details(Map.of("reason", "Suspicious activity"))
                .ipAddress("127.0.0.1")
                .build();
        logItem.setId(100);

        UserAccountInfo adminInfo = UserAccountInfo.builder()
                .id(1)
                .email("admin@multilingo.com")
                .fullName("System Admin")
                .build();

        Page<AuditLog> logPage = new PageImpl<>(List.of(logItem), PageRequest.of(0, 10), 1);
        when(auditLogRepository.findAll(any(Specification.class), any(Pageable.class))).thenReturn(logPage);
        when(userAccountAdapter.findUsersByIds(any())).thenReturn(Map.of(1, adminInfo));

        PageResponse<AuditLogResponse> response = auditService.getAuditLogs(1, "LOCK_USER", null, null, null, PageRequest.of(0, 10));

        assertThat(response.getItems()).hasSize(1);
        AuditLogResponse item = response.getItems().get(0);
        assertThat(item.getAction()).isEqualTo("LOCK_USER");
        assertThat(item.getUserEmail()).isEqualTo("admin@multilingo.com");
        assertThat(item.getDetails()).containsEntry("reason", "Suspicious activity");
    }

    @Test
    @DisplayName("Should return audit log detail by ID")
    void testGetAuditLogDetail_found() {
        AuditLog logItem = AuditLog.builder()
                .userId(1)
                .action("UPDATE_QUOTA")
                .entityType("USER_QUOTA")
                .entityId("WRITING_ASSISTANT:FREE")
                .details(Map.of("newLimit", 10))
                .build();
        logItem.setId(200);

        when(auditLogRepository.findById(200)).thenReturn(Optional.of(logItem));

        AuditLogResponse res = auditService.getAuditLogDetail(200);

        assertThat(res.getId()).isEqualTo(200);
        assertThat(res.getAction()).isEqualTo("UPDATE_QUOTA");
        assertThat(res.getDetails()).containsEntry("newLimit", 10);
    }

    @Test
    @DisplayName("Should throw RESOURCE_NOT_FOUND when audit log does not exist")
    void testGetAuditLogDetail_notFound() {
        when(auditLogRepository.findById(999)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> auditService.getAuditLogDetail(999))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND));
    }

    @Test
    @DisplayName("Should record audit log correctly into repository")
    void testLog_Success() {
        org.mockito.ArgumentCaptor<AuditLog> captor = org.mockito.ArgumentCaptor.forClass(AuditLog.class);

        auditService.log(1, "LOCK_USER", "USER", "10", Map.of("reason", "Violated policy"), "192.168.1.1");

        org.mockito.Mockito.verify(auditLogRepository).save(captor.capture());
        AuditLog saved = captor.getValue();
        assertThat(saved.getUserId()).isEqualTo(1);
        assertThat(saved.getAction()).isEqualTo("LOCK_USER");
        assertThat(saved.getEntityType()).isEqualTo("USER");
        assertThat(saved.getEntityId()).isEqualTo("10");
        assertThat(saved.getIpAddress()).isEqualTo("192.168.1.1");
        assertThat(saved.getDetails()).containsEntry("reason", "Violated policy");
    }
}
