package com.multilingo.backend.modules.testing.adapter;

import com.multilingo.backend.modules.analytics.service.UserQuotaReservationService;
import com.multilingo.backend.modules.testing.adapter.impl.DbWritingGradingQuotaAdapter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DbWritingGradingQuotaAdapterTest {

    private static final String FEATURE_CODE = "AI_WRITING_GRADING";

    @Mock
    private UserQuotaReservationService reservationService;

    private DbWritingGradingQuotaAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new DbWritingGradingQuotaAdapter(reservationService);
    }

    @Test
    @DisplayName("lockAccount ủy quyền cho UserQuotaReservationService.lockUserQuota với feature AI_WRITING_GRADING")
    void lockAccountDelegatesToReservationServiceWithGradingFeature() {
        adapter.lockAccount(10);
        verify(reservationService).lockUserQuota(10, FEATURE_CODE);
    }

    @Test
    @DisplayName("tryReserve ủy quyền cho UserQuotaReservationService.tryReserve với feature AI_WRITING_GRADING")
    void tryReserveDelegatesToReservationServiceWithGradingFeature() {
        Instant resetDate = Instant.parse("2026-10-13T19:00:00Z");
        UserQuotaReservationService.QuotaReservation reservation =
                new UserQuotaReservationService.QuotaReservation(200, resetDate);

        when(reservationService.tryReserve(10, FEATURE_CODE)).thenReturn(Optional.of(reservation));

        Optional<WritingGradingQuotaAdapter.QuotaReservation> result = adapter.tryReserve(10);

        assertThat(result).isPresent();
        assertThat(result.get().quotaId()).isEqualTo(200);
        assertThat(result.get().resetDate()).isEqualTo(resetDate);
        verify(reservationService).tryReserve(10, FEATURE_CODE);
    }

    @Test
    @DisplayName("reserve ủy quyền cho UserQuotaReservationService.reserve với feature AI_WRITING_GRADING")
    void reserveDelegatesToReservationServiceWithGradingFeature() {
        Instant resetDate = Instant.parse("2026-10-13T19:00:00Z");
        UserQuotaReservationService.QuotaReservation reservation =
                new UserQuotaReservationService.QuotaReservation(200, resetDate);

        when(reservationService.reserve(10, FEATURE_CODE)).thenReturn(reservation);

        WritingGradingQuotaAdapter.QuotaReservation result = adapter.reserve(10);

        assertThat(result.quotaId()).isEqualTo(200);
        assertThat(result.resetDate()).isEqualTo(resetDate);
        verify(reservationService).reserve(10, FEATURE_CODE);
    }

    @Test
    @DisplayName("refund ủy quyền cho UserQuotaReservationService.refund")
    void refundDelegatesToReservationService() {
        Instant resetDate = Instant.parse("2026-10-13T19:00:00Z");

        when(reservationService.refund(200, resetDate)).thenReturn(true);

        boolean refunded = adapter.refund(200, resetDate);

        assertThat(refunded).isTrue();
        verify(reservationService).refund(200, resetDate);
    }
}
