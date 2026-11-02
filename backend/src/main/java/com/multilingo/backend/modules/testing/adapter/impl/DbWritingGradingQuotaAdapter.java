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
        return Optional.ofNullable(tryReserveDetailed(userId).reservation());
    }

    @Override
    public QuotaAttempt tryReserveDetailed(Integer userId) {
        UserQuotaReservationService.QuotaReservationAttempt attempt = quotaReservationService.tryReserveDetailed(
                userId, UserQuotaReservationService.GRADING_FEATURE_CODE);
        QuotaReservation reservation = attempt.reservation() == null ? null
                : new QuotaReservation(attempt.reservation().quotaId(), attempt.reservation().resetDate());
        return new QuotaAttempt(reservation, attempt.denialReason() == null ? null : attempt.denialReason().name());
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
