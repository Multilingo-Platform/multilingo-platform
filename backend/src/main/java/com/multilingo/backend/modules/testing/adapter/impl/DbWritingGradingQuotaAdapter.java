package com.multilingo.backend.modules.testing.adapter.impl;

import com.multilingo.backend.modules.analytics.service.UserQuotaReservationService;
import com.multilingo.backend.modules.testing.adapter.WritingGradingQuotaAdapter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class DbWritingGradingQuotaAdapter implements WritingGradingQuotaAdapter {

    private final UserQuotaReservationService quotaReservationService;

    @Override
    public void lockAccount(Integer userId) {
        quotaReservationService.lockUserQuota(userId, UserQuotaReservationService.GRADING_FEATURE_CODE);
    }

    @Override
    public Optional<QuotaReservation> tryReserve(Integer userId) {
        return quotaReservationService.tryReserve(userId, UserQuotaReservationService.GRADING_FEATURE_CODE)
                .map(res -> new QuotaReservation(res.quotaId(), res.resetDate()));
    }

    @Override
    public QuotaReservation reserve(Integer userId) {
        UserQuotaReservationService.QuotaReservation reservation =
                quotaReservationService.reserve(userId, UserQuotaReservationService.GRADING_FEATURE_CODE);
        return new QuotaReservation(reservation.quotaId(), reservation.resetDate());
    }

    @Override
    public boolean refund(Integer quotaId, Instant resetDate) {
        return quotaReservationService.refund(quotaId, resetDate);
    }
}
