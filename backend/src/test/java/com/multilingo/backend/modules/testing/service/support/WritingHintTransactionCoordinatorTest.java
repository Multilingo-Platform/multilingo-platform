package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.adapter.WritingHintQuotaAdapter;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiProperties;
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
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WritingHintTransactionCoordinatorTest {

    @Mock
    private TestAttemptRepository attemptRepository;

    @Mock
    private WritingHintRequestRepository requestRepository;

    @Mock
    private WritingHintQuotaAdapter quotaAdapter;

    @Mock
    private WritingHintContextReader contextReader;

    @Mock
    private WritingHintLanguageResolver languageResolver;

    private WritingHintsProperties writingHintsProperties;
    private GeminiProperties geminiProperties;
    private ObjectMapper objectMapper;
    private Clock clock;
    private Instant fixedNow;

    private WritingHintTransactionCoordinator coordinator;

    @BeforeEach
    void setUp() {
        fixedNow = Instant.parse("2026-10-12T18:00:00Z");
        clock = Clock.fixed(fixedNow, ZoneOffset.UTC);

        writingHintsProperties = new WritingHintsProperties();
        writingHintsProperties.setEnabled(true);
        writingHintsProperties.setMinInterval(Duration.ofSeconds(10));
        writingHintsProperties.setLeaseExtension(Duration.ofSeconds(15));

        geminiProperties = new GeminiProperties();
        geminiProperties.setRequestTimeout(Duration.ofSeconds(30));

        objectMapper = new ObjectMapper();

        coordinator = new WritingHintTransactionCoordinator(
                attemptRepository,
                requestRepository,
                quotaAdapter,
                contextReader,
                languageResolver,
                writingHintsProperties,
                geminiProperties,
                objectMapper,
                clock
        );
    }

    private TestAttempt createValidAttempt(Integer userId) {
        return TestAttempt.builder()
                .userId(userId)
                .examId(1)
                .testMode(TestMode.PRACTICE)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(fixedNow.minusSeconds(600))
                .examSnapshot(Map.of(
                        "examLanguage", "en",
                        "sections", List.of(
                                Map.of(
                                        "id", 10,
                                        "name", "WRITING",
                                        "parts", List.of(
                                                Map.of(
                                                        "id", 30,
                                                        "questions", List.of(
                                                                Map.of("question_id", "q-1", "type", "ESSAY")
                                                        )
                                                )
                                        )
                                )
                        )
                ))
                .build();
    }

    @Test
    @DisplayName("begin ném WRITING_HINTS_UNAVAILABLE khi feature disabled")
    void beginThrowsWhenFeatureDisabled() {
        writingHintsProperties.setEnabled(false);

        WritingHintsRequest req = new WritingHintsRequest(30, "q-1", "req-1", "en", "vi");

        assertThatThrownBy(() -> coordinator.begin(1, 10, req))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.WRITING_HINTS_UNAVAILABLE));
    }

    @Test
    @DisplayName("begin ném FORBIDDEN khi attempt thuộc user khác (foreign)")
    void beginThrowsForbiddenForForeignAttempt() {
        TestAttempt attempt = createValidAttempt(2); // Owned by user 2
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        WritingHintsRequest req = new WritingHintsRequest(30, "q-1", "req-1", "en", "vi");

        assertThatThrownBy(() -> coordinator.begin(1, 10, req)) // User 1 requests
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN));
    }

    @Test
    @DisplayName("begin ném FORBIDDEN khi attempt ở chế độ MOCK_TEST")
    void beginThrowsForbiddenForMockTestMode() {
        TestAttempt attempt = createValidAttempt(1);
        attempt.setTestMode(TestMode.MOCK_TEST);
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        WritingHintsRequest req = new WritingHintsRequest(30, "q-1", "req-1", "en", "vi");

        assertThatThrownBy(() -> coordinator.begin(1, 10, req))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN));
    }

    @Test
    @DisplayName("begin ném ATTEMPT_ALREADY_SUBMITTED khi attempt không còn IN_PROGRESS")
    void beginThrowsWhenAttemptSubmitted() {
        TestAttempt attempt = createValidAttempt(1);
        attempt.setStatus(AttemptStatus.COMPLETED);
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        WritingHintsRequest req = new WritingHintsRequest(30, "q-1", "req-1", "en", "vi");

        assertThatThrownBy(() -> coordinator.begin(1, 10, req))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.ATTEMPT_ALREADY_SUBMITTED));
    }

    @Test
    @DisplayName("begin ném ATTEMPT_EXPIRED khi deadline đã hết hạn")
    void beginThrowsWhenDeadlineExpired() {
        TestAttempt attempt = createValidAttempt(1);
        attempt.setDeadline(fixedNow.minusSeconds(1));
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        WritingHintsRequest req = new WritingHintsRequest(30, "q-1", "req-1", "en", "vi");

        assertThatThrownBy(() -> coordinator.begin(1, 10, req))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.ATTEMPT_EXPIRED));
    }

    @Test
    @DisplayName("begin ném CONFLICT khi section chứa partId bị locked")
    void beginThrowsWhenSectionIsLocked() {
        TestAttempt attempt = createValidAttempt(1);
        attempt.setLockedSections(List.of(10)); // Section 10 is locked
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        WritingHintsRequest req = new WritingHintsRequest(30, "q-1", "req-1", "en", "vi");

        assertThatThrownBy(() -> coordinator.begin(1, 10, req))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.CONFLICT));
    }

    @Test
    @DisplayName("begin trả về Replay khi request cùng requestId đã SUCCEEDED và trùng fingerprint")
    void beginReturnsReplayForSucceededRequest() {
        TestAttempt attempt = createValidAttempt(1);
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        String fingerprint = WritingHintTransactionCoordinator.computeFingerprint(10, 30, "q-1", "en", "vi");

        WritingHintRequest existing = WritingHintRequest.builder()
                .userId(1)
                .attemptId(10)
                .partId(30)
                .questionId("q-1")
                .requestId("req-1")
                .requestFingerprint(fingerprint)
                .contextJson(Map.of("learningLanguage", "en", "hintLanguage", "vi"))
                .status(WritingHintRequest.Status.SUCCEEDED)
                .resultJson(Map.of(
                        "outline", List.of(Map.of("title", "Intro", "points", List.of("P1"))),
                        "vocabulary", List.of(Map.of("term", "T1", "definition", "D1", "explanation", "E1", "example", "Ex1")),
                        "limitations", List.of()
                ))
                .build();
        existing.setId(5);

        when(requestRepository.findByUserIdAndRequestIdForUpdate(1, "req-1"))
                .thenReturn(Optional.of(existing));

        WritingHintsRequest req = new WritingHintsRequest(30, "q-1", "req-1", "en", "vi");
        WritingHintTransactionCoordinator.BeginDecision decision = coordinator.begin(1, 10, req);

        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.BeginDecision.Replay.class);
        var replay = (WritingHintTransactionCoordinator.BeginDecision.Replay) decision;
        assertThat(replay.response().attemptId()).isEqualTo(10);
        verify(quotaAdapter).lockAccount(1);
        verify(quotaAdapter, never()).tryReserve(any());
        verify(quotaAdapter, never()).reserve(any());
        verify(quotaAdapter, never()).refund(any(), any());
    }

    @Test
    @DisplayName("begin trả về BeginDecision.Denied khi cùng requestId nhưng payload/fingerprint khác")
    void beginThrowsConflictWhenSameRequestIdDifferentPayload() {
        TestAttempt attempt = createValidAttempt(1);
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        WritingHintRequest existing = WritingHintRequest.builder()
                .userId(1)
                .attemptId(10)
                .partId(30)
                .questionId("q-1")
                .requestId("req-1")
                .requestFingerprint("different-fingerprint-123")
                .status(WritingHintRequest.Status.SUCCEEDED)
                .build();

        when(requestRepository.findByUserIdAndRequestIdForUpdate(1, "req-1"))
                .thenReturn(Optional.of(existing));

        WritingHintsRequest req = new WritingHintsRequest(30, "q-1", "req-1", "en", "vi");

        WritingHintTransactionCoordinator.BeginDecision decision = coordinator.begin(1, 10, req);
        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.BeginDecision.Denied.class);
        var denied = (WritingHintTransactionCoordinator.BeginDecision.Denied) decision;
        assertThat(denied.errorCode()).isEqualTo(ErrorCode.WRITING_HINTS_REQUEST_CONFLICT);
    }

    @Test
    @DisplayName("begin trả về BeginDecision.Denied khi request đang PENDING với lease còn hiệu lực")
    void beginThrowsInProgressWhenRequestPendingWithActiveLease() {
        TestAttempt attempt = createValidAttempt(1);
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        String fingerprint = WritingHintTransactionCoordinator.computeFingerprint(10, 30, "q-1", "en", "vi");

        WritingHintRequest existing = WritingHintRequest.builder()
                .userId(1)
                .attemptId(10)
                .partId(30)
                .questionId("q-1")
                .requestId("req-1")
                .requestFingerprint(fingerprint)
                .contextJson(Map.of("requestedLearningLanguage", "en", "requestedHintLanguage", "vi"))
                .status(WritingHintRequest.Status.PENDING)
                .leaseUntil(fixedNow.plusSeconds(30)) // Lease active
                .build();

        when(requestRepository.findByUserIdAndRequestIdForUpdate(1, "req-1"))
                .thenReturn(Optional.of(existing));

        WritingHintsRequest req = new WritingHintsRequest(30, "q-1", "req-1", "en", "vi");

        WritingHintTransactionCoordinator.BeginDecision decision = coordinator.begin(1, 10, req);
        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.BeginDecision.Denied.class);
        var denied = (WritingHintTransactionCoordinator.BeginDecision.Denied) decision;
        assertThat(denied.errorCode()).isEqualTo(ErrorCode.WRITING_HINTS_IN_PROGRESS);
        assertThat(denied.retryAfterSeconds()).isEqualTo(30L);
    }

    @Test
    @DisplayName("begin trả về BeginDecision.Denied khi gọi trong khoảng cooldown (10s)")
    void beginThrowsRateLimitedWhenCalledWithinCooldown() {
        TestAttempt attempt = createValidAttempt(1);
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        when(requestRepository.findByUserIdAndRequestIdForUpdate(1, "req-new"))
                .thenReturn(Optional.empty());

        // Previous request was started 5 seconds ago (< 10s cooldown)
        WritingHintRequest lastReq = WritingHintRequest.builder()
                .userId(1)
                .lastStartedAt(fixedNow.minusSeconds(5))
                .build();
        when(requestRepository.findFirstByUserIdOrderByLastStartedAtDesc(1))
                .thenReturn(Optional.of(lastReq));

        WritingHintsRequest req = new WritingHintsRequest(30, "q-1", "req-new", "en", "vi");

        WritingHintTransactionCoordinator.BeginDecision decision = coordinator.begin(1, 10, req);
        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.BeginDecision.Denied.class);
        var denied = (WritingHintTransactionCoordinator.BeginDecision.Denied) decision;
        assertThat(denied.errorCode()).isEqualTo(ErrorCode.WRITING_HINTS_RATE_LIMITED);
        assertThat(denied.retryAfterSeconds()).isEqualTo(5L);
    }

    @Test
    @DisplayName("begin thành công: reserve quota và trả về BeginDecision.Reserved")
    void beginSucceedsAndReturnsReserved() {
        TestAttempt attempt = createValidAttempt(1);
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        WritingHintContextReader.HintContext hintCtx = new WritingHintContextReader.HintContext(
                30, "q-1", "Part title", "Part inst", "Group inst", "Prompt", false
        );
        when(contextReader.read(attempt, 30, "q-1")).thenReturn(hintCtx);

        WritingHintLanguageResolver.ResolvedLanguages languages =
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi");
        when(languageResolver.resolveForAttempt(1, "en", "vi", "en")).thenReturn(languages);

        when(requestRepository.findByUserIdAndRequestIdForUpdate(1, "req-1"))
                .thenReturn(Optional.empty());

        // Cooldown passed: last request 20 seconds ago
        WritingHintRequest lastReq = WritingHintRequest.builder()
                .userId(1)
                .lastStartedAt(fixedNow.minusSeconds(20))
                .build();
        when(requestRepository.findFirstByUserIdOrderByLastStartedAtDesc(1))
                .thenReturn(Optional.of(lastReq));

        Instant resetDate = fixedNow.plusSeconds(3600);
        when(quotaAdapter.tryReserve(1))
                .thenReturn(Optional.of(new WritingHintQuotaAdapter.QuotaReservation(50, resetDate)));

        when(requestRepository.save(any(WritingHintRequest.class)))
                .thenAnswer(inv -> {
                    WritingHintRequest saved = inv.getArgument(0);
                    saved.setId(100);
                    return saved;
                });

        WritingHintsRequest req = new WritingHintsRequest(30, "q-1", "req-1", "en", "vi");
        WritingHintTransactionCoordinator.BeginDecision decision = coordinator.begin(1, 10, req);

        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.BeginDecision.Reserved.class);
        var reserved = (WritingHintTransactionCoordinator.BeginDecision.Reserved) decision;
        assertThat(reserved.reservation().operationId()).isEqualTo(100);
        assertThat(reserved.reservation().quotaId()).isEqualTo(50);
        assertThat(reserved.reservation().quotaResetDate()).isEqualTo(resetDate);
        verify(quotaAdapter).tryReserve(1);
    }

    @Test
    @DisplayName("P1-05: begin từ chối section có skill không phải WRITING với VALIDATION_FAILED (422)")
    void beginRejectsNonWritingSectionSkillWithValidationFailed() {
        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(1)
                .testMode(TestMode.PRACTICE)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(fixedNow.minusSeconds(600))
                .examSnapshot(Map.of(
                        "sections", List.of(
                                Map.of(
                                        "id", 10,
                                        "name", "READING", // Skill READING!
                                        "parts", List.of(
                                                Map.of(
                                                        "id", 30,
                                                        "questions", List.of(
                                                                Map.of("question_id", "q-1", "type", "ESSAY")
                                                        )
                                                )
                                        )
                                )
                        )
                ))
                .build();
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        WritingHintsRequest req = new WritingHintsRequest(30, "q-1", "req-1", "en", "vi");

        assertThatThrownBy(() -> coordinator.begin(1, 10, req))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.VALIDATION_FAILED));
        verifyNoInteractions(quotaAdapter);
    }

    @Test
    @DisplayName("P1-05: begin từ chối câu hỏi không phải ESSAY với VALIDATION_FAILED (422)")
    void beginRejectsNonEssayQuestionTypeWithValidationFailed() {
        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(1)
                .testMode(TestMode.PRACTICE)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(fixedNow.minusSeconds(600))
                .examSnapshot(Map.of(
                        "sections", List.of(
                                Map.of(
                                        "id", 10,
                                        "name", "WRITING",
                                        "parts", List.of(
                                                Map.of(
                                                        "id", 30,
                                                        "questions", List.of(
                                                                Map.of("question_id", "q-1", "type", "SINGLE_CHOICE")
                                                        )
                                                )
                                        )
                                )
                        )
                ))
                .build();
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        WritingHintsRequest req = new WritingHintsRequest(30, "q-1", "req-1", "en", "vi");

        assertThatThrownBy(() -> coordinator.begin(1, 10, req))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.VALIDATION_FAILED));
        verifyNoInteractions(quotaAdapter);
    }

    @Test
    @DisplayName("P1-07: begin từ chối partId không tồn tại trong snapshot với RESOURCE_NOT_FOUND (404)")
    void beginRejectsMissingPartWithResourceNotFound() {
        TestAttempt attempt = createValidAttempt(1);
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        WritingHintsRequest req = new WritingHintsRequest(999, "q-1", "req-1", "en", "vi"); // Part 999 does not exist!

        assertThatThrownBy(() -> coordinator.begin(1, 10, req))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND));
        verifyNoInteractions(quotaAdapter);
    }

    @Test
    @DisplayName("P1-07: begin từ chối questionId không tồn tại trong part với RESOURCE_NOT_FOUND (404)")
    void beginRejectsMissingQuestionWithResourceNotFound() {
        TestAttempt attempt = createValidAttempt(1);
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        WritingHintsRequest req = new WritingHintsRequest(30, "q-non-existent", "req-1", "en", "vi");

        assertThatThrownBy(() -> coordinator.begin(1, 10, req))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND));
        verifyNoInteractions(quotaAdapter);
    }

    @Test
    @DisplayName("P1-03: retry của FAILED request dùng frozen languages từ contextJson mà không gọi languageResolver")
    void retryOfFailedRequestUsesFrozenLanguagesWithoutCallingLanguageResolver() {
        TestAttempt attempt = createValidAttempt(1);
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        WritingHintContextReader.HintContext hintCtx = new WritingHintContextReader.HintContext(
                30, "q-1", "Part title", "Part inst", "Group inst", "Prompt", false
        );
        when(contextReader.read(attempt, 30, "q-1")).thenReturn(hintCtx);

        // Previous FAILED request with frozen languages en/en
        String fingerprint = WritingHintTransactionCoordinator.computeFingerprint(10, 30, "q-1", null, null);
        WritingHintRequest existing = WritingHintRequest.builder()
                .userId(1)
                .attemptId(10)
                .partId(30)
                .questionId("q-1")
                .requestId("req-retry")
                .requestFingerprint(fingerprint)
                .contextJson(Map.of(
                        "requestedLearningLanguage", "",
                        "requestedHintLanguage", "",
                        "learningLanguage", "en",
                        "hintLanguage", "en",
                        "promptVersion", "writing-hints-v1"
                ))
                .status(WritingHintRequest.Status.FAILED)
                .build();

        when(requestRepository.findByUserIdAndRequestIdForUpdate(1, "req-retry"))
                .thenReturn(Optional.of(existing));

        when(quotaAdapter.tryReserve(1))
                .thenReturn(Optional.of(new WritingHintQuotaAdapter.QuotaReservation(50, fixedNow.plusSeconds(3600))));
        when(requestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Retry with same requestId and omitted languages (null/null)
        WritingHintsRequest req = new WritingHintsRequest(30, "q-1", "req-retry", null, null);

        WritingHintTransactionCoordinator.BeginDecision decision = coordinator.begin(1, 10, req);
        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.BeginDecision.Reserved.class);
        var reserved = (WritingHintTransactionCoordinator.BeginDecision.Reserved) decision;

        // Frozen languages en/en were preserved
        assertThat(reserved.reservation().languages().learningLanguage()).isEqualTo("en");
        assertThat(reserved.reservation().languages().hintLanguage()).isEqualTo("en");

        // Language resolver was NOT called for retry!
        verifyNoInteractions(languageResolver);
    }

    @Test
    @DisplayName("complete: ném ATTEMPT_ALREADY_SUBMITTED và hoàn quota nếu attempt kết thúc giữa lúc gọi")
    void completeRefundsAndFailsIfAttemptEndedDuringGeneration() {
        TestAttempt attempt = createValidAttempt(1);
        attempt.setStatus(AttemptStatus.COMPLETED); // Ended during call!
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        WritingHintRequest ledger = WritingHintRequest.builder()
                .userId(1)
                .runId("run-123")
                .quotaId(50)
                .quotaResetDate(fixedNow.plusSeconds(3600))
                .quotaReserved(true)
                .status(WritingHintRequest.Status.PENDING)
                .build();
        ledger.setId(100);
        when(requestRepository.findByIdForUpdate(100)).thenReturn(Optional.of(ledger));

        WritingHintTransactionCoordinator.Reservation reservation = new WritingHintTransactionCoordinator.Reservation(
                100, "run-123", 1, 10, 30, "q-1", "req-1",
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi"),
                null, fixedNow.plusSeconds(45), 50, fixedNow.plusSeconds(3600)
        );

        WritingHintsResponse.Content content = new WritingHintsResponse.Content(List.of(), List.of(), List.of());

        WritingHintTransactionCoordinator.TerminalDecision decision = coordinator.complete(reservation, content);

        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.TerminalDecision.Failure.class);
        var fail = (WritingHintTransactionCoordinator.TerminalDecision.Failure) decision;
        assertThat(fail.errorCode()).isEqualTo(ErrorCode.ATTEMPT_ALREADY_SUBMITTED);

        verify(quotaAdapter).refund(50, fixedNow.plusSeconds(3600));
        assertThat(ledger.getStatus()).isEqualTo(WritingHintRequest.Status.FAILED);
        assertThat(ledger.getQuotaReserved()).isFalse();
    }

    @Test
    @DisplayName("P1-02: complete từ chối ghi kết quả và KHÔNG hoàn quota nếu runId không khớp (stale run fencing)")
    void completeFailsWhenRunIdMismatch() {
        TestAttempt attempt = createValidAttempt(1);
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        WritingHintRequest ledger = WritingHintRequest.builder()
                .userId(1)
                .runId("new-run-456") // Mismatched!
                .quotaId(50)
                .quotaResetDate(fixedNow.plusSeconds(3600))
                .quotaReserved(true)
                .status(WritingHintRequest.Status.PENDING)
                .leaseUntil(fixedNow.plusSeconds(45))
                .build();
        ledger.setId(100);
        when(requestRepository.findByIdForUpdate(100)).thenReturn(Optional.of(ledger));

        WritingHintTransactionCoordinator.Reservation reservation = new WritingHintTransactionCoordinator.Reservation(
                100, "old-run-123", 1, 10, 30, "q-1", "req-1",
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi"),
                null, fixedNow.plusSeconds(45), 50, fixedNow.plusSeconds(3600)
        );

        WritingHintsResponse.Content content = new WritingHintsResponse.Content(List.of(), List.of(), List.of());

        WritingHintTransactionCoordinator.TerminalDecision decision = coordinator.complete(reservation, content);

        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.TerminalDecision.Failure.class);
        var fail = (WritingHintTransactionCoordinator.TerminalDecision.Failure) decision;
        assertThat(fail.errorCode()).isEqualTo(ErrorCode.WRITING_HINTS_TIMEOUT);

        // KHÔNG BAO GIỜ hoàn quota cho stale run!
        verify(quotaAdapter, never()).refund(any(), any());
    }

    @Test
    @DisplayName("P1-06: complete kiểm tra lại section lock; nếu bị khóa thì hoàn quota và trả CONFLICT")
    void completeRechecksLockedSectionAndRefundsQuota() {
        TestAttempt attempt = createValidAttempt(1);
        attempt.setLockedSections(List.of(10)); // Section 10 locked during provider call!
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        WritingHintRequest ledger = WritingHintRequest.builder()
                .userId(1)
                .runId("run-123")
                .quotaId(50)
                .quotaResetDate(fixedNow.plusSeconds(3600))
                .quotaReserved(true)
                .status(WritingHintRequest.Status.PENDING)
                .build();
        ledger.setId(100);
        when(requestRepository.findByIdForUpdate(100)).thenReturn(Optional.of(ledger));

        WritingHintTransactionCoordinator.Reservation reservation = new WritingHintTransactionCoordinator.Reservation(
                100, "run-123", 1, 10, 30, "q-1", "req-1",
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi"),
                null, fixedNow.plusSeconds(45), 50, fixedNow.plusSeconds(3600)
        );

        WritingHintsResponse.Content content = new WritingHintsResponse.Content(List.of(), List.of(), List.of());

        WritingHintTransactionCoordinator.TerminalDecision decision = coordinator.complete(reservation, content);

        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.TerminalDecision.Failure.class);
        var fail = (WritingHintTransactionCoordinator.TerminalDecision.Failure) decision;
        assertThat(fail.errorCode()).isEqualTo(ErrorCode.CONFLICT);

        verify(quotaAdapter).refund(50, fixedNow.plusSeconds(3600));
        assertThat(ledger.getStatus()).isEqualTo(WritingHintRequest.Status.FAILED);
        assertThat(ledger.getQuotaReserved()).isFalse();
        assertThat(ledger.getFailureCode()).isEqualTo("SECTION_LOCKED");
    }

    @Test
    @DisplayName("P2-01: complete thành công lưu resultJson kèm generatedAt, cập nhật SUCCEEDED và trả về TerminalDecision.Success")
    void completeSucceedsAndPersistsResult() {
        TestAttempt attempt = createValidAttempt(1);
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        WritingHintRequest ledger = WritingHintRequest.builder()
                .userId(1)
                .runId("run-123")
                .quotaId(50)
                .quotaResetDate(fixedNow.plusSeconds(3600))
                .quotaReserved(true)
                .status(WritingHintRequest.Status.PENDING)
                .leaseUntil(fixedNow.plusSeconds(45))
                .build();
        ledger.setId(100);
        when(requestRepository.findByIdForUpdate(100)).thenReturn(Optional.of(ledger));

        WritingHintTransactionCoordinator.Reservation reservation = new WritingHintTransactionCoordinator.Reservation(
                100, "run-123", 1, 10, 30, "q-1", "req-1",
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi"),
                null, fixedNow.plusSeconds(45), 50, fixedNow.plusSeconds(3600)
        );

        WritingHintsResponse.Content content = new WritingHintsResponse.Content(
                List.of(new WritingHintsResponse.OutlineSection("Intro", List.of("P1"))),
                List.of(new WritingHintsResponse.VocabularyItem("T1", "D1", "E1", "Ex1")),
                List.of()
        );

        WritingHintTransactionCoordinator.TerminalDecision decision = coordinator.complete(reservation, content);

        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.TerminalDecision.Success.class);
        var success = (WritingHintTransactionCoordinator.TerminalDecision.Success) decision;
        assertThat(success.response().attemptId()).isEqualTo(10);
        assertThat(success.response().requestId()).isEqualTo("req-1");
        assertThat(success.response().generatedAt()).isEqualTo(fixedNow);

        assertThat(ledger.getStatus()).isEqualTo(WritingHintRequest.Status.SUCCEEDED);
        assertThat(ledger.getResultJson()).isNotNull();
        assertThat(ledger.getResultJson().get("generatedAt")).isEqualTo(fixedNow.toString());
        verify(requestRepository).save(ledger);
        verify(quotaAdapter, never()).refund(any(), any());
    }

    @Test
    @DisplayName("fail: hoàn quota và cập nhật ledger sang FAILED")
    void failRefundsQuotaAndMarksFailed() {
        WritingHintRequest ledger = WritingHintRequest.builder()
                .userId(1)
                .runId("run-123")
                .quotaId(50)
                .quotaResetDate(fixedNow.plusSeconds(3600))
                .quotaReserved(true)
                .status(WritingHintRequest.Status.PENDING)
                .build();
        ledger.setId(100);
        when(requestRepository.findByIdForUpdate(100)).thenReturn(Optional.of(ledger));

        WritingHintTransactionCoordinator.Reservation reservation = new WritingHintTransactionCoordinator.Reservation(
                100, "run-123", 1, 10, 30, "q-1", "req-1",
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi"),
                null, fixedNow.plusSeconds(45), 50, fixedNow.plusSeconds(3600)
        );

        WritingHintTransactionCoordinator.TerminalDecision decision =
                coordinator.fail(reservation, ErrorCode.WRITING_HINTS_TIMEOUT, "Gemini timed out");

        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.TerminalDecision.Failure.class);
        var fail = (WritingHintTransactionCoordinator.TerminalDecision.Failure) decision;
        assertThat(fail.errorCode()).isEqualTo(ErrorCode.WRITING_HINTS_TIMEOUT);

        verify(quotaAdapter).refund(50, fixedNow.plusSeconds(3600));
        assertThat(ledger.getStatus()).isEqualTo(WritingHintRequest.Status.FAILED);
        assertThat(ledger.getQuotaReserved()).isFalse();
        assertThat(ledger.getFailureCode()).isEqualTo("WRITING_HINTS_TIMEOUT");
        verify(requestRepository).save(ledger);
    }

    @Test
    @DisplayName("P1-08: overload 2 tham số fail(reservation, errorCode) hoạt động chính xác")
    void twoArgFailExecutesSuccessfully() {
        WritingHintRequest ledger = WritingHintRequest.builder()
                .userId(1)
                .runId("run-123")
                .quotaId(50)
                .quotaResetDate(fixedNow.plusSeconds(3600))
                .quotaReserved(true)
                .status(WritingHintRequest.Status.PENDING)
                .build();
        ledger.setId(100);
        when(requestRepository.findByIdForUpdate(100)).thenReturn(Optional.of(ledger));

        WritingHintTransactionCoordinator.Reservation reservation = new WritingHintTransactionCoordinator.Reservation(
                100, "run-123", 1, 10, 30, "q-1", "req-1",
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi"),
                null, fixedNow.plusSeconds(45), 50, fixedNow.plusSeconds(3600)
        );

        WritingHintTransactionCoordinator.TerminalDecision decision =
                coordinator.fail(reservation, ErrorCode.WRITING_HINTS_TIMEOUT);

        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.TerminalDecision.Failure.class);
        var fail = (WritingHintTransactionCoordinator.TerminalDecision.Failure) decision;
        assertThat(fail.errorCode()).isEqualTo(ErrorCode.WRITING_HINTS_TIMEOUT);
        verify(quotaAdapter).refund(50, fixedNow.plusSeconds(3600));
    }

    @Test
    @DisplayName("P1-01: begin trả về BeginDecision.Denied khi languageResolver ném AppException")
    void beginReturnsDeniedWhenLanguageResolverThrowsAppException() {
        TestAttempt attempt = createValidAttempt(1);
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        when(languageResolver.resolveForAttempt(1, "bad-lang", "vi", "en"))
                .thenThrow(new AppException(ErrorCode.WRITING_HINTS_LANGUAGE_UNSUPPORTED, "Ngôn ngữ không hỗ trợ"));

        WritingHintsRequest req = new WritingHintsRequest(30, "q-1", "req-bad-lang", "bad-lang", "vi");

        WritingHintTransactionCoordinator.BeginDecision decision = coordinator.begin(1, 10, req);

        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.BeginDecision.Denied.class);
        var denied = (WritingHintTransactionCoordinator.BeginDecision.Denied) decision;
        assertThat(denied.errorCode()).isEqualTo(ErrorCode.WRITING_HINTS_LANGUAGE_UNSUPPORTED);
        verify(quotaAdapter, never()).tryReserve(any());
    }

    @Test
    @DisplayName("P1-01: begin trả về BeginDecision.Denied khi contextReader ném AppException")
    void beginReturnsDeniedWhenContextReaderThrowsAppException() {
        TestAttempt attempt = createValidAttempt(1);
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        WritingHintLanguageResolver.ResolvedLanguages languages =
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi");
        when(languageResolver.resolveForAttempt(1, "en", "vi", "en")).thenReturn(languages);

        when(contextReader.read(attempt, 30, "q-1"))
                .thenThrow(new AppException(ErrorCode.WRITING_HINTS_CONTEXT_UNAVAILABLE, "Ngữ cảnh không khả dụng"));

        WritingHintsRequest req = new WritingHintsRequest(30, "q-1", "req-no-ctx", "en", "vi");

        WritingHintTransactionCoordinator.BeginDecision decision = coordinator.begin(1, 10, req);

        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.BeginDecision.Denied.class);
        var denied = (WritingHintTransactionCoordinator.BeginDecision.Denied) decision;
        assertThat(denied.errorCode()).isEqualTo(ErrorCode.WRITING_HINTS_CONTEXT_UNAVAILABLE);
        verify(quotaAdapter, never()).tryReserve(any());
    }

    @Test
    @DisplayName("P1-01: complete thất bại và hoàn quota khi lease hết hạn đúng tại equality boundary (now == leaseUntil)")
    void completeFailsAndRefundsWhenLeaseExpiredAtEqualityBoundary() {
        TestAttempt attempt = createValidAttempt(1);
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        WritingHintRequest ledger = WritingHintRequest.builder()
                .userId(1)
                .runId("run-123")
                .quotaId(50)
                .quotaResetDate(fixedNow.plusSeconds(3600))
                .quotaReserved(true)
                .status(WritingHintRequest.Status.PENDING)
                .leaseUntil(fixedNow) // Exact equality boundary: now == leaseUntil
                .build();
        ledger.setId(100);
        when(requestRepository.findByIdForUpdate(100)).thenReturn(Optional.of(ledger));

        WritingHintTransactionCoordinator.Reservation reservation = new WritingHintTransactionCoordinator.Reservation(
                100, "run-123", 1, 10, 30, "q-1", "req-1",
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi"),
                null, fixedNow, 50, fixedNow.plusSeconds(3600)
        );

        WritingHintsResponse.Content content = new WritingHintsResponse.Content(List.of(), List.of(), List.of());

        WritingHintTransactionCoordinator.TerminalDecision decision = coordinator.complete(reservation, content);

        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.TerminalDecision.Failure.class);
        var fail = (WritingHintTransactionCoordinator.TerminalDecision.Failure) decision;
        assertThat(fail.errorCode()).isEqualTo(ErrorCode.WRITING_HINTS_TIMEOUT);

        verify(quotaAdapter).refund(50, fixedNow.plusSeconds(3600));
        assertThat(ledger.getStatus()).isEqualTo(WritingHintRequest.Status.FAILED);
        assertThat(ledger.getQuotaReserved()).isFalse();
        assertThat(ledger.getFailureCode()).isEqualTo("LEASE_EXPIRED");
        verify(requestRepository).save(ledger);
    }

    @Test
    @DisplayName("P1-01: complete thất bại và hoàn quota khi lease hết hạn sau khi chờ khóa dòng (fresh now)")
    void completeFailsAndRefundsWhenLeaseExpiredAfterLocks() {
        TestAttempt attempt = createValidAttempt(1);
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        WritingHintRequest ledger = WritingHintRequest.builder()
                .userId(1)
                .runId("run-123")
                .quotaId(50)
                .quotaResetDate(fixedNow.plusSeconds(3600))
                .quotaReserved(true)
                .status(WritingHintRequest.Status.PENDING)
                .leaseUntil(fixedNow.plusSeconds(45)) // Lease expire at t0 + 45s
                .build();
        ledger.setId(100);
        when(requestRepository.findByIdForUpdate(100)).thenReturn(Optional.of(ledger));

        WritingHintTransactionCoordinator.Reservation reservation = new WritingHintTransactionCoordinator.Reservation(
                100, "run-123", 1, 10, 30, "q-1", "req-1",
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi"),
                null, fixedNow.plusSeconds(45), 50, fixedNow.plusSeconds(3600)
        );

        WritingHintsResponse.Content content = new WritingHintsResponse.Content(List.of(), List.of(), List.of());

        // Clock trả về t0 + 60s sau khi khóa đã acquire (quá hạn lease 45s)
        Clock mockClock = mock(Clock.class);
        when(mockClock.instant()).thenReturn(fixedNow.plusSeconds(60));
        WritingHintTransactionCoordinator coordWithMockClock = new WritingHintTransactionCoordinator(
                attemptRepository, requestRepository, quotaAdapter, contextReader, languageResolver,
                writingHintsProperties, geminiProperties, objectMapper, mockClock
        );

        WritingHintTransactionCoordinator.TerminalDecision decision = coordWithMockClock.complete(reservation, content);

        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.TerminalDecision.Failure.class);
        var fail = (WritingHintTransactionCoordinator.TerminalDecision.Failure) decision;
        assertThat(fail.errorCode()).isEqualTo(ErrorCode.WRITING_HINTS_TIMEOUT);

        verify(quotaAdapter).refund(50, fixedNow.plusSeconds(3600));
        assertThat(ledger.getStatus()).isEqualTo(WritingHintRequest.Status.FAILED);
        assertThat(ledger.getQuotaReserved()).isFalse();
        assertThat(ledger.getFailureCode()).isEqualTo("LEASE_EXPIRED");
        verify(requestRepository).save(ledger);
    }

    @Test
    @DisplayName("P1-01: complete thất bại và hoàn quota khi attempt deadline hết hạn trong lúc chờ khóa dù lease còn hiệu lực")
    void completeFailsAndRefundsWhenAttemptDeadlineExpiredDuringLockWait() {
        TestAttempt attempt = createValidAttempt(1);
        attempt.setDeadline(fixedNow.plusSeconds(30)); // Deadline t0 + 30s
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        WritingHintRequest ledger = WritingHintRequest.builder()
                .userId(1)
                .runId("run-123")
                .quotaId(50)
                .quotaResetDate(fixedNow.plusSeconds(3600))
                .quotaReserved(true)
                .status(WritingHintRequest.Status.PENDING)
                .leaseUntil(fixedNow.plusSeconds(120)) // Lease vẫn còn hiệu lực (t0 + 120s)
                .build();
        ledger.setId(100);
        when(requestRepository.findByIdForUpdate(100)).thenReturn(Optional.of(ledger));

        WritingHintTransactionCoordinator.Reservation reservation = new WritingHintTransactionCoordinator.Reservation(
                100, "run-123", 1, 10, 30, "q-1", "req-1",
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi"),
                null, fixedNow.plusSeconds(120), 50, fixedNow.plusSeconds(3600)
        );

        WritingHintsResponse.Content content = new WritingHintsResponse.Content(List.of(), List.of(), List.of());

        // Clock trả về t0 + 60s sau khi khóa acquire (quá deadline 30s nhưng trong lease 120s)
        Clock mockClock = mock(Clock.class);
        when(mockClock.instant()).thenReturn(fixedNow.plusSeconds(60));
        WritingHintTransactionCoordinator coordWithMockClock = new WritingHintTransactionCoordinator(
                attemptRepository, requestRepository, quotaAdapter, contextReader, languageResolver,
                writingHintsProperties, geminiProperties, objectMapper, mockClock
        );

        WritingHintTransactionCoordinator.TerminalDecision decision = coordWithMockClock.complete(reservation, content);

        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.TerminalDecision.Failure.class);
        var fail = (WritingHintTransactionCoordinator.TerminalDecision.Failure) decision;
        assertThat(fail.errorCode()).isEqualTo(ErrorCode.ATTEMPT_EXPIRED);

        verify(quotaAdapter).refund(50, fixedNow.plusSeconds(3600));
        assertThat(ledger.getStatus()).isEqualTo(WritingHintRequest.Status.FAILED);
        assertThat(ledger.getQuotaReserved()).isFalse();
        assertThat(ledger.getFailureCode()).isEqualTo("ATTEMPT_EXPIRED");
        verify(requestRepository).save(ledger);

        // Attempt không bị finalize
        assertThat(attempt.getStatus()).isEqualTo(AttemptStatus.IN_PROGRESS);
    }

    @Test
    @DisplayName("P1-01: complete không hoàn quota và không ghi đè nếu run đã bị thay thế bởi run mới hơn")
    void completeDoesNotRefundOrOverwriteWhenRunWasReplaced() {
        TestAttempt attempt = createValidAttempt(1);
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        WritingHintRequest ledger = WritingHintRequest.builder()
                .userId(1)
                .runId("new-run-replaced-999") // Run mới hơn!
                .quotaId(50)
                .quotaResetDate(fixedNow.plusSeconds(3600))
                .quotaReserved(true)
                .status(WritingHintRequest.Status.PENDING)
                .leaseUntil(fixedNow.plusSeconds(45))
                .build();
        ledger.setId(100);
        when(requestRepository.findByIdForUpdate(100)).thenReturn(Optional.of(ledger));

        WritingHintTransactionCoordinator.Reservation oldReservation = new WritingHintTransactionCoordinator.Reservation(
                100, "old-run-123", 1, 10, 30, "q-1", "req-1",
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi"),
                null, fixedNow.plusSeconds(45), 50, fixedNow.plusSeconds(3600)
        );

        WritingHintsResponse.Content content = new WritingHintsResponse.Content(List.of(), List.of(), List.of());

        WritingHintTransactionCoordinator.TerminalDecision decision = coordinator.complete(oldReservation, content);

        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.TerminalDecision.Failure.class);
        var fail = (WritingHintTransactionCoordinator.TerminalDecision.Failure) decision;
        assertThat(fail.errorCode()).isEqualTo(ErrorCode.WRITING_HINTS_TIMEOUT);

        // Không hoàn quota của run mới và không ghi đè ledger
        verify(quotaAdapter, never()).refund(any(), any());
        verify(requestRepository, never()).save(any());
        assertThat(ledger.getStatus()).isEqualTo(WritingHintRequest.Status.PENDING);
        assertThat(ledger.getQuotaReserved()).isTrue();
    }

    @Test
    @DisplayName("P1-01: begin lấy lại timestamp sau khi khóa quota và từ chối nếu deadline đã hết hạn trong lúc chờ khóa")
    void beginRefreshesTimestampAfterQuotaLockWaitAndRejectsIfDeadlinePassed() {
        TestAttempt attempt = createValidAttempt(1);
        attempt.setDeadline(fixedNow.plusSeconds(5)); // Deadline t0 + 5s
        when(attemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        // Lần gọi 1 (trước quota lock): t0 (chưa quá hạn)
        // Lần gọi 2 (sau quota lock): t0 + 10s (đã quá hạn)
        Clock mockClock = mock(Clock.class);
        when(mockClock.instant()).thenReturn(fixedNow, fixedNow.plusSeconds(10));

        WritingHintTransactionCoordinator coordWithMockClock = new WritingHintTransactionCoordinator(
                attemptRepository, requestRepository, quotaAdapter, contextReader, languageResolver,
                writingHintsProperties, geminiProperties, objectMapper, mockClock
        );

        WritingHintsRequest req = new WritingHintsRequest(30, "q-1", "req-deadline-lock", "en", "vi");

        WritingHintTransactionCoordinator.BeginDecision decision = coordWithMockClock.begin(1, 10, req);

        assertThat(decision).isInstanceOf(WritingHintTransactionCoordinator.BeginDecision.Denied.class);
        var denied = (WritingHintTransactionCoordinator.BeginDecision.Denied) decision;
        assertThat(denied.errorCode()).isEqualTo(ErrorCode.ATTEMPT_EXPIRED);
        verify(quotaAdapter).lockAccount(1);
        verify(quotaAdapter, never()).tryReserve(any());
    }
}
