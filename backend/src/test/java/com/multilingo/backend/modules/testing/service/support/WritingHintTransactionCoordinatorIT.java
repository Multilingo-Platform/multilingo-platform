package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.analytics.entity.UserQuota;
import com.multilingo.backend.modules.analytics.repository.UserQuotaRepository;
import com.multilingo.backend.modules.analytics.service.UserQuotaReservationService;
import com.multilingo.backend.modules.auth.entity.Role;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.repository.RoleRepository;
import com.multilingo.backend.modules.auth.repository.UserRepository;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiClient;
import com.multilingo.backend.modules.testing.config.WritingHintsProperties;
import com.multilingo.backend.modules.testing.dto.request.WritingHintsRequest;
import com.multilingo.backend.modules.testing.dto.response.WritingHintsResponse;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.WritingHintRequest;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.repository.WritingHintRequestRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
public class WritingHintTransactionCoordinatorIT {

    public static class MutableClock extends Clock {
        private final AtomicReference<Instant> currentInstant = new AtomicReference<>();
        private final ZoneId zone = ZoneOffset.UTC;

        public void setInstant(Instant instant) {
            this.currentInstant.set(instant);
        }

        public void advance(Duration duration) {
            this.currentInstant.updateAndGet(i -> (i != null ? i : Instant.now()).plus(duration));
        }

        public void reset() {
            this.currentInstant.set(null);
        }

        @Override
        public ZoneId getZone() {
            return zone;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            Instant fixed = currentInstant.get();
            return fixed != null ? fixed : Instant.now();
        }
    }

    @TestConfiguration
    static class MutableClockTestConfig {
        @Bean
        @Primary
        public MutableClock testClock() {
            return new MutableClock();
        }
    }

    @MockBean
    private GeminiClient geminiClient;

    @Autowired
    private WritingHintTransactionCoordinator coordinator;

    @Autowired
    private WritingHintsProperties writingHintsProperties;

    @Autowired
    private UserQuotaRepository userQuotaRepository;

    @Autowired
    private WritingHintRequestRepository requestRepository;

    @Autowired
    private TestAttemptRepository attemptRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private Clock clock;

    private User testUser;
    private Role testRole;

    @BeforeEach
    void setUp() {
        if (clock instanceof MutableClock mc) {
            mc.reset();
        }

        writingHintsProperties.setEnabled(true);
        writingHintsProperties.setMinInterval(Duration.ofSeconds(0)); // Disable cooldown for tests

        requestRepository.deleteAll();
        userQuotaRepository.deleteAll();
        attemptRepository.deleteAll();
        userRepository.deleteAll();

        testRole = roleRepository.findByName("USER")
                .orElseGet(() -> roleRepository.save(Role.builder().name("USER").description("User role").build()));

        testUser = userRepository.save(User.builder()
                .email("it-user-" + UUID.randomUUID() + "@test.com")
                .fullName("IT Test User")
                .role(testRole)
                .nativeLanguage("vi")
                .targetLanguage("en")
                .build());
    }

    private TestAttempt seedAttempt(Integer userId, AttemptStatus status) {
        return attemptRepository.save(TestAttempt.builder()
                .userId(userId)
                .examId(1)
                .testMode(TestMode.PRACTICE)
                .status(status)
                .startTime(clock.instant().minusSeconds(600))
                .deadline(clock.instant().plusSeconds(3600))
                .examSnapshot(Map.of(
                        "sections", List.of(
                                Map.of(
                                        "id", 10,
                                        "name", "WRITING",
                                        "parts", List.of(
                                                Map.of(
                                                        "id", 30,
                                                        "questions", List.of(
                                                                Map.of("question_id", "w1", "type", "ESSAY", "prompt", "Write an essay about AI.")
                                                        )
                                                )
                                        )
                                )
                        )
                ))
                .build());
    }

    private UserQuota seedQuota(Integer userId, int usedCount, int maxLimit) {
        return userQuotaRepository.save(UserQuota.builder()
                .userId(userId)
                .featureCode(UserQuotaReservationService.FEATURE_CODE)
                .usedCount(usedCount)
                .maxLimit(maxLimit)
                .resetDate(clock.instant().plusSeconds(3600))
                .build());
    }

    @Test
    @DisplayName("P1-01: Lazy recovery commit thành công vào DB kể cả khi request mới bị từ chối do xung đột (Denied outcome)")
    void recoveryCommitsEvenWhenSubsequentRequestIsDeniedWithConflict() {
        Instant now = clock.instant();
        UserQuota quota = seedQuota(testUser.getId(), 1, 5);
        TestAttempt attempt = seedAttempt(testUser.getId(), AttemptStatus.IN_PROGRESS);

        // 1. Tạo request quá hạn PENDING đang giữ quota reservation
        WritingHintRequest expiredPending = requestRepository.save(WritingHintRequest.builder()
                .userId(testUser.getId())
                .attemptId(attempt.getId())
                .partId(30)
                .questionId("w1")
                .requestId("expired-pending-req")
                .requestFingerprint("fingerprint-expired")
                .status(WritingHintRequest.Status.PENDING)
                .runId("run-expired")
                .leaseUntil(now.minusSeconds(10)) // Lease đã hết hạn!
                .quotaId(quota.getId())
                .quotaResetDate(quota.getResetDate())
                .quotaReserved(true)
                .build());

        // 2. Tạo một request SUCCEEDED khác với requestId = "req-existing"
        requestRepository.save(WritingHintRequest.builder()
                .userId(testUser.getId())
                .attemptId(attempt.getId())
                .partId(30)
                .questionId("w1")
                .requestId("req-existing")
                .requestFingerprint("fingerprint-original")
                .contextJson(Map.of("requestedLearningLanguage", "en", "requestedHintLanguage", "vi"))
                .status(WritingHintRequest.Status.SUCCEEDED)
                .build());

        // 3. Request mới gửi tới dùng cùng requestId = "req-existing" nhưng payload khác (fr thay vì en) -> CONFLICT!
        WritingHintsRequest conflictingReq = new WritingHintsRequest(30, "w1", "req-existing", "fr", "vi");

        WritingHintTransactionCoordinator.BeginDecision decision =
                coordinator.begin(testUser.getId(), attempt.getId(), conflictingReq);

        // Khẳng định: trả về Denied outcome chứ không ném exception làm rollback recovery
        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.BeginDecision.Denied.class);
        var denied = (WritingHintTransactionCoordinator.BeginDecision.Denied) decision;
        assertThat(denied.errorCode()).isEqualTo(ErrorCode.WRITING_HINTS_REQUEST_CONFLICT);

