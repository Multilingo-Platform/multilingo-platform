package com.multilingo.backend.modules.testing.adapter;

import java.time.Instant;

public interface WritingHintQuotaAdapter {

    record QuotaReservation(
            Integer quotaId,
            Instant resetDate
    ) {}

    void lockAccount(Integer userId);

    java.util.Optional<QuotaReservation> tryReserve(Integer userId);

    QuotaReservation reserve(Integer userId);

    boolean refund(Integer quotaId, Instant resetDate);
}
