package com.multilingo.backend.modules.testing.adapter;

import java.time.Instant;
import java.util.Optional;

public interface WritingGradingQuotaAdapter {

    record QuotaReservation(
            Integer quotaId,
            Instant resetDate
    ) {}

    void lockAccount(Integer userId);

    Optional<QuotaReservation> tryReserve(Integer userId);

    QuotaReservation reserve(Integer userId);

    boolean refund(Integer quotaId, Instant resetDate);
}
