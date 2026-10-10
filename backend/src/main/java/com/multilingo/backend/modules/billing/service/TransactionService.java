package com.multilingo.backend.modules.billing.service;

import com.multilingo.backend.modules.billing.dto.request.PaymentCreateRequest;
import com.multilingo.backend.modules.billing.entity.Transaction;

public interface TransactionService {
    Transaction createTransaction(Integer userId, PaymentCreateRequest request, String vnpTxnRef);
    Transaction getTransactionByRef(String vnpTxnRef);
    void processIpnSuccess(String vnpTxnRef, String vnpTransactionNo, String bankCode);
}
