package com.multilingo.backend.modules.analytics.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.analytics.entity.UserQuota;
import com.multilingo.backend.modules.analytics.repository.UserQuotaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.multilingo.backend.modules.auth.entity.SubscriptionTier;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.repository.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserQuotaReservationServiceTest {

    @Mock
    private UserQuotaRepository userQuotaRepository;

    private Clock clock;
    private Instant fixedNow;
    private UserQuotaReservationService reservationService;

    @BeforeEach
    void setUp() {
        fixedNow = Instant.parse("2026-10-12T18:00:00Z");
        clock = Clock.fixed(fixedNow, ZoneOffset.UTC);
        reservationService = new UserQuotaReservationService(userQuotaRepository, clock);
    }

    @Test
    @DisplayName("lockAccount ném QUOTA_EXCEEDED khi userId null")
    void lockAccountThrowsWhenUserIdNull() {
        assertThatThrownBy(() -> reservationService.lockAccount(null))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.QUOTA_EXCEEDED));
    }

    @Test
    @DisplayName("lockAccount ném QUOTA_EXCEEDED khi không có quota row nào (missing)")
    void lockAccountThrowsWhenNoQuotaRow() {
        when(userQuotaRepository.findAllByUserIdAndFeatureCodeForUpdate(10, UserQuotaReservationService.FEATURE_CODE))
                .thenReturn(List.of());

        assertThatThrownBy(() -> reservationService.lockAccount(10))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.QUOTA_EXCEEDED));
    }

    @Test
    @DisplayName("lockAccount ném QUOTA_EXCEEDED khi có nhiều hơn 1 quota row (duplicate rows fail closed)")
    void lockAccountThrowsWhenDuplicateQuotaRows() {
        UserQuota row1 = UserQuota.builder().userId(10).featureCode("AI_WRITING_HINTS").build();
        UserQuota row2 = UserQuota.builder().userId(10).featureCode("AI_WRITING_HINTS").build();

        when(userQuotaRepository.findAllByUserIdAndFeatureCodeForUpdate(10, UserQuotaReservationService.FEATURE_CODE))
                .thenReturn(List.of(row1, row2));

        assertThatThrownBy(() -> reservationService.lockAccount(10))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.QUOTA_EXCEEDED));
    }

    @Test
    @DisplayName("lockAccount ném QUOTA_EXCEEDED khi used_count âm (corrupt row fail closed)")
    void lockAccountThrowsWhenNegativeUsedCount() {
        UserQuota quota = UserQuota.builder()
                .userId(10)
                .featureCode("AI_WRITING_HINTS")
                .usedCount(-1)
                .maxLimit(5)
                .resetDate(fixedNow.plusSeconds(3600))
                .build();
        quota.setId(1);

        when(userQuotaRepository.findAllByUserIdAndFeatureCodeForUpdate(10, UserQuotaReservationService.FEATURE_CODE))
                .thenReturn(List.of(quota));

        assertThatThrownBy(() -> reservationService.lockAccount(10))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.QUOTA_EXCEEDED));
    }

    @Test
    @DisplayName("lockAccount ném QUOTA_EXCEEDED khi maxLimit <= 0")
    void lockAccountThrowsWhenInvalidMaxLimit() {
        UserQuota quota = UserQuota.builder()
                .userId(10)
                .featureCode("AI_WRITING_HINTS")
                .usedCount(0)
                .maxLimit(0)
                .resetDate(fixedNow.plusSeconds(3600))
                .build();
        quota.setId(1);

        when(userQuotaRepository.findAllByUserIdAndFeatureCodeForUpdate(10, UserQuotaReservationService.FEATURE_CODE))
                .thenReturn(List.of(quota));

        assertThatThrownBy(() -> reservationService.lockAccount(10))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.QUOTA_EXCEEDED));
    }

    @Test
    @DisplayName("lockAccount ném QUOTA_EXCEEDED khi reset_date null hoặc đã hết hạn (expired)")
    void lockAccountThrowsWhenResetDateExpired() {
        UserQuota quota = UserQuota.builder()
                .userId(10)
                .featureCode("AI_WRITING_HINTS")
                .usedCount(0)
                .maxLimit(5)
                .resetDate(fixedNow.minusSeconds(1)) // Expired
                .build();
        quota.setId(1);

        when(userQuotaRepository.findAllByUserIdAndFeatureCodeForUpdate(10, UserQuotaReservationService.FEATURE_CODE))
                .thenReturn(List.of(quota));

        assertThatThrownBy(() -> reservationService.lockAccount(10))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.QUOTA_EXCEEDED));
    }

    @Test
    @DisplayName("lockAccount ném QUOTA_EXCEEDED khi used_count >= maxLimit (exhausted)")
    void lockAccountThrowsWhenQuotaExhausted() {
        UserQuota quota = UserQuota.builder()
                .userId(10)
                .featureCode("AI_WRITING_HINTS")
                .usedCount(5)
                .maxLimit(5)
                .resetDate(fixedNow.plusSeconds(3600))
                .build();
        quota.setId(1);

        when(userQuotaRepository.findAllByUserIdAndFeatureCodeForUpdate(10, UserQuotaReservationService.FEATURE_CODE))
                .thenReturn(List.of(quota));

        assertThatThrownBy(() -> reservationService.lockAccount(10))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.QUOTA_EXCEEDED));
    }

    @Test
    @DisplayName("lockAccount trả về QuotaAccount khi row hợp lệ")
    void lockAccountReturnsQuotaAccountWhenValid() {
        Instant futureReset = fixedNow.plusSeconds(3600);
        UserQuota quota = UserQuota.builder()
                .userId(10)
                .featureCode("AI_WRITING_HINTS")
                .usedCount(1)
                .maxLimit(5)
                .resetDate(futureReset)
                .build();
        quota.setId(100);

        when(userQuotaRepository.findAllByUserIdAndFeatureCodeForUpdate(10, UserQuotaReservationService.FEATURE_CODE))
                .thenReturn(List.of(quota));

        UserQuotaReservationService.QuotaAccount account = reservationService.lockAccount(10);

        assertThat(account.quotaId()).isEqualTo(100);
        assertThat(account.userId()).isEqualTo(10);
        assertThat(account.featureCode()).isEqualTo("AI_WRITING_HINTS");
        assertThat(account.usedCount()).isEqualTo(1);
        assertThat(account.maxLimit()).isEqualTo(5);
        assertThat(account.resetDate()).isEqualTo(futureReset);
    }

    @Test
    @DisplayName("reserve cập nhật có điều kiện thành công và trả về QuotaReservation")
    void reserveSucceedsWhenConditionalIncrementReturnsOne() {
        Instant futureReset = fixedNow.plusSeconds(3600);
        UserQuotaReservationService.QuotaAccount account = new UserQuotaReservationService.QuotaAccount(
                100, 10, "AI_WRITING_HINTS", 0, 1, futureReset
        );

        when(userQuotaRepository.conditionalIncrement(100, futureReset, fixedNow))
                .thenReturn(1);

        UserQuotaReservationService.QuotaReservation reservation = reservationService.reserve(account, fixedNow);

        assertThat(reservation.quotaId()).isEqualTo(100);
        assertThat(reservation.resetDate()).isEqualTo(futureReset);
    }

    @Test
    @DisplayName("reserve ném QUOTA_EXCEEDED khi conditional update thất bại (race / concurrency)")
    void reserveThrowsWhenConditionalIncrementReturnsZero() {
        Instant futureReset = fixedNow.plusSeconds(3600);
        UserQuotaReservationService.QuotaAccount account = new UserQuotaReservationService.QuotaAccount(
                100, 10, "AI_WRITING_HINTS", 0, 1, futureReset
        );

        when(userQuotaRepository.conditionalIncrement(100, futureReset, fixedNow))
                .thenReturn(0);

        assertThatThrownBy(() -> reservationService.reserve(account, fixedNow))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.QUOTA_EXCEEDED));
    }

    @Test
    @DisplayName("reserve theo userId kết hợp lockAccount và conditionalIncrement")
    void reserveByUserIdCoordinatesLockAndReserve() {
        Instant futureReset = fixedNow.plusSeconds(3600);
        UserQuota quota = UserQuota.builder()
                .userId(10)
                .featureCode("AI_WRITING_HINTS")
                .usedCount(0)
                .maxLimit(1)
                .resetDate(futureReset)
                .build();
        quota.setId(100);

        when(userQuotaRepository.findAllByUserIdAndFeatureCodeForUpdate(10, UserQuotaReservationService.FEATURE_CODE))
                .thenReturn(List.of(quota));
        when(userQuotaRepository.conditionalIncrement(100, futureReset, fixedNow))
                .thenReturn(1);

        UserQuotaReservationService.QuotaReservation reservation = reservationService.reserve(10);

        assertThat(reservation.quotaId()).isEqualTo(100);
        assertThat(reservation.resetDate()).isEqualTo(futureReset);
    }

    @Test
    @DisplayName("refund thành công trả về true khi conditionalDecrement trả về 1")
    void refundReturnsTrueWhenSuccessful() {
        Instant reservedPeriod = fixedNow.plusSeconds(3600);

        when(userQuotaRepository.conditionalDecrement(100, reservedPeriod, fixedNow))
                .thenReturn(1);

        boolean refunded = reservationService.refund(100, reservedPeriod);

        assertThat(refunded).isTrue();
    }

    @Test
    @DisplayName("refund trả về false khi conditionalDecrement trả về 0 (khác period hoặc used_count đã = 0)")
    void refundReturnsFalseWhenConditionalDecrementFails() {
        Instant differentPeriod = fixedNow.plusSeconds(7200);

        when(userQuotaRepository.conditionalDecrement(100, differentPeriod, fixedNow))
                .thenReturn(0);

        boolean refunded = reservationService.refund(100, differentPeriod);

        assertThat(refunded).isFalse();
    }

    @Test
    @DisplayName("refund trả về false khi tham số null")
    void refundReturnsFalseWhenParamsNull() {
        assertThat(reservationService.refund(null, fixedNow)).isFalse();
        assertThat(reservationService.refund(100, null)).isFalse();
        verifyNoInteractions(userQuotaRepository);
    }

    @Test
    @DisplayName("lockAccount theo feature code sử dụng đúng feature code được truyền vào")
    void lockAccountWithFeatureCodeUsesProvidedFeatureCode() {
        Instant futureReset = fixedNow.plusSeconds(3600);
        UserQuota gradingQuota = UserQuota.builder()
                .userId(10)
                .featureCode("AI_WRITING_GRADING")
                .usedCount(0)
                .maxLimit(3)
                .resetDate(futureReset)
                .build();
        gradingQuota.setId(200);

        when(userQuotaRepository.findAllByUserIdAndFeatureCodeForUpdate(10, "AI_WRITING_GRADING"))
                .thenReturn(List.of(gradingQuota));

        UserQuotaReservationService.QuotaAccount account = reservationService.lockAccount(10, "AI_WRITING_GRADING");

        assertThat(account.quotaId()).isEqualTo(200);
        assertThat(account.featureCode()).isEqualTo("AI_WRITING_GRADING");
        assertThat(account.usedCount()).isEqualTo(0);
        assertThat(account.maxLimit()).isEqualTo(3);
        verify(userQuotaRepository).findAllByUserIdAndFeatureCodeForUpdate(10, "AI_WRITING_GRADING");
    }

    @Test
    @DisplayName("reserve theo featureCode AI_WRITING_GRADING tăng quota grading và không ảnh hưởng AI_WRITING_HINTS")
    void reserveWithFeatureCodeIncrementsGradingQuotaWithoutTouchingHintsQuota() {
        Instant futureReset = fixedNow.plusSeconds(3600);
        UserQuota gradingQuota = UserQuota.builder()
                .userId(10)
                .featureCode("AI_WRITING_GRADING")
                .usedCount(0)
                .maxLimit(2)
                .resetDate(futureReset)
                .build();
        gradingQuota.setId(200);

        UserQuota hintsQuota = UserQuota.builder()
                .userId(10)
                .featureCode("AI_WRITING_HINTS")
                .usedCount(0)
                .maxLimit(5)
                .resetDate(futureReset)
                .build();
        hintsQuota.setId(100);

        when(userQuotaRepository.findAllByUserIdAndFeatureCodeForUpdate(10, "AI_WRITING_GRADING"))
                .thenReturn(List.of(gradingQuota));
        when(userQuotaRepository.conditionalIncrement(200, futureReset, fixedNow))
                .thenAnswer(inv -> {
                    gradingQuota.setUsedCount(gradingQuota.getUsedCount() + 1);
                    return 1;
                });

        UserQuotaReservationService.QuotaReservation reservation =
                reservationService.reserve(10, "AI_WRITING_GRADING");

        assertThat(reservation.quotaId()).isEqualTo(200);
        assertThat(reservation.resetDate()).isEqualTo(futureReset);
        assertThat(gradingQuota.getUsedCount()).isEqualTo(1);
        assertThat(hintsQuota.getUsedCount()).isZero();
    }

    @Test
    @DisplayName("tryReserve tu dong cap quota AI_WRITING_HINTS khi nguoi dung chua co row trong DB")
    void tryReserveAutoProvisionsWritingHintsQuotaWhenNoRowExists() {
        Instant futureReset = fixedNow.plusSeconds(3600);
        UserQuota createdQuota = UserQuota.builder()
                .userId(5)
                .featureCode("AI_WRITING_HINTS")
                .usedCount(0)
                .maxLimit(5)
                .resetDate(futureReset)
                .build();
        createdQuota.setId(50);

        when(userQuotaRepository.findAllByUserIdAndFeatureCodeForUpdate(5, "AI_WRITING_HINTS"))
                .thenReturn(List.of())
                .thenReturn(List.of(createdQuota));
        when(userQuotaRepository.insertWritingHintsQuotaIfAbsent(eq(5), eq(5), eq(fixedNow), any()))
                .thenReturn(1);
        when(userQuotaRepository.conditionalIncrement(eq(50), any(), eq(fixedNow)))
                .thenReturn(1);

        var reservationOpt = reservationService.tryReserve(5);

        assertThat(reservationOpt).isPresent();
        assertThat(reservationOpt.get().quotaId()).isEqualTo(50);
        verify(userQuotaRepository).insertWritingHintsQuotaIfAbsent(eq(5), eq(5), eq(fixedNow), any());
    }

    @Test
    @DisplayName("tryReserve tu dong reset quota AI_WRITING_HINTS khi buoc sang ngay moi")
    void tryReserveAutoResetsWritingHintsQuotaWhenResetDateExpired() {
        Instant pastReset = fixedNow.minusSeconds(3600);
        UserQuota expiredQuota = UserQuota.builder()
                .userId(5)
                .featureCode("AI_WRITING_HINTS")
                .usedCount(5)
                .maxLimit(5)
                .resetDate(pastReset)
                .build();
        expiredQuota.setId(50);

        when(userQuotaRepository.findAllByUserIdAndFeatureCodeForUpdate(5, "AI_WRITING_HINTS"))
                .thenReturn(List.of(expiredQuota));
        when(userQuotaRepository.conditionalIncrement(eq(50), any(), eq(fixedNow)))
                .thenReturn(1);

        var reservationOpt = reservationService.tryReserve(5);

        assertThat(reservationOpt).isPresent();
        assertThat(reservationOpt.get().quotaId()).isEqualTo(50);
        verify(userQuotaRepository).saveAndFlush(expiredQuota);
        assertThat(expiredQuota.getUsedCount()).isZero();
        assertThat(expiredQuota.getResetDate()).isAfter(fixedNow);
    }

    @Test
    @DisplayName("tryReserve tra ve empty khi da dung het quota trong ngay")
    void tryReserveReturnsEmptyWhenLimitReached() {
        Instant futureReset = fixedNow.plusSeconds(3600);
        UserQuota quota = UserQuota.builder()
                .userId(5)
                .featureCode("AI_WRITING_HINTS")
                .usedCount(5)
                .maxLimit(5)
                .resetDate(futureReset)
                .build();
        quota.setId(50);

        when(userQuotaRepository.findAllByUserIdAndFeatureCodeForUpdate(5, "AI_WRITING_HINTS"))
                .thenReturn(List.of(quota));
        when(userQuotaRepository.conditionalIncrement(eq(50), eq(futureReset), eq(fixedNow)))
                .thenReturn(0);

        var reservationOpt = reservationService.tryReserve(5);

        assertThat(reservationOpt).isEmpty();
    }

    @Test
    @DisplayName("tryReserve tu dong cap quota 20 luot cho nguoi dung VIP")
    void tryReserveAutoProvisionsWithVipLimitWhenUserIsVip() {
        UserRepository userRepo = mock(UserRepository.class);
        User vipUser = mock(User.class);
        when(vipUser.getSubscriptionTier()).thenReturn(SubscriptionTier.PREMIUM);
        when(vipUser.getPremiumExpiresAt()).thenReturn(fixedNow.plusSeconds(86400));
        when(userRepo.findById(5)).thenReturn(java.util.Optional.of(vipUser));

        UserQuotaReservationService vipService = new UserQuotaReservationService(
                userQuotaRepository, clock, null, userRepo
        );

        Instant futureReset = fixedNow.plusSeconds(3600);
        UserQuota createdQuota = UserQuota.builder()
                .userId(5)
                .featureCode("AI_WRITING_HINTS")
                .usedCount(0)
                .maxLimit(20)
                .resetDate(futureReset)
                .build();
        createdQuota.setId(50);

        when(userQuotaRepository.findAllByUserIdAndFeatureCodeForUpdate(5, "AI_WRITING_HINTS"))
                .thenReturn(List.of())
                .thenReturn(List.of(createdQuota));
        when(userQuotaRepository.insertWritingHintsQuotaIfAbsent(eq(5), eq(20), eq(fixedNow), any()))
                .thenReturn(1);
        when(userQuotaRepository.conditionalIncrement(eq(50), any(), eq(fixedNow)))
                .thenReturn(1);

        var reservationOpt = vipService.tryReserve(5);

        assertThat(reservationOpt).isPresent();
        verify(userQuotaRepository).insertWritingHintsQuotaIfAbsent(eq(5), eq(20), eq(fixedNow), any());
    }
}