        // 4. KIỂM CHỨNG TỪ DB: expiredPending đã được recovery commit sang FAILED và quota được refund!
        WritingHintRequest reloadedExpired = requestRepository.findById(expiredPending.getId()).orElseThrow();
        assertThat(reloadedExpired.getStatus()).isEqualTo(WritingHintRequest.Status.FAILED);
        assertThat(reloadedExpired.getQuotaReserved()).isFalse();
        assertThat(reloadedExpired.getFailureCode()).isEqualTo("LEASE_EXPIRED");

        UserQuota reloadedQuota = userQuotaRepository.findById(quota.getId()).orElseThrow();
        assertThat(reloadedQuota.getUsedCount()).isEqualTo(0); // Đã giảm từ 1 về 0
    }

    @Test
    @DisplayName("P1-02: Stale run completion khi attempt kết thúc KHÔNG được hoàn quota của reservation mới")
    void endedAttemptStaleRunCompletionDoesNotRefundNewReservation() {
        Instant now = clock.instant();
        UserQuota quota = seedQuota(testUser.getId(), 1, 5); // 1 reservation đang được giữ bởi new run
        TestAttempt attempt = seedAttempt(testUser.getId(), AttemptStatus.COMPLETED); // Đã nộp bài

        // Ledger mới với runId = "new-run-2026"
        WritingHintRequest newLedger = requestRepository.save(WritingHintRequest.builder()
                .userId(testUser.getId())
                .attemptId(attempt.getId())
                .partId(30)
                .questionId("w1")
                .requestId("req-fencing")
                .requestFingerprint("fingerprint-fencing")
                .status(WritingHintRequest.Status.PENDING)
                .runId("new-run-2026")
                .leaseUntil(now.plusSeconds(30))
                .quotaId(quota.getId())
                .quotaResetDate(quota.getResetDate())
                .quotaReserved(true)
                .build());

        // Callback muộn của old run ("old-run-1999") gửi đến
        WritingHintTransactionCoordinator.Reservation staleReservation = new WritingHintTransactionCoordinator.Reservation(
                newLedger.getId(),
                "old-run-1999", // Mismatch runId!
                testUser.getId(),
                attempt.getId(),
                30,
                "w1",
                "req-fencing",
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi"),
                null,
                now.plusSeconds(30),
                quota.getId(),
                quota.getResetDate()
        );

        WritingHintsResponse.Content content = new WritingHintsResponse.Content(List.of(), List.of(), List.of());

        // Gọi complete cho stale run
        WritingHintTransactionCoordinator.TerminalDecision staleDecision =
                coordinator.complete(staleReservation, content);

        assertThat(staleDecision).isInstanceOf(WritingHintTransactionCoordinator.TerminalDecision.Failure.class);
        var fail = (WritingHintTransactionCoordinator.TerminalDecision.Failure) staleDecision;
        assertThat(fail.errorCode()).isEqualTo(ErrorCode.WRITING_HINTS_TIMEOUT);

        // KHẲNG ĐỊNH: Quota used_count trong DB vẫn là 1, KHÔNG bị stale run hoàn tiền oan!
        UserQuota quotaAfterStale = userQuotaRepository.findById(quota.getId()).orElseThrow();
        assertThat(quotaAfterStale.getUsedCount()).isEqualTo(1);

        WritingHintRequest ledgerAfterStale = requestRepository.findById(newLedger.getId()).orElseThrow();
        assertThat(ledgerAfterStale.getStatus()).isEqualTo(WritingHintRequest.Status.PENDING);
        assertThat(ledgerAfterStale.getQuotaReserved()).isTrue();

        // Bây giờ completion của đúng run hiện tại ("new-run-2026") gửi đến
        WritingHintTransactionCoordinator.Reservation currentReservation = new WritingHintTransactionCoordinator.Reservation(
                newLedger.getId(),
                "new-run-2026",
                testUser.getId(),
                attempt.getId(),
                30,
                "w1",
                "req-fencing",
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi"),
                null,
                now.plusSeconds(30),
                quota.getId(),
                quota.getResetDate()
        );

        WritingHintTransactionCoordinator.TerminalDecision currentDecision =
                coordinator.complete(currentReservation, content);

        assertThat(currentDecision).isInstanceOf(WritingHintTransactionCoordinator.TerminalDecision.Failure.class);
        var currentFail = (WritingHintTransactionCoordinator.TerminalDecision.Failure) currentDecision;
        assertThat(currentFail.errorCode()).isEqualTo(ErrorCode.ATTEMPT_ALREADY_SUBMITTED);

        // KHẲNG ĐỊNH: Run hiện tại hoàn đúng reservation của chính nó (usedCount giảm từ 1 về 0, ledger FAILED)
        UserQuota quotaAfterCurrent = userQuotaRepository.findById(quota.getId()).orElseThrow();
        assertThat(quotaAfterCurrent.getUsedCount()).isEqualTo(0);

        WritingHintRequest ledgerAfterCurrent = requestRepository.findById(newLedger.getId()).orElseThrow();
        assertThat(ledgerAfterCurrent.getStatus()).isEqualTo(WritingHintRequest.Status.FAILED);
        assertThat(ledgerAfterCurrent.getQuotaReserved()).isFalse();
        assertThat(ledgerAfterCurrent.getFailureCode()).isEqualTo("ATTEMPT_ALREADY_SUBMITTED");
    }

    @Test
    @DisplayName("P1-03: Retry của request FAILED và Replay của SUCCEEDED giữ nguyên ngôn ngữ đã đóng băng kể cả khi user đổi targetLanguage")
    void retryAndReplayPreserveFrozenLanguagesWhenUserChangesTargetLanguage() {
        seedQuota(testUser.getId(), 0, 5);
        TestAttempt attempt = seedAttempt(testUser.getId(), AttemptStatus.IN_PROGRESS);

        // 1. Request ban đầu bỏ qua languages (null, null) -> phân giải "en" (do testUser.targetLanguage = "en")
        WritingHintsRequest initialReq = new WritingHintsRequest(30, "w1", "req-frozen-lang", null, null);
        WritingHintTransactionCoordinator.BeginDecision begin1 =
                coordinator.begin(testUser.getId(), attempt.getId(), initialReq);

        assertThat(begin1).isInstanceOf(WritingHintTransactionCoordinator.BeginDecision.Reserved.class);
        var reserved1 = (WritingHintTransactionCoordinator.BeginDecision.Reserved) begin1;
        assertThat(reserved1.reservation().languages().learningLanguage()).isEqualTo("en");
        assertThat(reserved1.reservation().languages().hintLanguage()).isEqualTo("en");

        // Mô phỏng thất bại -> ghi nhận FAILED
        coordinator.fail(reserved1.reservation(), ErrorCode.WRITING_HINTS_TIMEOUT);

        // 2. Người dùng thay đổi targetLanguage trong preferences từ "en" sang "fr"
        testUser.setTargetLanguage("fr");
        userRepository.saveAndFlush(testUser);

        // 3. Người dùng retry với cùng payload (null, null) và cùng requestId = "req-frozen-lang"
        WritingHintTransactionCoordinator.BeginDecision beginRetry =
                coordinator.begin(testUser.getId(), attempt.getId(), initialReq);

        assertThat(beginRetry).isInstanceOf(WritingHintTransactionCoordinator.BeginDecision.Reserved.class);
        var reservedRetry = (WritingHintTransactionCoordinator.BeginDecision.Reserved) beginRetry;

        // KHẲNG ĐỊNH P1-03: Retry sử dụng frozen languages "en", không bị đổi sang "fr" và không bị REQUEST_CONFLICT
        assertThat(reservedRetry.reservation().languages().learningLanguage()).isEqualTo("en");
        assertThat(reservedRetry.reservation().languages().hintLanguage()).isEqualTo("en");

        // Hoàn tất thành công
        WritingHintsResponse.Content content = new WritingHintsResponse.Content(
                List.of(new WritingHintsResponse.OutlineSection("Intro", List.of("Point 1"))),
                List.of(new WritingHintsResponse.VocabularyItem("Term", "Def", "Exp", "Ex")),
                List.of()
        );
        coordinator.complete(reservedRetry.reservation(), content);

        // 4. Replay lại kết quả: vẫn trả về "en", không bị ảnh hưởng bởi user.targetLanguage = "fr"
        WritingHintTransactionCoordinator.BeginDecision beginReplay =
                coordinator.begin(testUser.getId(), attempt.getId(), initialReq);

        assertThat(beginReplay).isInstanceOf(WritingHintTransactionCoordinator.BeginDecision.Replay.class);
        var replay = (WritingHintTransactionCoordinator.BeginDecision.Replay) beginReplay;
        assertThat(replay.response().learningLanguage()).isEqualTo("en");
        assertThat(replay.response().hintLanguage()).isEqualTo("en");

        // 5. Nếu gửi payload thực sự bị thay đổi (explicit learningLanguage = "es") trên cùng requestId -> CONFLICT!
        WritingHintsRequest conflictingReq = new WritingHintsRequest(30, "w1", "req-frozen-lang", "es", "vi");
        WritingHintTransactionCoordinator.BeginDecision beginConflict =
                coordinator.begin(testUser.getId(), attempt.getId(), conflictingReq);

        assertThat(beginConflict).isInstanceOf(WritingHintTransactionCoordinator.BeginDecision.Denied.class);
        assertThat(((WritingHintTransactionCoordinator.BeginDecision.Denied) beginConflict).errorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_REQUEST_CONFLICT);
    }

    @Test
    @DisplayName("P1-08: Gọi overload fail(reservation, errorCode) qua Spring proxy ngoài transaction hoạt động chuẩn xác và commit vào DB")
    void twoArgFailViaSpringProxyExecutesInsideTransactionWithoutException() {
        Instant now = clock.instant();
        UserQuota quota = seedQuota(testUser.getId(), 1, 5);
        TestAttempt attempt = seedAttempt(testUser.getId(), AttemptStatus.IN_PROGRESS);

        WritingHintRequest ledger = requestRepository.save(WritingHintRequest.builder()
                .userId(testUser.getId())
                .attemptId(attempt.getId())
                .partId(30)
                .questionId("w1")
                .requestId("req-two-arg-fail")
                .requestFingerprint("fingerprint-2arg")
                .status(WritingHintRequest.Status.PENDING)
                .runId("run-2arg")
                .leaseUntil(now.plusSeconds(30))
                .quotaId(quota.getId())
                .quotaResetDate(quota.getResetDate())
                .quotaReserved(true)
                .build());

        WritingHintTransactionCoordinator.Reservation reservation = new WritingHintTransactionCoordinator.Reservation(
                ledger.getId(),
                "run-2arg",
                testUser.getId(),
                attempt.getId(),
                30,
                "w1",
                "req-two-arg-fail",
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi"),
                null,
                now.plusSeconds(30),
                quota.getId(),
                quota.getResetDate()
        );

        // Gọi overload 2 tham số fail(reservation, errorCode)
        WritingHintTransactionCoordinator.TerminalDecision decision =
                coordinator.fail(reservation, ErrorCode.WRITING_HINTS_TIMEOUT);

        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.TerminalDecision.Failure.class);

        // KHẲNG ĐỊNH: Đã commit refund quota về 0 và ledger FAILED trong DB (không bị TransactionRequiredException)
        UserQuota reloadedQuota = userQuotaRepository.findById(quota.getId()).orElseThrow();
        assertThat(reloadedQuota.getUsedCount()).isEqualTo(0);

        WritingHintRequest reloadedLedger = requestRepository.findById(ledger.getId()).orElseThrow();
        assertThat(reloadedLedger.getStatus()).isEqualTo(WritingHintRequest.Status.FAILED);
        assertThat(reloadedLedger.getQuotaReserved()).isFalse();
        assertThat(reloadedLedger.getFailureCode()).isEqualTo("WRITING_HINTS_TIMEOUT");
    }

    @Test
    @DisplayName("P2-01: Replay response trả về exact generatedAt giống hệt response ban đầu")
    void replayReturnsExactGeneratedAtMatchingInitialResponse() {
        seedQuota(testUser.getId(), 0, 5);
        TestAttempt attempt = seedAttempt(testUser.getId(), AttemptStatus.IN_PROGRESS);

        WritingHintsRequest req = new WritingHintsRequest(30, "w1", "req-exact-timestamp", "en", "vi");

        var beginDecision = coordinator.begin(testUser.getId(), attempt.getId(), req);
        assertThat(beginDecision).isInstanceOf(WritingHintTransactionCoordinator.BeginDecision.Reserved.class);
        var reserved = ((WritingHintTransactionCoordinator.BeginDecision.Reserved) beginDecision).reservation();

        WritingHintsResponse.Content content = new WritingHintsResponse.Content(
                List.of(new WritingHintsResponse.OutlineSection("Title", List.of("P1"))),
                List.of(new WritingHintsResponse.VocabularyItem("T1", "D1", "E1", "Ex1")),
                List.of()
        );

        var terminalDecision = coordinator.complete(reserved, content);
        assertThat(terminalDecision).isInstanceOf(WritingHintTransactionCoordinator.TerminalDecision.Success.class);
        WritingHintsResponse initialResponse = ((WritingHintTransactionCoordinator.TerminalDecision.Success) terminalDecision).response();

        // Bây giờ gọi Replay
        var replayDecision = coordinator.begin(testUser.getId(), attempt.getId(), req);
        assertThat(replayDecision).isInstanceOf(WritingHintTransactionCoordinator.BeginDecision.Replay.class);
        WritingHintsResponse replayResponse = ((WritingHintTransactionCoordinator.BeginDecision.Replay) replayDecision).response();

        // KHẲNG ĐỊNH P2-01: generatedAt và toàn bộ response bằng nhau 100%
        assertThat(replayResponse.generatedAt()).isEqualTo(initialResponse.generatedAt());
        assertThat(replayResponse).isEqualTo(initialResponse);
    }

    @Test
    @DisplayName("P1-06: Complete kiểm tra lại các guards: nếu section bị khóa trong lúc gọi, hoàn quota và trả CONFLICT")
    void completeRechecksLockedSectionAndRefundsReservation() {
        seedQuota(testUser.getId(), 0, 5);
        TestAttempt attempt = seedAttempt(testUser.getId(), AttemptStatus.IN_PROGRESS);

        WritingHintsRequest req = new WritingHintsRequest(30, "w1", "req-lock-guard", "en", "vi");

        var beginDecision = coordinator.begin(testUser.getId(), attempt.getId(), req);
        assertThat(beginDecision).isInstanceOf(WritingHintTransactionCoordinator.BeginDecision.Reserved.class);
        var reserved = ((WritingHintTransactionCoordinator.BeginDecision.Reserved) beginDecision).reservation();

        // Section 10 bị khóa sau khi begin
        attempt.setLockedSections(List.of(10));
        attemptRepository.saveAndFlush(attempt);

        WritingHintsResponse.Content content = new WritingHintsResponse.Content(List.of(), List.of(), List.of());
        var terminalDecision = coordinator.complete(reserved, content);

        assertThat(terminalDecision).isInstanceOf(WritingHintTransactionCoordinator.TerminalDecision.Failure.class);
        assertThat(((WritingHintTransactionCoordinator.TerminalDecision.Failure) terminalDecision).errorCode())
                .isEqualTo(ErrorCode.CONFLICT);

        // KHẲNG ĐỊNH: Quota được hoàn trả về 0 và ledger được ghi nhận SECTION_LOCKED
        UserQuota reloadedQuota = userQuotaRepository.findById(reserved.quotaId()).orElseThrow();
        assertThat(reloadedQuota.getUsedCount()).isEqualTo(0);

        WritingHintRequest reloadedLedger = requestRepository.findById(reserved.operationId()).orElseThrow();
        assertThat(reloadedLedger.getStatus()).isEqualTo(WritingHintRequest.Status.FAILED);
        assertThat(reloadedLedger.getFailureCode()).isEqualTo("SECTION_LOCKED");
    }

    @Test
    @DisplayName("P1-04: Hai giao dịch đồng thời (complete trên attempt 1 và begin trên attempt 2) cùng user tuân thủ khóa Attempt -> Quota -> Ledger, không deadlock")
    void concurrentOperationsOnDifferentAttemptsSameUserDoNotDeadlock() throws Exception {
        seedQuota(testUser.getId(), 1, 5);
        TestAttempt attempt1 = seedAttempt(testUser.getId(), AttemptStatus.IN_PROGRESS);
        TestAttempt attempt2 = seedAttempt(testUser.getId(), AttemptStatus.IN_PROGRESS);

        // Setup ledger cho attempt 1
        WritingHintRequest ledger1 = requestRepository.save(WritingHintRequest.builder()
                .userId(testUser.getId())
                .attemptId(attempt1.getId())
                .partId(30)
                .questionId("w1")
                .requestId("req-concurrent-1")
                .requestFingerprint("fingerprint-1")
                .status(WritingHintRequest.Status.PENDING)
                .runId("run-c1")
                .leaseUntil(clock.instant().plusSeconds(30))
                .quotaId(userQuotaRepository.findAll().getFirst().getId())
                .quotaResetDate(clock.instant().plusSeconds(3600))
                .quotaReserved(true)
                .build());

        WritingHintTransactionCoordinator.Reservation reservation1 = new WritingHintTransactionCoordinator.Reservation(
                ledger1.getId(),
                "run-c1",
                testUser.getId(),
                attempt1.getId(),
                30,
                "w1",
                "req-concurrent-1",
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi"),
                null,
                clock.instant().plusSeconds(30),
                ledger1.getQuotaId(),
                ledger1.getQuotaResetDate()
        );

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CyclicBarrier barrier = new CyclicBarrier(2);

        WritingHintsResponse.Content content = new WritingHintsResponse.Content(List.of(), List.of(), List.of());
        WritingHintsRequest req2 = new WritingHintsRequest(30, "w1", "req-concurrent-2", "en", "vi");

        Future<WritingHintTransactionCoordinator.TerminalDecision> future1 = executor.submit(() -> {
            barrier.await();
            return coordinator.complete(reservation1, content);
        });

        Future<WritingHintTransactionCoordinator.BeginDecision> future2 = executor.submit(() -> {
            barrier.await();
            return coordinator.begin(testUser.getId(), attempt2.getId(), req2);
        });

        try {
            WritingHintTransactionCoordinator.TerminalDecision termResult = future1.get(10, TimeUnit.SECONDS);
            WritingHintTransactionCoordinator.BeginDecision beginResult = future2.get(10, TimeUnit.SECONDS);

            assertThat(termResult).isInstanceOf(WritingHintTransactionCoordinator.TerminalDecision.Success.class);
            if (beginResult instanceof WritingHintTransactionCoordinator.BeginDecision.Reserved reserved) {
                assertThat(reserved.reservation().operationId()).isNotNull();
            } else if (beginResult instanceof WritingHintTransactionCoordinator.BeginDecision.Denied denied) {
                assertThat(denied.errorCode()).isEqualTo(ErrorCode.WRITING_HINTS_IN_PROGRESS);
            } else {
                org.junit.jupiter.api.Assertions.fail("Unexpected beginResult: " + beginResult);
            }
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    @DisplayName("P1-01: Language denial trả về Denied và commit lazy recovery/refund mà không rollback")
    void denialWithUnsupportedLanguageAfterLazyRecoveryCommitsRecoveryWithoutRollback() {
        TestAttempt attempt = seedAttempt(testUser.getId(), AttemptStatus.IN_PROGRESS);
        UserQuota quota = seedQuota(testUser.getId(), 1, 5);

        WritingHintRequest expiredLedger = WritingHintRequest.builder()
                .userId(testUser.getId())
                .attemptId(attempt.getId())
                .partId(30)
                .questionId("w1")
                .requestId("req-expired-lang-denial")
                .requestFingerprint("fingerprint-lang-denial")
                .contextJson(Map.of("lang", "en"))
                .status(WritingHintRequest.Status.PENDING)
                .runId("run-expired-lang")
                .quotaId(quota.getId())
                .quotaResetDate(quota.getResetDate())
                .quotaReserved(true)
                .leaseUntil(clock.instant().minusSeconds(10))
                .lastStartedAt(clock.instant().minusSeconds(30))
                .build();
        requestRepository.save(expiredLedger);

        WritingHintsRequest req = new WritingHintsRequest(30, "w1", "req-new-lang", "unsupported_lang_xyz", "vi");

        WritingHintTransactionCoordinator.BeginDecision decision =
                coordinator.begin(testUser.getId(), attempt.getId(), req);

        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.BeginDecision.Denied.class);
        var denied = (WritingHintTransactionCoordinator.BeginDecision.Denied) decision;
        assertThat(denied.errorCode()).isEqualTo(ErrorCode.WRITING_HINTS_LANGUAGE_UNSUPPORTED);

        WritingHintRequest recoveredLedger = requestRepository.findById(expiredLedger.getId()).orElseThrow();
        assertThat(recoveredLedger.getStatus()).isEqualTo(WritingHintRequest.Status.FAILED);
        assertThat(recoveredLedger.getQuotaReserved()).isFalse();
        assertThat(recoveredLedger.getFailureCode()).isEqualTo("LEASE_EXPIRED");

        UserQuota reloadedQuota = userQuotaRepository.findById(quota.getId()).orElseThrow();
        assertThat(reloadedQuota.getUsedCount()).isEqualTo(0);
    }

    @Test
    @DisplayName("P1-01: Context denial (prompt rỗng) trả về Denied và commit lazy recovery/refund mà không rollback")
    void denialWithMissingPromptContextAfterLazyRecoveryCommitsRecoveryWithoutRollback() {
        TestAttempt attempt = attemptRepository.save(TestAttempt.builder()
                .userId(testUser.getId())
                .examId(1)
                .testMode(TestMode.PRACTICE)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(clock.instant().minusSeconds(600))
                .examSnapshot(Map.of(
                        "sections", List.of(
                                Map.of(
                                        "id", 10,
                                        "name", "WRITING",
                                        "parts", List.of(
                                                Map.of(
                                                        "id", 30,
                                                        "questions", List.of(
                                                                Map.of("question_id", "w1", "type", "ESSAY", "prompt", "")
                                                        )
                                                )
                                        )
                                )
                        )
                ))
                .build());

        UserQuota quota = seedQuota(testUser.getId(), 1, 5);

        WritingHintRequest expiredLedger = WritingHintRequest.builder()
                .userId(testUser.getId())
                .attemptId(attempt.getId())
                .partId(30)
                .questionId("w1")
                .requestId("req-expired-ctx-denial")
                .requestFingerprint("fingerprint-ctx-denial")
                .contextJson(Map.of("lang", "en"))
                .status(WritingHintRequest.Status.PENDING)
                .runId("run-expired-ctx")
                .quotaId(quota.getId())
                .quotaResetDate(quota.getResetDate())
                .quotaReserved(true)
                .leaseUntil(clock.instant().minusSeconds(10))
                .lastStartedAt(clock.instant().minusSeconds(30))
                .build();
        requestRepository.save(expiredLedger);

        WritingHintsRequest req = new WritingHintsRequest(30, "w1", "req-new-ctx", "en", "vi");

        WritingHintTransactionCoordinator.BeginDecision decision =
                coordinator.begin(testUser.getId(), attempt.getId(), req);

        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.BeginDecision.Denied.class);
        var denied = (WritingHintTransactionCoordinator.BeginDecision.Denied) decision;
        assertThat(denied.errorCode()).isEqualTo(ErrorCode.WRITING_HINTS_CONTEXT_UNAVAILABLE);

        WritingHintRequest recoveredLedger = requestRepository.findById(expiredLedger.getId()).orElseThrow();
        assertThat(recoveredLedger.getStatus()).isEqualTo(WritingHintRequest.Status.FAILED);
        assertThat(recoveredLedger.getQuotaReserved()).isFalse();

        UserQuota reloadedQuota = userQuotaRepository.findById(quota.getId()).orElseThrow();
        assertThat(reloadedQuota.getUsedCount()).isEqualTo(0);
    }

    @Test
    @DisplayName("P1-02: Retry khi maxLimit=1 sau recovery của expired reservation thành công tạo run mới, không bị false QUOTA_EXCEEDED")
    void retryWhenQuotaOneAfterExpiredPendingRecoverySucceeds() {
        TestAttempt attempt = seedAttempt(testUser.getId(), AttemptStatus.IN_PROGRESS);
        UserQuota quota = seedQuota(testUser.getId(), 1, 1);

        String fingerprint = WritingHintTransactionCoordinator.computeFingerprint(attempt.getId(), 30, "w1", "en", "vi");
        WritingHintRequest expiredLedger = WritingHintRequest.builder()
                .userId(testUser.getId())
                .attemptId(attempt.getId())
                .partId(30)
                .questionId("w1")
                .requestId("req-retry-quota1")
                .requestFingerprint(fingerprint)
                .contextJson(Map.of(
                        "requestedLearningLanguage", "en",
                        "requestedHintLanguage", "vi",
                        "learningLanguage", "en",
                        "hintLanguage", "vi"
                ))
                .status(WritingHintRequest.Status.PENDING)
                .runId("run-old-quota1")
                .quotaId(quota.getId())
                .quotaResetDate(quota.getResetDate())
                .quotaReserved(true)
                .leaseUntil(clock.instant().minusSeconds(10))
                .lastStartedAt(clock.instant().minusSeconds(30))
                .build();
        requestRepository.save(expiredLedger);

        WritingHintsRequest req = new WritingHintsRequest(30, "w1", "req-retry-quota1", "en", "vi");

        WritingHintTransactionCoordinator.BeginDecision decision =
                coordinator.begin(testUser.getId(), attempt.getId(), req);

        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.BeginDecision.Reserved.class);
        var reserved = (WritingHintTransactionCoordinator.BeginDecision.Reserved) decision;
        assertThat(reserved.reservation().runId()).isNotEqualTo("run-old-quota1");

        WritingHintRequest reloadedLedger = requestRepository.findById(expiredLedger.getId()).orElseThrow();
        assertThat(reloadedLedger.getStatus()).isEqualTo(WritingHintRequest.Status.PENDING);
        assertThat(reloadedLedger.getRunId()).isEqualTo(reserved.reservation().runId());
        assertThat(reloadedLedger.getQuotaReserved()).isTrue();

        UserQuota reloadedQuota = userQuotaRepository.findById(quota.getId()).orElseThrow();
        assertThat(reloadedQuota.getUsedCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("P1-01: complete bị chặn ở attempt lock, lease hết hạn trong lúc chờ -> thất bại WRITING_HINTS_TIMEOUT và hoàn quota")
    void completeExpiredWhileBlockedOnAttemptLockRefundsAndFailsWithTimeout() throws Exception {
        MutableClock mc = (MutableClock) clock;
        Instant t0 = Instant.parse("2026-10-13T10:00:00Z");
        mc.setInstant(t0);

        TestAttempt attempt = seedAttempt(testUser.getId(), AttemptStatus.IN_PROGRESS);
        UserQuota quota = seedQuota(testUser.getId(), 1, 5);

        WritingHintRequest ledger = requestRepository.save(WritingHintRequest.builder()
                .userId(testUser.getId())
                .attemptId(attempt.getId())
                .partId(30)
                .questionId("w1")
                .requestId("req-lease-wait-test")
                .requestFingerprint("fingerprint-lease-wait")
                .contextJson(Map.of("learningLanguage", "en", "hintLanguage", "vi"))
                .status(WritingHintRequest.Status.PENDING)
                .runId("run-lease-wait-123")
                .quotaId(quota.getId())
                .quotaResetDate(quota.getResetDate())
                .quotaReserved(true)
                .leaseUntil(t0.plusSeconds(45)) // Lease expires at t0 + 45s
                .lastStartedAt(t0)
                .build());

        WritingHintTransactionCoordinator.Reservation reservation = new WritingHintTransactionCoordinator.Reservation(
                ledger.getId(),
                "run-lease-wait-123",
                testUser.getId(),
                attempt.getId(),
                30,
                "w1",
                "req-lease-wait-test",
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi"),
                null,
                t0.plusSeconds(45),
                quota.getId(),
                quota.getResetDate()
        );

        WritingHintsResponse.Content content = new WritingHintsResponse.Content(
                List.of(new WritingHintsResponse.OutlineSection("Title", List.of("Point 1"))),
                List.of(new WritingHintsResponse.VocabularyItem("word", "meaning", "example", "notes")),
                List.of("Sentence 1")
        );

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch holderLocked = new CountDownLatch(1);
        CountDownLatch releaseHolder = new CountDownLatch(1);

        TransactionTemplate holderTx = new TransactionTemplate(transactionManager);
        holderTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);

        Future<?> holderFuture = executor.submit(() -> {
            holderTx.execute(status -> {
                attemptRepository.findByIdForUpdate(attempt.getId());
                holderLocked.countDown();
                try {
                    releaseHolder.await(10, TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                return null;
            });
        });

        assertThat(holderLocked.await(5, TimeUnit.SECONDS)).isTrue();

        Future<WritingHintTransactionCoordinator.TerminalDecision> completeFuture = executor.submit(() -> {
            return coordinator.complete(reservation, content);
        });

        // Đợi ngắn đảm bảo complete() đã vào và đang block trên attempt row lock
        Thread.sleep(200);

        // Advance clock qua lease (t0 + 60s > t0 + 45s) trong lúc complete() đang chờ khóa
        mc.advance(Duration.ofSeconds(60));

        // Giải phóng lock cho holder
        releaseHolder.countDown();
        holderFuture.get(5, TimeUnit.SECONDS);

        WritingHintTransactionCoordinator.TerminalDecision decision = completeFuture.get(5, TimeUnit.SECONDS);
        executor.shutdownNow();

        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.TerminalDecision.Failure.class);
        var fail = (WritingHintTransactionCoordinator.TerminalDecision.Failure) decision;
        assertThat(fail.errorCode()).isEqualTo(ErrorCode.WRITING_HINTS_TIMEOUT);

        WritingHintRequest reloadedLedger = requestRepository.findById(ledger.getId()).orElseThrow();
        assertThat(reloadedLedger.getStatus()).isEqualTo(WritingHintRequest.Status.FAILED);
        assertThat(reloadedLedger.getQuotaReserved()).isFalse();
        assertThat(reloadedLedger.getFailureCode()).isEqualTo("LEASE_EXPIRED");
        assertThat(reloadedLedger.getResultJson()).isNull();

        UserQuota reloadedQuota = userQuotaRepository.findById(quota.getId()).orElseThrow();
        assertThat(reloadedQuota.getUsedCount()).isEqualTo(0);
    }

    @Test
    @DisplayName("P1-01: complete bị chặn ở lock, deadline hết hạn trong lúc chờ dù lease còn hạn -> thất bại ATTEMPT_EXPIRED và không finalize attempt")
    void completeDeadlineExpiredWhileBlockedOnAttemptLockRefundsAndFailsWithAttemptExpired() throws Exception {
        MutableClock mc = (MutableClock) clock;
        Instant t0 = Instant.parse("2026-10-13T10:00:00Z");
        mc.setInstant(t0);

        TestAttempt attempt = attemptRepository.save(TestAttempt.builder()
                .userId(testUser.getId())
                .examId(1)
                .testMode(TestMode.PRACTICE)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(t0.minusSeconds(600))
                .deadline(t0.plusSeconds(30)) // Deadline expires at t0 + 30s
                .examSnapshot(Map.of(
                        "sections", List.of(
                                Map.of(
                                        "id", 10,
                                        "name", "WRITING",
                                        "parts", List.of(
                                                Map.of(
                                                        "id", 30,
                                                        "questions", List.of(
                                                                Map.of("question_id", "w1", "type", "ESSAY", "prompt", "Task prompt")
                                                        )
                                                )
                                        )
                                )
                        )
                ))
                .build());

        UserQuota quota = seedQuota(testUser.getId(), 1, 5);

        WritingHintRequest ledger = requestRepository.save(WritingHintRequest.builder()
                .userId(testUser.getId())
                .attemptId(attempt.getId())
                .partId(30)
                .questionId("w1")
                .requestId("req-deadline-wait-test")
                .requestFingerprint("fingerprint-deadline-wait")
                .contextJson(Map.of("learningLanguage", "en", "hintLanguage", "vi"))
                .status(WritingHintRequest.Status.PENDING)
                .runId("run-deadline-wait-123")
                .quotaId(quota.getId())
                .quotaResetDate(quota.getResetDate())
                .quotaReserved(true)
                .leaseUntil(t0.plusSeconds(120)) // Lease còn hiệu lực 120s!
                .lastStartedAt(t0)
                .build());

        WritingHintTransactionCoordinator.Reservation reservation = new WritingHintTransactionCoordinator.Reservation(
                ledger.getId(),
                "run-deadline-wait-123",
                testUser.getId(),
                attempt.getId(),
                30,
                "w1",
                "req-deadline-wait-test",
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi"),
                null,
                t0.plusSeconds(120),
                quota.getId(),
                quota.getResetDate()
        );

        WritingHintsResponse.Content content = new WritingHintsResponse.Content(
                List.of(new WritingHintsResponse.OutlineSection("Title", List.of("Point 1"))),
                List.of(new WritingHintsResponse.VocabularyItem("word", "meaning", "example", "notes")),
                List.of("Sentence 1")
        );

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch holderLocked = new CountDownLatch(1);
        CountDownLatch releaseHolder = new CountDownLatch(1);

        TransactionTemplate holderTx = new TransactionTemplate(transactionManager);
        holderTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);

        Future<?> holderFuture = executor.submit(() -> {
            holderTx.execute(status -> {
                attemptRepository.findByIdForUpdate(attempt.getId());
                holderLocked.countDown();
                try {
                    releaseHolder.await(10, TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                return null;
            });
        });

        assertThat(holderLocked.await(5, TimeUnit.SECONDS)).isTrue();

        Future<WritingHintTransactionCoordinator.TerminalDecision> completeFuture = executor.submit(() -> {
            return coordinator.complete(reservation, content);
        });

        Thread.sleep(200);

        // Advance clock qua deadline 30s nhưng vẫn trong lease 120s (t0 + 60s)
        mc.advance(Duration.ofSeconds(60));

        releaseHolder.countDown();
        holderFuture.get(5, TimeUnit.SECONDS);

        WritingHintTransactionCoordinator.TerminalDecision decision = completeFuture.get(5, TimeUnit.SECONDS);
        executor.shutdownNow();

        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.TerminalDecision.Failure.class);
        var fail = (WritingHintTransactionCoordinator.TerminalDecision.Failure) decision;
        assertThat(fail.errorCode()).isEqualTo(ErrorCode.ATTEMPT_EXPIRED);

        WritingHintRequest reloadedLedger = requestRepository.findById(ledger.getId()).orElseThrow();
        assertThat(reloadedLedger.getStatus()).isEqualTo(WritingHintRequest.Status.FAILED);
        assertThat(reloadedLedger.getQuotaReserved()).isFalse();
        assertThat(reloadedLedger.getFailureCode()).isEqualTo("ATTEMPT_EXPIRED");
        assertThat(reloadedLedger.getResultJson()).isNull();

        UserQuota reloadedQuota = userQuotaRepository.findById(quota.getId()).orElseThrow();
        assertThat(reloadedQuota.getUsedCount()).isEqualTo(0);

        // Attempt KHÔNG bị finalize, giữ nguyên IN_PROGRESS
        TestAttempt reloadedAttempt = attemptRepository.findById(attempt.getId()).orElseThrow();
        assertThat(reloadedAttempt.getStatus()).isEqualTo(AttemptStatus.IN_PROGRESS);
    }

    @Test
    @DisplayName("P1-01: complete thất bại tại exact equality boundary (now == leaseUntil) và hoàn quota")
    void completeFailsAtExactEqualityBoundaryOfLease() {
        MutableClock mc = (MutableClock) clock;
        Instant t0 = Instant.parse("2026-10-13T10:00:00Z");
        mc.setInstant(t0);

        TestAttempt attempt = seedAttempt(testUser.getId(), AttemptStatus.IN_PROGRESS);
        UserQuota quota = seedQuota(testUser.getId(), 1, 5);

        WritingHintRequest ledger = requestRepository.save(WritingHintRequest.builder()
                .userId(testUser.getId())
                .attemptId(attempt.getId())
                .partId(30)
                .questionId("w1")
                .requestId("req-exact-boundary-test")
                .requestFingerprint("fingerprint-exact-boundary")
                .status(WritingHintRequest.Status.PENDING)
                .runId("run-exact-123")
                .quotaId(quota.getId())
                .quotaResetDate(quota.getResetDate())
                .quotaReserved(true)
                .leaseUntil(t0) // Exact equality boundary: leaseUntil == t0
                .lastStartedAt(t0)
                .build());

        WritingHintTransactionCoordinator.Reservation reservation = new WritingHintTransactionCoordinator.Reservation(
                ledger.getId(),
                "run-exact-123",
                testUser.getId(),
                attempt.getId(),
                30,
                "w1",
                "req-exact-boundary-test",
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi"),
                null,
                t0,
                quota.getId(),
                quota.getResetDate()
        );

        WritingHintsResponse.Content content = new WritingHintsResponse.Content(List.of(), List.of(), List.of());

        WritingHintTransactionCoordinator.TerminalDecision decision = coordinator.complete(reservation, content);

        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.TerminalDecision.Failure.class);
        var fail = (WritingHintTransactionCoordinator.TerminalDecision.Failure) decision;
        assertThat(fail.errorCode()).isEqualTo(ErrorCode.WRITING_HINTS_TIMEOUT);

        WritingHintRequest reloadedLedger = requestRepository.findById(ledger.getId()).orElseThrow();
        assertThat(reloadedLedger.getStatus()).isEqualTo(WritingHintRequest.Status.FAILED);
        assertThat(reloadedLedger.getQuotaReserved()).isFalse();
        assertThat(reloadedLedger.getFailureCode()).isEqualTo("LEASE_EXPIRED");

        UserQuota reloadedQuota = userQuotaRepository.findById(quota.getId()).orElseThrow();
        assertThat(reloadedQuota.getUsedCount()).isEqualTo(0);
    }

    @Test
    @DisplayName("P1-01: complete không hoàn quota và không ghi đè nếu run đã bị thay thế bởi run mới hơn")
    void completeDoesNotDuplicateRefundOrOverwriteWhenRunWasReplaced() {
        TestAttempt attempt = seedAttempt(testUser.getId(), AttemptStatus.IN_PROGRESS);
        UserQuota quota = seedQuota(testUser.getId(), 1, 5);

        WritingHintRequest ledger = requestRepository.save(WritingHintRequest.builder()
                .userId(testUser.getId())
                .attemptId(attempt.getId())
                .partId(30)
                .questionId("w1")
                .requestId("req-replaced-test")
                .requestFingerprint("fingerprint-replaced")
                .status(WritingHintRequest.Status.PENDING)
                .runId("new-run-active-456") // Active run mới
                .quotaId(quota.getId())
                .quotaResetDate(quota.getResetDate())
                .quotaReserved(true)
                .leaseUntil(clock.instant().plusSeconds(45))
                .lastStartedAt(clock.instant())
                .build());

        WritingHintTransactionCoordinator.Reservation staleReservation = new WritingHintTransactionCoordinator.Reservation(
                ledger.getId(),
                "old-stale-run-123", // Stale run cũ
                testUser.getId(),
                attempt.getId(),
                30,
                "w1",
                "req-replaced-test",
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi"),
                null,
                clock.instant().plusSeconds(45),
                quota.getId(),
                quota.getResetDate()
        );

        WritingHintsResponse.Content content = new WritingHintsResponse.Content(List.of(), List.of(), List.of());

        WritingHintTransactionCoordinator.TerminalDecision decision = coordinator.complete(staleReservation, content);

        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.TerminalDecision.Failure.class);
        var fail = (WritingHintTransactionCoordinator.TerminalDecision.Failure) decision;
        assertThat(fail.errorCode()).isEqualTo(ErrorCode.WRITING_HINTS_TIMEOUT);

        WritingHintRequest reloadedLedger = requestRepository.findById(ledger.getId()).orElseThrow();
        assertThat(reloadedLedger.getStatus()).isEqualTo(WritingHintRequest.Status.PENDING);
        assertThat(reloadedLedger.getRunId()).isEqualTo("new-run-active-456");
        assertThat(reloadedLedger.getQuotaReserved()).isTrue();
        assertThat(reloadedLedger.getResultJson()).isNull();

        UserQuota reloadedQuota = userQuotaRepository.findById(quota.getId()).orElseThrow();
        assertThat(reloadedQuota.getUsedCount()).isEqualTo(1); // Không bị trừ nhầm
    }
}
