package com.multilingo.backend.modules.analytics.controller;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.analytics.dto.request.UpdateQuotaRequest;
import com.multilingo.backend.modules.analytics.dto.request.UpdateUserStatusRequest;
import com.multilingo.backend.modules.analytics.dto.response.*;
import com.multilingo.backend.modules.analytics.service.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminControllersTest {

    @Mock
    private UserManagementService userManagementService;

    @Mock
    private AnalyticsService analyticsService;

    @Mock
    private QuotaService quotaService;

    @Mock
    private AuditService auditService;

    @Mock
    private TransactionReconciliationService transactionReconciliationService;

    @InjectMocks
    private AdminUserController adminUserController;

    @InjectMocks
    private AdminDashboardController adminDashboardController;

    @InjectMocks
    private AdminTrackingController adminTrackingController;

    @InjectMocks
    private AdminQuotaController adminQuotaController;

    @InjectMocks
    private AdminAuditLogController adminAuditLogController;

    @InjectMocks
    private AdminTransactionController adminTransactionController;

    @Test
    @DisplayName("AdminUserController - getUsers returns success")
    void testGetUsers() {
        AdminUserResponse user = AdminUserResponse.builder().id(1).email("test@multilingo.com").build();
        PageResponse<AdminUserResponse> page = PageResponse.<AdminUserResponse>builder().items(List.of(user)).build();

        when(userManagementService.getUsers(any(), any(), any(), any())).thenReturn(page);

        var res = adminUserController.getUsers(null, null, null, PageRequest.of(0, 10));
        assertThat(res.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(res.getBody().getData().getItems()).hasSize(1);
    }

    @Test
    @DisplayName("AdminDashboardController - getDashboardStats returns success")
    void testGetDashboardStats() {
        DashboardStatsResponse stats = DashboardStatsResponse.builder().dau(10L).mau(50L).totalRevenue(BigDecimal.valueOf(1000)).build();
        when(analyticsService.getDashboardStats()).thenReturn(stats);

        var res = adminDashboardController.getDashboardStats();
        assertThat(res.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(res.getBody().getData().getDau()).isEqualTo(10L);
    }

    @Test
    @DisplayName("AdminQuotaController - getAllQuotas returns success")
    void testGetAllQuotas() {
        UserQuotaResponse q = UserQuotaResponse.builder().feature("WRITING_ASSISTANT").dailyLimit(10).build();
        when(quotaService.getAllQuotas()).thenReturn(List.of(q));

        var res = adminQuotaController.getAllQuotas();
        assertThat(res.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(res.getBody().getData()).hasSize(1);
    }

    @Test
    @DisplayName("AdminTransactionController - getTransactions returns success")
    void testGetTransactions() {
        AdminTransactionResponse t = AdminTransactionResponse.builder().vnpTxnRef("TXN_1").amount(BigDecimal.valueOf(99000)).build();
        PageResponse<AdminTransactionResponse> page = PageResponse.<AdminTransactionResponse>builder().items(List.of(t)).build();

        when(transactionReconciliationService.getTransactions(any(), any(), any(), any(), any())).thenReturn(page);

        var res = adminTransactionController.getTransactions(null, null, null, null, PageRequest.of(0, 10));
        assertThat(res.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(res.getBody().getData().getItems()).hasSize(1);
    }
}
