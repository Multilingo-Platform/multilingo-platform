package com.multilingo.backend.modules.testing.adapter;

import java.time.Instant;
import java.util.Optional;

public interface WritingGradingQuotaAdapter {

    record QuotaReservation(
            Integer quotaId,
            Instant resetDate
    ) {}

    record QuotaAttempt(QuotaReservation reservation, String denialCode) {}

    void lockAccount(Integer userId);

    Optional<QuotaReservation> tryReserve(Integer userId);

    default QuotaAttempt tryReserveDetailed(Integer userId) {
        Optional<QuotaReservation> result = tryReserve(userId);
        return new QuotaAttempt(result.orElse(null), result.isPresent() ? null : "QUOTA_UNAVAILABLE");
    }

    QuotaReservation reserve(Integer userId);

    boolean refund(Integer quotaId, Instant resetDate);
}
