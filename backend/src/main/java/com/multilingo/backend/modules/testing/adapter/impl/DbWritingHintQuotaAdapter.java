package com.multilingo.backend.modules.testing.adapter.impl;

import com.multilingo.backend.modules.analytics.service.UserQuotaReservationService;
import com.multilingo.backend.modules.testing.adapter.WritingHintQuotaAdapter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
@RequiredArgsConstructor
public class DbWritingHintQuotaAdapter implements WritingHintQuotaAdapter {

    private final UserQuotaReservationService quotaReservationService;

    @Override
    public void lockAccount(Integer userId) {
        quotaReservationService.lockUserQuota(userId);
    }

    @Override
    public java.util.Optional<QuotaReservation> tryReserve(Integer userId) {
        return quotaReservationService.tryReserve(userId)
                .map(res -> new QuotaReservation(res.quotaId(), res.resetDate()));
    }

    @Override
    public QuotaReservation reserve(Integer userId) {
        UserQuotaReservationService.QuotaReservation reservation = quotaReservationService.reserve(userId);
        return new QuotaReservation(reservation.quotaId(), reservation.resetDate());
    }

    @Override
    public boolean refund(Integer quotaId, Instant resetDate) {
        return quotaReservationService.refund(quotaId, resetDate);
    }
}
