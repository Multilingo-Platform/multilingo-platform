package com.multilingo.backend.modules.billing.service;

import com.multilingo.backend.modules.billing.dto.request.PaymentCreateRequest;
import com.multilingo.backend.modules.billing.dto.response.PaymentReturnResponse;
import com.multilingo.backend.modules.billing.dto.response.TransactionResponse;
import java.util.Map;

public interface TransactionService {
    TransactionResponse createTransaction(Integer userId, PaymentCreateRequest request, String vnpTxnRef);
    TransactionResponse getTransactionByRef(String vnpTxnRef);
    void processIpnSuccess(String vnpTxnRef, String vnpTransactionNo, String bankCode);
    PaymentReturnResponse processPaymentReturn(Map<String, String> allParams);
}
