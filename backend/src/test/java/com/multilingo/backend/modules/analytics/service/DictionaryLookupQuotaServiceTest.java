package com.multilingo.backend.modules.analytics.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.modules.analytics.entity.UserQuota;
import com.multilingo.backend.modules.analytics.repository.UserQuotaRepository;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.entity.SubscriptionTier;
import com.multilingo.backend.modules.auth.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DictionaryLookupQuotaServiceTest {
    private static final Instant NOW = Instant.parse("2026-10-20T12:00:00Z");
    @Mock private UserQuotaRepository quotaRepository;
    @Mock private UserRepository userRepository;
    @Mock private UserQuotaReservationService reservationService;
    private DictionaryLookupQuotaService service;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        service = new DictionaryLookupQuotaService(quotaRepository, userRepository, reservationService,
                Clock.fixed(NOW, ZoneId.of("Asia/Ho_Chi_Minh")));
        lenient().when(reservationService.tryReserve(anyInt(), anyString()))
                .thenReturn(Optional.of(new UserQuotaReservationService.QuotaReservation(1, NOW.plusSeconds(3600))));
    }

    @Test
    void provisionsFreeQuotaUsingFallbackAndReservesFeature() {
        mockUser(SubscriptionTier.FREE, null);
        when(quotaRepository.findAllByUserIdAndFeatureCodeForUpdate(0, DictionaryLookupQuotaService.FEATURE_CODE)).thenReturn(List.of());
        when(quotaRepository.insertDictionaryLookupQuotaIfAbsent(eq(42), eq(20), eq(NOW), any())).thenReturn(1);
        when(quotaRepository.findAllByUserIdAndFeatureCodeForUpdate(42, DictionaryLookupQuotaService.FEATURE_CODE))
                .thenReturn(List.of(quota(42, 0, Instant.parse("2026-10-21T17:00:00Z"))));

        service.reserveDailyQuota(42);

        verify(quotaRepository).insertDictionaryLookupQuotaIfAbsent(eq(42), eq(20), eq(NOW), any());
        verify(reservationService).tryReserve(42, DictionaryLookupQuotaService.FEATURE_CODE);
    }

    @Test
    void activePremiumUsesVipTemplateAndExpiredPremiumFallsBackToFree() {
        mockUser(SubscriptionTier.PREMIUM, NOW.plusSeconds(60));
        when(quotaRepository.findAllByUserIdAndFeatureCodeForUpdate(-1, DictionaryLookupQuotaService.FEATURE_CODE))
                .thenReturn(List.of(quota(-1, 500, NOW.plusSeconds(3600))));
        when(quotaRepository.insertDictionaryLookupQuotaIfAbsent(eq(42), eq(500), eq(NOW), any())).thenReturn(1);
        when(quotaRepository.findAllByUserIdAndFeatureCodeForUpdate(42, DictionaryLookupQuotaService.FEATURE_CODE))
                .thenReturn(List.of(quota(42, 0, NOW.plusSeconds(3600))));
        service.reserveDailyQuota(42);
        verify(quotaRepository).insertDictionaryLookupQuotaIfAbsent(eq(42), eq(500), eq(NOW), any());

        reset(quotaRepository, reservationService);
        when(reservationService.tryReserve(anyInt(), anyString()))
                .thenReturn(Optional.of(new UserQuotaReservationService.QuotaReservation(1, NOW.plusSeconds(3600))));
        mockUser(SubscriptionTier.PREMIUM, NOW);
        when(quotaRepository.findAllByUserIdAndFeatureCodeForUpdate(0, DictionaryLookupQuotaService.FEATURE_CODE)).thenReturn(List.of());
        when(quotaRepository.insertDictionaryLookupQuotaIfAbsent(eq(42), eq(20), eq(NOW), any())).thenReturn(1);
        when(quotaRepository.findAllByUserIdAndFeatureCodeForUpdate(42, DictionaryLookupQuotaService.FEATURE_CODE))
                .thenReturn(List.of(quota(42, 0, NOW.plusSeconds(3600))));
        service.reserveDailyQuota(42);
        verify(quotaRepository).insertDictionaryLookupQuotaIfAbsent(eq(42), eq(20), eq(NOW), any());
    }

    @Test
    void refreshesLimitWithoutResettingUsageButResetsAtVietnameseMidnight() {
        mockUser(SubscriptionTier.FREE, null);
        when(quotaRepository.findAllByUserIdAndFeatureCodeForUpdate(0, DictionaryLookupQuotaService.FEATURE_CODE))
                .thenReturn(List.of(quota(0, 35, NOW.plusSeconds(3600))));
        when(quotaRepository.insertDictionaryLookupQuotaIfAbsent(eq(42), eq(35), eq(NOW), any())).thenReturn(0);
        UserQuota existing = quota(42, 4, NOW.plusSeconds(60));
        existing.setUsedCount(4);
        when(quotaRepository.findAllByUserIdAndFeatureCodeForUpdate(42, DictionaryLookupQuotaService.FEATURE_CODE))
                .thenReturn(List.of(existing));
        service.reserveDailyQuota(42);
        assertThat(existing.getUsedCount()).isEqualTo(4);
        assertThat(existing.getMaxLimit()).isEqualTo(35);

        existing.setResetDate(NOW.minusSeconds(1));
        service.reserveDailyQuota(42);
        assertThat(existing.getUsedCount()).isZero();
        assertThat(existing.getResetDate()).isEqualTo(Instant.parse("2026-10-20T17:00:00Z"));
    }

    @Test
    void missingUserOrInvalidTemplateFailsClosed() {
        when(userRepository.findById(42)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.reserveDailyQuota(42)).isInstanceOf(AppException.class);

        mockUser(SubscriptionTier.FREE, null);
        when(quotaRepository.findAllByUserIdAndFeatureCodeForUpdate(0, DictionaryLookupQuotaService.FEATURE_CODE))
                .thenReturn(List.of(quota(0, 0, NOW.plusSeconds(3600))));
        assertThatThrownBy(() -> service.reserveDailyQuota(42)).isInstanceOf(AppException.class);
        verifyNoInteractions(reservationService);
    }

    private void mockUser(SubscriptionTier tier, Instant expiry) {
        User user = new User();
        user.setSubscriptionTier(tier);
        user.setPremiumExpiresAt(expiry);
        when(userRepository.findById(42)).thenReturn(Optional.of(user));
    }

    private UserQuota quota(int userId, int limit, Instant reset) {
        return UserQuota.builder().userId(userId).featureCode(DictionaryLookupQuotaService.FEATURE_CODE)
                .usedCount(0).maxLimit(limit).resetDate(reset).build();
    }
}
