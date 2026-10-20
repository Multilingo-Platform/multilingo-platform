package com.multilingo.backend.modules.analytics.service;

import com.multilingo.backend.common.JpaTestConfig;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.analytics.entity.UserQuota;
import com.multilingo.backend.modules.analytics.repository.UserQuotaRepository;
import com.multilingo.backend.modules.testing.entity.WritingHintRequest;
import com.multilingo.backend.modules.testing.repository.WritingHintRequestRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DataJpaTest
@ActiveProfiles("test")
@Import(JpaTestConfig.class)
class UserQuotaReservationServiceIT {

    @Autowired
    private UserQuotaRepository userQuotaRepository;

    @Autowired
    private WritingHintRequestRepository writingHintRequestRepository;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    @DisplayName("Assertion với maxLimit 1: lần reserve đầu thành công, lần hai thất bại, DB used_count=1; refund hai lần chỉ giảm một lần")
    void reserveAndRefundLifecycleWithMaxLimitOne() {
        Instant fixedNow = Instant.parse("2026-10-12T18:00:00Z");
        Instant resetDate = fixedNow.plusSeconds(3600);
        Clock clock = Clock.fixed(fixedNow, ZoneOffset.UTC);
        UserQuotaReservationService service = new UserQuotaReservationService(userQuotaRepository, clock);

        UserQuota quota = UserQuota.builder()
                .userId(99)
                .featureCode(UserQuotaReservationService.FEATURE_CODE)
                .usedCount(0)
                .maxLimit(1)
                .resetDate(resetDate)
                .build();
        UserQuota saved = userQuotaRepository.saveAndFlush(quota);
        Integer quotaId = saved.getId();

        // 1. Lần reserve đầu tiên thành công -> DB used_count = 1
        UserQuotaReservationService.QuotaReservation res1 = service.reserve(99);
        assertThat(res1.quotaId()).isEqualTo(quotaId);
        assertThat(res1.resetDate()).isEqualTo(resetDate);

        entityManager.clear();
        UserQuota afterFirstReserve = userQuotaRepository.findById(quotaId).orElseThrow();
        assertThat(afterFirstReserve.getUsedCount()).isEqualTo(1);

        // 2. Lần reserve thứ hai thất bại (hết hạn mức) -> DB used_count vẫn = 1
        assertThatThrownBy(() -> service.reserve(99))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.QUOTA_EXCEEDED));

        entityManager.clear();
        UserQuota afterSecondReserve = userQuotaRepository.findById(quotaId).orElseThrow();
        assertThat(afterSecondReserve.getUsedCount()).isEqualTo(1);

        // 3. Lần refund thứ nhất thành công -> DB used_count giảm xuống 0
        boolean refund1 = service.refund(quotaId, resetDate, fixedNow);
        assertThat(refund1).isTrue();

        entityManager.clear();
        UserQuota afterFirstRefund = userQuotaRepository.findById(quotaId).orElseThrow();
        assertThat(afterFirstRefund.getUsedCount()).isEqualTo(0);

        // 4. Lần refund thứ hai thất bại (used_count đã bằng 0, không giảm dưới 0) -> trả về false, DB used_count vẫn = 0
        boolean refund2 = service.refund(quotaId, resetDate, fixedNow);
        assertThat(refund2).isFalse();

        entityManager.clear();
        UserQuota afterSecondRefund = userQuotaRepository.findById(quotaId).orElseThrow();
        assertThat(afterSecondRefund.getUsedCount()).isEqualTo(0);
    }

    @Test
    @DisplayName("P1-01: Refund không clear persistence context, ledger vẫn managed và dirty checking cập nhật đúng status/quotaReserved")
    void refundPreservesManagedLedgerInSameTransactionAndPersistsStatusChange() {
        Instant fixedNow = Instant.parse("2026-10-12T18:00:00Z");
        Instant resetDate = fixedNow.plusSeconds(3600);
        Clock clock = Clock.fixed(fixedNow, ZoneOffset.UTC);
        UserQuotaReservationService service = new UserQuotaReservationService(userQuotaRepository, clock);

        // 1. Tạo và lưu Quota (usedCount = 1)
        UserQuota quota = UserQuota.builder()
                .userId(101)
                .featureCode(UserQuotaReservationService.FEATURE_CODE)
                .usedCount(1)
                .maxLimit(5)
                .resetDate(resetDate)
                .build();
        UserQuota savedQuota = userQuotaRepository.saveAndFlush(quota);

        // 2. Tạo và lưu Ledger WritingHintRequest PENDING với quotaReserved = true
        WritingHintRequest ledger = WritingHintRequest.builder()
                .userId(101)
                .attemptId(20)
                .partId(1)
                .questionId("w1")
                .requestId("req-refund-test-uuid")
                .requestFingerprint("fingerprint-refund")
                .contextJson(Map.of("lang", "en"))
                .status(WritingHintRequest.Status.PENDING)
                .runId("run-1")
                .quotaId(savedQuota.getId())
                .quotaResetDate(resetDate)
                .quotaReserved(true)
                .build();
        WritingHintRequest savedLedger = writingHintRequestRepository.saveAndFlush(ledger);

        // Khẳng định trước khi gọi refund, ledger là managed entity
        assertThat(entityManager.getEntityManager().contains(savedLedger)).isTrue();

        // 3. Thực hiện refund
        boolean refundSuccess = service.refund(savedQuota.getId(), resetDate, fixedNow);
        assertThat(refundSuccess).isTrue();

        // 4. KHẲNG ĐỊNH P1-01 FIX: Ledger vẫn là managed entity trong persistence context (không bị detach do bulk update)
        assertThat(entityManager.getEntityManager().contains(savedLedger)).isTrue();

        // 5. Caller cập nhật ledger qua dirty checking sau khi refund
        savedLedger.setStatus(WritingHintRequest.Status.FAILED);
        savedLedger.setQuotaReserved(false);
        savedLedger.setFailureCode("UPSTREAM_PROVIDER_ERROR");

        // 6. Flush và clear persistence context (mô phỏng commit transaction và mở session mới)
        entityManager.flush();
        entityManager.clear();

        // 7. Xác minh từ DB thật: cả quota đã giảm và ledger đã đổi status FAILED/quotaReserved=false
        UserQuota reloadedQuota = userQuotaRepository.findById(savedQuota.getId()).orElseThrow();
        assertThat(reloadedQuota.getUsedCount()).isEqualTo(0);

        WritingHintRequest reloadedLedger = writingHintRequestRepository.findById(savedLedger.getId()).orElseThrow();
        assertThat(reloadedLedger.getStatus()).isEqualTo(WritingHintRequest.Status.FAILED);
        assertThat(reloadedLedger.getQuotaReserved()).isFalse();
        assertThat(reloadedLedger.getFailureCode()).isEqualTo("UPSTREAM_PROVIDER_ERROR");
    }

    @Test
    @DisplayName("P1-01: Reserve không discard thay đổi của ledger trước bulk update và giữ ledger managed cho thay đổi sau bulk update")
    void reservePreservesManagedLedgerAndFlushesPreUpdateChangesWithoutDiscarding() {
        Instant fixedNow = Instant.parse("2026-10-12T18:00:00Z");
        Instant resetDate = fixedNow.plusSeconds(3600);
        Clock clock = Clock.fixed(fixedNow, ZoneOffset.UTC);
        UserQuotaReservationService service = new UserQuotaReservationService(userQuotaRepository, clock);

        // 1. Tạo Quota (usedCount = 0)
        UserQuota quota = UserQuota.builder()
                .userId(102)
                .featureCode(UserQuotaReservationService.FEATURE_CODE)
                .usedCount(0)
                .maxLimit(5)
                .resetDate(resetDate)
                .build();
        UserQuota savedQuota = userQuotaRepository.saveAndFlush(quota);

        // 2. Tạo Ledger
        WritingHintRequest ledger = WritingHintRequest.builder()
                .userId(102)
                .attemptId(21)
                .partId(1)
                .questionId("w2")
                .requestId("req-reserve-test-uuid")
                .requestFingerprint("fingerprint-reserve")
                .contextJson(Map.of("lang", "en"))
                .status(WritingHintRequest.Status.PENDING)
                .runId("run-initial")
                .quotaReserved(false)
                .build();
        WritingHintRequest savedLedger = writingHintRequestRepository.saveAndFlush(ledger);

        // 3. Thay đổi ledger TRƯỚC KHI gọi bulk update (chưa flush thủ công)
        savedLedger.setRunId("run-modified-before-bulk-increment");

        // 4. Thực hiện reserve (thực thi conditionalIncrement)
        UserQuotaReservationService.QuotaReservation reservation = service.reserve(102);
        assertThat(reservation.quotaId()).isEqualTo(savedQuota.getId());

        // 5. KHẲNG ĐỊNH P1-01 FIX: Ledger vẫn là managed entity
        assertThat(entityManager.getEntityManager().contains(savedLedger)).isTrue();

        // 6. Thay đổi ledger SAU KHI gọi bulk update
        savedLedger.setQuotaId(reservation.quotaId());
        savedLedger.setQuotaResetDate(reservation.resetDate());
        savedLedger.setQuotaReserved(true);

        // 7. Flush và clear persistence context (mô phỏng commit transaction)
        entityManager.flush();
        entityManager.clear();

        // 8. Xác minh từ DB thật: quota tăng lên 1, thay đổi trước bulk update (runId) và sau bulk update (quotaReserved) đều được lưu nguyên vẹn
        UserQuota reloadedQuota = userQuotaRepository.findById(savedQuota.getId()).orElseThrow();
        assertThat(reloadedQuota.getUsedCount()).isEqualTo(1);

        WritingHintRequest reloadedLedger = writingHintRequestRepository.findById(savedLedger.getId()).orElseThrow();
        assertThat(reloadedLedger.getRunId()).isEqualTo("run-modified-before-bulk-increment");
        assertThat(reloadedLedger.getQuotaId()).isEqualTo(savedQuota.getId());
        assertThat(reloadedLedger.getQuotaResetDate()).isEqualTo(reservation.resetDate());
        assertThat(reloadedLedger.getQuotaReserved()).isTrue();
    }

    @Test
    @DisplayName("P1-02: tryReserve sau bulk refund với maxLimit=1 thành công khi EntityManager refresh managed quota")
    void tryReserveAfterBulkRefundWithMaxLimitOneSucceedsWhenEntityManagerRefreshesQuota() {
        Instant fixedNow = Instant.parse("2026-10-12T18:00:00Z");
        Instant resetDate = fixedNow.plusSeconds(3600);
        Clock clock = Clock.fixed(fixedNow, ZoneOffset.UTC);
        UserQuotaReservationService service = new UserQuotaReservationService(userQuotaRepository, clock, entityManager.getEntityManager());

        // 1. Tạo Quota với maxLimit = 1, usedCount = 1
        UserQuota quota = UserQuota.builder()
                .userId(103)
                .featureCode(UserQuotaReservationService.FEATURE_CODE)
                .usedCount(1)
                .maxLimit(1)
                .resetDate(resetDate)
                .build();
        UserQuota savedQuota = userQuotaRepository.saveAndFlush(quota);

        // 2. Lock quota (đưa quota vào persistence context với usedCount = 1)
        service.lockUserQuota(103);

        // 3. Thực hiện bulk refund (giảm usedCount trong DB từ 1 về 0)
        boolean refunded = service.refund(savedQuota.getId(), resetDate, fixedNow);
        assertThat(refunded).isTrue();

        // 4. Gọi tryReserve: nhờ entityManager.refresh(quota), tryReserve đọc được usedCount=0 và conditionalIncrement thành công
        var reservationOpt = service.tryReserve(103);
        assertThat(reservationOpt).isPresent();
        assertThat(reservationOpt.get().quotaId()).isEqualTo(savedQuota.getId());

        entityManager.flush();
        entityManager.clear();

        UserQuota reloaded = userQuotaRepository.findById(savedQuota.getId()).orElseThrow();
        assertThat(reloaded.getUsedCount()).isEqualTo(1);
    }
}
