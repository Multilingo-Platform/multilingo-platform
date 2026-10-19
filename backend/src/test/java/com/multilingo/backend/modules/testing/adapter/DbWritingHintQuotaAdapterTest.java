package com.multilingo.backend.modules.testing.adapter;

import com.multilingo.backend.modules.analytics.service.UserQuotaReservationService;
import com.multilingo.backend.modules.testing.adapter.impl.DbWritingHintQuotaAdapter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DbWritingHintQuotaAdapterTest {

    @Mock
    private UserQuotaReservationService reservationService;

    private DbWritingHintQuotaAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new DbWritingHintQuotaAdapter(reservationService);
    }

    @Test
    @DisplayName("reserve ủy quyền cho UserQuotaReservationService.reserve")
    void reserveDelegatesToReservationService() {
        Instant resetDate = Instant.parse("2026-10-12T19:00:00Z");
        UserQuotaReservationService.QuotaReservation reservation =
                new UserQuotaReservationService.QuotaReservation(50, resetDate);

        when(reservationService.reserve(10)).thenReturn(reservation);

        WritingHintQuotaAdapter.QuotaReservation result = adapter.reserve(10);

        assertThat(result.quotaId()).isEqualTo(50);
        assertThat(result.resetDate()).isEqualTo(resetDate);
        verify(reservationService).reserve(10);
    }

    @Test
    @DisplayName("refund ủy quyền cho UserQuotaReservationService.refund")
    void refundDelegatesToReservationService() {
        Instant resetDate = Instant.parse("2026-10-12T19:00:00Z");

        when(reservationService.refund(50, resetDate)).thenReturn(true);

        boolean refunded = adapter.refund(50, resetDate);

        assertThat(refunded).isTrue();
        verify(reservationService).refund(50, resetDate);
    }
}
