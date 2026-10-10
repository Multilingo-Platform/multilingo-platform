package com.multilingo.backend.modules.billing.controller;

import com.multilingo.backend.modules.billing.service.VNPayService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;

@WebMvcTest(BillingController.class)
@AutoConfigureMockMvc(addFilters = false)
class BillingControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private VNPayService vnPayService;
    
    @MockBean
    private com.multilingo.backend.modules.billing.service.TransactionService transactionService;
    @MockBean
    private com.multilingo.backend.modules.auth.security.JwtTokenProvider jwtTokenProvider;

    @MockBean
    private com.multilingo.backend.modules.auth.security.CustomUserDetailsService customUserDetailsService;

    @MockBean
    private org.springframework.data.redis.core.StringRedisTemplate stringRedisTemplate;
    
    @Test
    void createPayment_shouldReturnUrl() throws Exception {
        com.multilingo.backend.modules.billing.entity.Transaction mockTxn = com.multilingo.backend.modules.billing.entity.Transaction.builder()
                .vnpTxnRef("TXN123")
                .amount(new java.math.BigDecimal("100000"))
                .build();
        when(transactionService.createTransaction(any(), any(), any())).thenReturn(mockTxn);
        when(vnPayService.createPaymentUrl(any(), any(Long.class), any(), any())).thenReturn("http://vnpay.url");
        com.multilingo.backend.modules.auth.entity.User mockUser = new com.multilingo.backend.modules.auth.entity.User();
        mockUser.setId(1);
        com.multilingo.backend.modules.auth.security.CustomUserDetails mockUserDetails = new com.multilingo.backend.modules.auth.security.CustomUserDetails(mockUser);

        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(mockUserDetails, null, mockUserDetails.getAuthorities())
        );

        try {
            mockMvc.perform(post("/api/v1/billing/vnpay/create-payment")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"planId\":1}"))
                    .andExpect(status().isOk());
        } finally {
            org.springframework.security.core.context.SecurityContextHolder.clearContext();
        }
    }

    @Test
    void ipnWebhook_shouldReturn00_whenValidSignature() throws Exception {
        when(vnPayService.verifySignature(any(), any())).thenReturn(true);
        when(transactionService.getTransactionByRef("TXN")).thenReturn(
            com.multilingo.backend.modules.billing.entity.Transaction.builder().status("PENDING").amount(new java.math.BigDecimal("100000")).build()
        );

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/billing/vnpay/ipn")
                .param("vnp_SecureHash", "hash")
                .param("vnp_TxnRef", "TXN")
                .param("vnp_Amount", "10000000") // 100,000 * 100
                .param("vnp_ResponseCode", "00"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().string(org.hamcrest.Matchers.containsString("\"RspCode\":\"00\"")));
    }
}
