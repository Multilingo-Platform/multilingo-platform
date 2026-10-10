package com.multilingo.backend.modules.billing.controller;

import com.multilingo.backend.modules.billing.service.VNPayService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.HashMap;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.multilingo.backend.modules.auth.security.CustomUserDetails;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import lombok.experimental.FieldDefaults;
import lombok.AccessLevel;

@RestController
@RequestMapping("/api/v1/billing/vnpay")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class BillingController {

    VNPayService vnPayService;
    com.multilingo.backend.modules.billing.service.TransactionService transactionService;
    
    @PostMapping("/create-payment")
    public com.multilingo.backend.common.dto.ApiResponse<com.multilingo.backend.modules.billing.dto.response.PaymentCreateResponse> createPayment(
            @RequestBody com.multilingo.backend.modules.billing.dto.request.PaymentCreateRequest requestBody, 
            HttpServletRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
            
        if (userDetails == null || userDetails.getUser() == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED_ACCESS);
        }
        
        Integer userId = userDetails.getUser().getId();
        
        String ipAddr = request.getRemoteAddr();
        String vnpTxnRef = "TXN" + System.currentTimeMillis();
        
        com.multilingo.backend.modules.billing.entity.Transaction txn = transactionService.createTransaction(userId, requestBody, vnpTxnRef);
        
        String url = vnPayService.createPaymentUrl(txn.getVnpTxnRef(), txn.getAmount().longValue(), requestBody.getBankCode(), ipAddr);
        
        com.multilingo.backend.modules.billing.dto.response.PaymentCreateResponse response = new com.multilingo.backend.modules.billing.dto.response.PaymentCreateResponse();
        response.setPaymentUrl(url);
        
        return com.multilingo.backend.common.dto.ApiResponse.success(response);
    }
    
    @GetMapping("/ipn")
    public String ipnWebhook(@RequestParam Map<String, String> allParams) {
        String secureHash = allParams.get("vnp_SecureHash");
        if (secureHash == null || !vnPayService.verifySignature(new HashMap<>(allParams), secureHash)) {
            return "{\"RspCode\":\"97\",\"Message\":\"Invalid signature\"}";
        }

        String txnRef = allParams.get("vnp_TxnRef");
        com.multilingo.backend.modules.billing.entity.Transaction txn = transactionService.getTransactionByRef(txnRef);
        if (txn == null) {
            return "{\"RspCode\":\"01\",\"Message\":\"Order not found\"}";
        }

        long vnpAmount = Long.parseLong(allParams.get("vnp_Amount"));
        if (txn.getAmount().longValue() * 100 != vnpAmount) {
            return "{\"RspCode\":\"04\",\"Message\":\"Invalid amount\"}";
        }

        if (!"PENDING".equals(txn.getStatus())) {
            return "{\"RspCode\":\"02\",\"Message\":\"Order already confirmed\"}";
        }

        String rspCode = allParams.get("vnp_ResponseCode");
        if ("00".equals(rspCode)) {
            transactionService.processIpnSuccess(txnRef, allParams.get("vnp_TransactionNo"), allParams.get("vnp_BankCode"));
        } else {
            // Có thể thêm logic lưu trạng thái FAILED
        }

        return "{\"RspCode\":\"00\",\"Message\":\"Confirm Success\"}";
    }
}
