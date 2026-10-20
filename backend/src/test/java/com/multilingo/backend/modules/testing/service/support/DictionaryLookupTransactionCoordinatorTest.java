package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.modules.analytics.service.DictionaryLookupQuotaService;
import com.multilingo.backend.modules.analytics.service.UserQuotaReservationService;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiProperties;
import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupRequest;
import com.multilingo.backend.modules.testing.dto.response.DictionaryLookupResponse;
import com.multilingo.backend.modules.testing.entity.DictionaryLookupRequestRecord;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.repository.DictionaryLookupRequestRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DictionaryLookupTransactionCoordinatorTest {
    private static final Instant NOW = Instant.parse("2026-10-20T12:00:00Z");
    private TestAttemptRepository attemptRepository;
    private DictionaryLookupRequestRepository requestRepository;
    private DictionaryLookupContextReader contextReader;
    private DictionaryLookupRequestValidator requestValidator;
    private DictionaryLookupQuotaService quotaService;
    private GeminiProperties geminiProperties;
    private DictionaryLookupTransactionCoordinator coordinator;

    @BeforeEach
    void setUp() {
        attemptRepository = mock(TestAttemptRepository.class);
        requestRepository = mock(DictionaryLookupRequestRepository.class);
        contextReader = mock(DictionaryLookupContextReader.class);
        requestValidator = mock(DictionaryLookupRequestValidator.class);
        quotaService = mock(DictionaryLookupQuotaService.class);
        geminiProperties = new GeminiProperties();
        geminiProperties.setRequestTimeout(java.time.Duration.ofSeconds(30));
        coordinator = new DictionaryLookupTransactionCoordinator(attemptRepository, requestRepository, contextReader,
                requestValidator, quotaService, geminiProperties,
                Clock.fixed(NOW, ZoneOffset.UTC));
        when(requestValidator.validate(any())).thenAnswer(call -> call.getArgument(0));
        when(attemptRepository.findByIdForUpdate(70)).thenReturn(Optional.of(validAttempt()));
        when(contextReader.read(anyMap(), any())).thenReturn(new DictionaryLookupContextReader.VerifiedContext(
                "The elms grow in Britain.", "elms"));
        when(quotaService.reservePrepared(8)).thenReturn(new UserQuotaReservationService.QuotaReservation(9, NOW.plusSeconds(3600)));
        when(requestRepository.findByUserIdAndRequestIdForUpdate(8, "req-id")).thenReturn(Optional.empty());
        when(requestRepository.findByUserIdAndStatusForUpdate(8, DictionaryLookupRequestRecord.Status.PENDING)).thenReturn(List.of());
        when(requestRepository.findFirstByUserIdOrderByLastStartedAtDesc(8)).thenReturn(Optional.empty());
        when(requestRepository.saveAndFlush(any())).thenAnswer(call -> {
            DictionaryLookupRequestRecord record = call.getArgument(0);
            record.setId(12);
            return record;
        });
    }

    @Test
    void verifiesScopeBeforeQuotaAndCreatesBoundedPendingLedger() {
        var request = request("elms", "The elms grow in Britain.");
        when(requestValidator.validate(request)).thenReturn(request);
        var decision = coordinator.begin(8, 70, request);

        assertThat(decision).isInstanceOf(DictionaryLookupTransactionCoordinator.Reserved.class);
        var reservation = ((DictionaryLookupTransactionCoordinator.Reserved) decision).reservation();
        assertThat(reservation.leaseUntil()).isEqualTo(NOW.plusSeconds(45));
        verify(quotaService).prepareDailyQuota(8);
        verify(quotaService).reservePrepared(8);
        verify(requestRepository).saveAndFlush(argThat(row -> row.getStatus() == DictionaryLookupRequestRecord.Status.PENDING
                && row.getResultJson() == null && row.getQuotaReserved()));
    }

    @Test
    void invalidSnapshotContextStopsBeforeQuotaReservation() {
        var request = request("elms", "Invented context not in the passage.");
        when(requestValidator.validate(request)).thenReturn(request);
        when(contextReader.read(anyMap(), eq(request))).thenThrow(new AppException(com.multilingo.backend.common.exception.ErrorCode.VALIDATION_FAILED));

        assertThatThrownBy(() -> coordinator.begin(8, 70, request)).isInstanceOf(AppException.class);
        verifyNoInteractions(quotaService);
        verify(requestRepository, never()).save(any());
    }

    @Test
    void ownerMockAndFinishedAttemptAreRejectedBeforeQuota() {
        var request = request("elms", "The elms grow in Britain.");
        when(requestValidator.validate(request)).thenReturn(request);
        TestAttempt otherOwner = validAttempt();
        otherOwner.setUserId(99);
        when(attemptRepository.findByIdForUpdate(70)).thenReturn(Optional.of(otherOwner));
        assertThatThrownBy(() -> coordinator.begin(8, 70, request)).isInstanceOf(AppException.class);

        TestAttempt mockMode = validAttempt();
        mockMode.setTestMode(TestMode.MOCK_TEST);
        when(attemptRepository.findByIdForUpdate(70)).thenReturn(Optional.of(mockMode));
        assertThatThrownBy(() -> coordinator.begin(8, 70, request)).isInstanceOf(AppException.class);

        TestAttempt finished = validAttempt();
        finished.setStatus(AttemptStatus.SUBMITTED);
        when(attemptRepository.findByIdForUpdate(70)).thenReturn(Optional.of(finished));
        assertThatThrownBy(() -> coordinator.begin(8, 70, request)).isInstanceOf(AppException.class);
        verifyNoInteractions(quotaService);
        verifyNoInteractions(contextReader);
    }

    @Test
    void lockedReadingPartIsRejectedBeforeQuota() {
        var request = request("elms", "The elms grow in Britain.");
        when(requestValidator.validate(request)).thenReturn(request);
        TestAttempt locked = validAttempt();
        locked.setLockedSections(List.of(3));
        when(attemptRepository.findByIdForUpdate(70)).thenReturn(Optional.of(locked));

        assertThatThrownBy(() -> coordinator.begin(8, 70, request)).isInstanceOf(AppException.class);
        verify(contextReader).read(anyMap(), eq(request));
        verifyNoInteractions(quotaService);
    }

    @Test
    void exactSuccessfulReplayDoesNotReserveQuotaAgainAndRebuildsContextFromSnapshot() {
        var request = request("elms", "The elms grow in Britain.");
        String fingerprint = DictionaryLookupTransactionCoordinator.fingerprint(70, request);
        var old = DictionaryLookupRequestRecord.builder().userId(8).attemptId(70).partId(4).documentId("g-4")
                .requestId("req-id").requestFingerprint(fingerprint).status(DictionaryLookupRequestRecord.Status.SUCCEEDED)
                .resultJson(Map.of("meaningVi", "cây du", "exampleEn", "Elms grow.", "exampleVi", "Cây du phát triển."))
                .build();
        when(requestValidator.validate(request)).thenReturn(request);
        when(requestRepository.findByUserIdAndRequestIdForUpdate(8, "req-id")).thenReturn(Optional.of(old));

        var decision = coordinator.begin(8, 70, request);

        assertThat(decision).isInstanceOf(DictionaryLookupTransactionCoordinator.Replay.class);
        var response = ((DictionaryLookupTransactionCoordinator.Replay) decision).response();
        assertThat(response.meaningVi()).isEqualTo("cây du");
        assertThat(response.sourceContext()).isEqualTo("The elms grow in Britain.");
        verify(quotaService, never()).reservePrepared(anyInt());
    }

    @Test
    void requestIdWithDifferentFingerprintConflictsWithoutCharging() {
        var request = request("elms", "The elms grow in Britain.");
        var old = DictionaryLookupRequestRecord.builder().userId(8).attemptId(70).partId(4).documentId("g-4")
                .requestId("req-id").requestFingerprint("different").status(DictionaryLookupRequestRecord.Status.FAILED).build();
        when(requestValidator.validate(request)).thenReturn(request);
        when(requestRepository.findByUserIdAndRequestIdForUpdate(8, "req-id")).thenReturn(Optional.of(old));

        assertThatThrownBy(() -> coordinator.begin(8, 70, request)).isInstanceOf(AppException.class);
        verify(quotaService, never()).reservePrepared(anyInt());
    }

    @Test
    void lateCompletionAfterLeaseExpiryDoesNotPersistOrConsumeResult() {
        var request = request("elms", "The elms grow in Britain.");
        var reservation = new DictionaryLookupTransactionCoordinator.Reservation(12, "run-1", 8, 70, request,
                "The elms grow in Britain.", 9, NOW.plusSeconds(3600), NOW.minusSeconds(1));
        var pending = DictionaryLookupRequestRecord.builder().status(DictionaryLookupRequestRecord.Status.PENDING)
                .runId("run-1").leaseUntil(NOW.minusSeconds(1)).quotaReserved(true).build();
        pending.setId(12);
        when(requestRepository.findByIdForUpdate(12)).thenReturn(Optional.of(pending));

        assertThat(coordinator.complete(reservation, response())).isEmpty();
        verify(requestRepository, never()).save(any());
    }

    @Test
    void activePendingRequestForSameUserIsRejectedBeforeAnotherReservation() {
        var request = request("elms", "The elms grow in Britain.");
        var active = DictionaryLookupRequestRecord.builder().status(DictionaryLookupRequestRecord.Status.PENDING)
                .runId("other").leaseUntil(NOW.plusSeconds(20)).quotaReserved(true).build();
        when(requestValidator.validate(request)).thenReturn(request);
        when(requestRepository.findByUserIdAndStatusForUpdate(8, DictionaryLookupRequestRecord.Status.PENDING))
                .thenReturn(List.of(active));

        assertThatThrownBy(() -> coordinator.begin(8, 70, request)).isInstanceOf(AppException.class);
        verify(quotaService, never()).reservePrepared(anyInt());
    }

    @Test
    void expiredPendingIsRefundedAndFencedBeforeNewRun() {
        var request = request("elms", "The elms grow in Britain.");
        var old = DictionaryLookupRequestRecord.builder().status(DictionaryLookupRequestRecord.Status.PENDING)
                .runId("old-run").leaseUntil(NOW.minusSeconds(1)).quotaReserved(true).quotaId(6)
                .quotaResetDate(NOW.plusSeconds(3600)).build();
        when(requestValidator.validate(request)).thenReturn(request);
        when(requestRepository.findByUserIdAndStatusForUpdate(8, DictionaryLookupRequestRecord.Status.PENDING))
                .thenReturn(List.of(old));

        assertThat(coordinator.begin(8, 70, request)).isInstanceOf(DictionaryLookupTransactionCoordinator.Reserved.class);
        verify(quotaService).refund(6, NOW.plusSeconds(3600));
        assertThat(old.getStatus()).isEqualTo(DictionaryLookupRequestRecord.Status.FAILED);
        assertThat(old.getRunId()).isNull();
    }

    @Test
    void completionStoresOnlyGeneratedDefinitionAndConsumesReservation() {
        var request = request("elms", "The elms grow in Britain.");
        var reservation = new DictionaryLookupTransactionCoordinator.Reservation(12, "run-1", 8, 70, request,
                "The elms grow in Britain.", 9, NOW.plusSeconds(3600), NOW.plusSeconds(30));
        var pending = DictionaryLookupRequestRecord.builder().status(DictionaryLookupRequestRecord.Status.PENDING)
                .runId("run-1").leaseUntil(NOW.plusSeconds(30)).quotaReserved(true).build();
        pending.setId(12);
        when(requestRepository.findByIdForUpdate(12)).thenReturn(Optional.of(pending));

        var result = coordinator.complete(reservation, response());

        assertThat(result).isPresent();
        assertThat(pending.getStatus()).isEqualTo(DictionaryLookupRequestRecord.Status.SUCCEEDED);
        assertThat(pending.getQuotaReserved()).isFalse();
        assertThat(pending.getResultJson()).containsOnlyKeys("meaningVi", "phonetic", "partOfSpeech", "exampleEn", "exampleVi");
        assertThat(pending.getResultJson()).doesNotContainKey("sourceContext");
    }

    @Test
    void failingCurrentRunRefundsOnceAndLateDuplicateFailIsFenced() {
        var request = request("elms", "The elms grow in Britain.");
        var reservation = new DictionaryLookupTransactionCoordinator.Reservation(12, "run-1", 8, 70, request,
                "The elms grow in Britain.", 9, NOW.plusSeconds(3600), NOW.plusSeconds(30));
        var pending = DictionaryLookupRequestRecord.builder().status(DictionaryLookupRequestRecord.Status.PENDING)
                .runId("run-1").leaseUntil(NOW.plusSeconds(30)).quotaReserved(true).quotaId(9)
                .quotaResetDate(NOW.plusSeconds(3600)).build();
        pending.setId(12);
        when(requestRepository.findByIdForUpdate(12)).thenReturn(Optional.of(pending));

        assertThat(coordinator.fail(reservation, "PROVIDER_ERROR")).isTrue();
        assertThat(coordinator.fail(reservation, "PROVIDER_ERROR")).isFalse();
        verify(quotaService, times(1)).refund(9, NOW.plusSeconds(3600));
    }

    private DictionaryLookupRequest request(String selectedText, String contextText) {
        return new DictionaryLookupRequest("req-id", 4, "g-4", selectedText, contextText);
    }

    private DictionaryLookupResponse response() {
        return new DictionaryLookupResponse("req-id", 70, 4, "g-4", "elms", "The elms grow in Britain.",
                "en", "vi", "cây du", null, "noun", "Elms grow.", "Cây du phát triển.");
    }

    private TestAttempt validAttempt() {
        TestAttempt attempt = new TestAttempt();
        attempt.setId(70);
        attempt.setUserId(8);
        attempt.setTestMode(TestMode.PRACTICE);
        attempt.setStatus(AttemptStatus.IN_PROGRESS);
        attempt.setLockedSections(List.of());
        attempt.setExamSnapshot(Map.of("sections", List.of(Map.of("id", 3, "name", "READING",
                "parts", List.of(Map.of("id", 4, "question_groups", List.of(Map.of("group_id", "g-4"))))))));
        return attempt;
    }
}
