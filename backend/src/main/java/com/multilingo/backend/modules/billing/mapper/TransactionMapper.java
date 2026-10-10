package com.multilingo.backend.modules.billing.mapper;

import com.multilingo.backend.modules.billing.dto.request.PaymentCreateRequest;
import com.multilingo.backend.modules.billing.entity.SubscriptionPlan;
import com.multilingo.backend.modules.billing.entity.Transaction;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface TransactionMapper {
    @Mapping(target = "paidAt", ignore = true)
    @Mapping(target = "vnpTransactionNo", ignore = true)
    @Mapping(target = "bankCode", source = "request.bankCode")
    @Mapping(target = "status", constant = "PENDING")
    @Mapping(target = "paymentMethod", constant = "VNPAY")
    @Mapping(target = "plan", source = "plan")
    @Mapping(target = "userId", source = "userId")
    @Mapping(target = "vnpTxnRef", source = "vnpTxnRef")
    @Mapping(target = "amount", source = "plan.price") // Lấy giá từ Database của Plan để tránh gian lận
    Transaction toEntity(PaymentCreateRequest request, SubscriptionPlan plan, Integer userId, String vnpTxnRef);
}
