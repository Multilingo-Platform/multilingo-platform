package com.multilingo.backend.modules.analytics.service;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.analytics.adapter.BillingTransactionAdapter;
import com.multilingo.backend.modules.analytics.adapter.UserAccountAdapter;
import com.multilingo.backend.modules.analytics.adapter.dto.TransactionInfo;
import com.multilingo.backend.modules.analytics.adapter.dto.UserAccountInfo;
import com.multilingo.backend.modules.analytics.dto.response.AdminTransactionResponse;
import com.multilingo.backend.modules.analytics.service.impl.TransactionReconciliationServiceImpl;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransactionReconciliationServiceTest {

    @Mock
    private BillingTransactionAdapter billingTransactionAdapter;

    @Mock
    private UserAccountAdapter userAccountAdapter;

    @InjectMocks
    private TransactionReconciliationServiceImpl service;

    @Test
    @DisplayName("Should query transactions and enrich with user email")
    void testGetTransactions() {
        TransactionInfo info = TransactionInfo.builder()
                .id(101)
                .userId(15)
                .planName("PREMIUM 1 MONTH")
                .vnpTxnRef("TXN_123456")
                .vnpTransactionNo("1456789")
                .amount(BigDecimal.valueOf(199000))
                .status("SUCCESS")
                .paymentMethod("VNPAY")
                .createdAt(Instant.now())
                .paidAt(Instant.now())
                .build();

        PageResponse<TransactionInfo> page = PageResponse.<TransactionInfo>builder()
                .items(List.of(info))
                .page(0)
                .size(10)
                .totalElements(1)
                .totalPages(1)
                .last(true)
                .build();

        when(billingTransactionAdapter.findTransactions(any(), any(), any(), any(), any())).thenReturn(page);

        UserAccountInfo user = UserAccountInfo.builder()
                .id(15)
                .email("student@multilingo.com")
                .fullName("Test Student")
                .build();
        when(userAccountAdapter.findUsersByIds(any())).thenReturn(Map.of(15, user));

        PageResponse<AdminTransactionResponse> result = service.getTransactions("TXN", "SUCCESS", null, null, PageRequest.of(0, 10));

        assertThat(result.getItems()).hasSize(1);
        AdminTransactionResponse item = result.getItems().get(0);
        assertThat(item.getVnpTxnRef()).isEqualTo("TXN_123456");
        assertThat(item.getUserEmail()).isEqualTo("student@multilingo.com");
        assertThat(item.getAmount()).isEqualByComparingTo(BigDecimal.valueOf(199000));
        assertThat(item.getStatus()).isEqualTo("SUCCESS");
    }

    @Test
    @DisplayName("Should return all transactions for export")
    void testGetAllTransactionsForExport() {
        TransactionInfo info = TransactionInfo.builder()
                .id(102)
                .userId(20)
                .vnpTxnRef("TXN_999999")
                .amount(BigDecimal.valueOf(500000))
                .status("SUCCESS")
                .build();

        PageResponse<TransactionInfo> page = PageResponse.<TransactionInfo>builder()
                .items(List.of(info))
                .build();

        when(billingTransactionAdapter.findTransactions(any(), any(), any(), any(), any())).thenReturn(page);
        when(userAccountAdapter.findUsersByIds(any())).thenReturn(Map.of());

        List<AdminTransactionResponse> list = service.getAllTransactionsForExport(null, "SUCCESS", null, null);

        assertThat(list).hasSize(1);
        assertThat(list.get(0).getVnpTxnRef()).isEqualTo("TXN_999999");
    }
}
