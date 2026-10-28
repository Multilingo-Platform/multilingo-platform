package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.analytics.service.DictionaryLookupQuotaService;
import com.multilingo.backend.modules.analytics.service.UserQuotaReservationService;
import com.multilingo.backend.modules.testing.ai.dictionary.DictionaryLookupV2OutputParser;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiProperties;
import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupRequest;
import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupV3Request;
import com.multilingo.backend.modules.testing.dto.request.WorkspaceTextSource;
import com.multilingo.backend.modules.testing.dto.response.AttemptLanguageContextResponse;
import com.multilingo.backend.modules.testing.dto.response.DictionaryLookupResponse;
import com.multilingo.backend.modules.testing.dto.response.DictionaryLookupV3Response;
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
    private DictionaryLookupV2RequestValidator v2RequestValidator;
    private DictionaryLookupV3RequestValidator v3RequestValidator;
    private DictionaryNativeLanguageResolver nativeLanguageResolver;
    private WorkspaceTextSourceReader workspaceTextSourceReader;
    private AttemptLanguageResolver languageResolver;
    private DictionaryLookupQuotaService quotaService;
    private GeminiProperties geminiProperties;
    private DictionaryLookupTransactionCoordinator coordinator;

    @BeforeEach
    void setUp() {
        attemptRepository = mock(TestAttemptRepository.class);
        requestRepository = mock(DictionaryLookupRequestRepository.class);
        contextReader = mock(DictionaryLookupContextReader.class);
        requestValidator = mock(DictionaryLookupRequestValidator.class);
        v2RequestValidator = mock(DictionaryLookupV2RequestValidator.class);
        v3RequestValidator = mock(DictionaryLookupV3RequestValidator.class);
        nativeLanguageResolver = mock(DictionaryNativeLanguageResolver.class);
        workspaceTextSourceReader = mock(WorkspaceTextSourceReader.class);
        languageResolver = mock(AttemptLanguageResolver.class);
        quotaService = mock(DictionaryLookupQuotaService.class);
        geminiProperties = new GeminiProperties();
        geminiProperties.setRequestTimeout(java.time.Duration.ofSeconds(30));
        coordinator = new DictionaryLookupTransactionCoordinator(attemptRepository, requestRepository, contextReader,
                requestValidator, v2RequestValidator, v3RequestValidator, nativeLanguageResolver,
                workspaceTextSourceReader, languageResolver, quotaService, geminiProperties,
                Clock.fixed(NOW, ZoneOffset.UTC));

        when(requestValidator.validate(any())).thenAnswer(call -> call.getArgument(0));
        when(v3RequestValidator.validate(any())).thenAnswer(call -> call.getArgument(0));
        when(v3RequestValidator.validate(any(), any())).thenAnswer(call -> call.getArgument(0));
        when(languageResolver.resolve(anyMap(), any())).thenReturn(
                new AttemptLanguageContextResponse("TV3_LANG_V1", "en", "vi", List.of("vi")));
        when(nativeLanguageResolver.requireNativeLanguage(eq(8), eq(8))).thenReturn("vi");
        when(workspaceTextSourceReader.verify(anyMap(), anyInt(), any(), anyString(), anyString())).thenReturn(
                new WorkspaceTextSourceReader.VerifiedSelection(
                        new WorkspaceTextSourceReader.WorkspaceTextDocument(4,
                                WorkspaceTextSource.part(WorkspaceTextSource.Kind.PART_CONTENT),
                                "PART_CONTENT", "The elms grow in Britain.", "hash"),
                        "elms",
                        "The elms grow in Britain.",
                        4,
                        8
                ));
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
    void v2FingerprintFreezesContractAndMeaningLanguageIntentWhileV1FingerprintRemainsStable() {
        var v1 = request("elms", "The elms grow in Britain.");
        var v2Default = new DictionaryLookupRequest(v1.requestId(), v1.partId(), v1.documentId(), v1.selectedText(), v1.contextText(), 2, null);
        var v2Explicit = new DictionaryLookupRequest(v1.requestId(), v1.partId(), v1.documentId(), v1.selectedText(), v1.contextText(), 2, "fr");
        assertThat(DictionaryLookupTransactionCoordinator.fingerprint(70, v1))
                .isEqualTo(DictionaryLookupTransactionCoordinator.fingerprint(70,
                        new DictionaryLookupRequest(v1.requestId(), v1.partId(), v1.documentId(), v1.selectedText(), v1.contextText())));
        assertThat(DictionaryLookupTransactionCoordinator.fingerprint(70, v2Default))
                .isNotEqualTo(DictionaryLookupTransactionCoordinator.fingerprint(70, v1));
        assertThat(DictionaryLookupTransactionCoordinator.fingerprint(70, v2Explicit))
                .isNotEqualTo(DictionaryLookupTransactionCoordinator.fingerprint(70, v2Default));
    }

    @Test
    void v3FingerprintFreezesVersionAndSourceIdentitySeparatelyFromV1AndV2() {
        var v1 = request("elms", "The elms grow in Britain.");
        var v3 = v3Request("elms", "The elms grow in Britain.");
        var v3DifferentSource = new DictionaryLookupV3Request(v3.requestId(), v3.partId(),
                WorkspaceTextSource.part(WorkspaceTextSource.Kind.PART_TITLE), v3.selectedText(), v3.contextText());

        assertThat(DictionaryLookupTransactionCoordinator.fingerprint(70, v3))
                .isEqualTo(DictionaryLookupTransactionCoordinator.fingerprintV3(70, v3));
        assertThat(DictionaryLookupTransactionCoordinator.fingerprint(70, v3))
                .isNotEqualTo(DictionaryLookupTransactionCoordinator.fingerprint(70, v1));
        assertThat(DictionaryLookupTransactionCoordinator.fingerprint(70, v3DifferentSource))
                .isNotEqualTo(DictionaryLookupTransactionCoordinator.fingerprint(70, v3));
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
    void v3VerifiesScopeAndNativeLanguageBeforeQuotaReservation() {
        var req = v3Request("elms", "The elms grow in Britain.");
        var decision = coordinator.beginV3(8, 70, req);

        assertThat(decision).isInstanceOf(DictionaryLookupTransactionCoordinator.Reserved.class);
        var reservation = ((DictionaryLookupTransactionCoordinator.Reserved) decision).reservation();
        assertThat(reservation.v3Request()).isEqualTo(req);
        assertThat(reservation.learningLanguage()).isEqualTo("en");
        assertThat(reservation.meaningLanguage()).isEqualTo("vi");

        verify(nativeLanguageResolver).requireNativeLanguage(8, 8);
        verify(workspaceTextSourceReader).verify(anyMap(), eq(4), eq(req.source()), eq("elms"), eq("The elms grow in Britain."));
        verify(quotaService).prepareDailyQuota(8);
        verify(quotaService).reservePrepared(8);

        verify(requestRepository).saveAndFlush(argThat(row ->
                row.getStatus() == DictionaryLookupRequestRecord.Status.PENDING
                        && row.getResultJson() == null
                        && row.getQuotaReserved()
                        && "3".equals(String.valueOf(row.getContextJson().get("schemaVersion")))
                        && "NATIVE_PROFILE_V1".equals(row.getContextJson().get("policyVersion"))
                        && "en".equals(row.getContextJson().get("learningLanguage"))
                        && "vi".equals(row.getContextJson().get("meaningLanguage"))
        ));
    }

    @Test
    void v3RejectsMissingOrUnsupportedNativeLanguageBeforeQuota() {
        var req = v3Request("elms", "The elms grow in Britain.");
        when(nativeLanguageResolver.requireNativeLanguage(8, 8))
                .thenThrow(new AppException(ErrorCode.DICTIONARY_NATIVE_LANGUAGE_REQUIRED));

        assertThatThrownBy(() -> coordinator.beginV3(8, 70, req))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode())
                        .isEqualTo(ErrorCode.DICTIONARY_NATIVE_LANGUAGE_REQUIRED));

        verify(quotaService).prepareDailyQuota(8);
        verify(quotaService, never()).reservePrepared(anyInt());
        verify(requestRepository, never()).saveAndFlush(any());
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
    void r2F01ReservesV3ForLaterVerbatimSelectionUsingRealReader() {
        when(workspaceTextSourceReader.verify(anyMap(), anyInt(), any(), anyString(), anyString()))
                .thenAnswer(call -> new WorkspaceTextSourceReader().verify(call.getArgument(0), call.getArgument(1),
                        call.getArgument(2), call.getArgument(3), call.getArgument(4)));
        for (boolean html : List.of(false, true)) {
            TestAttempt attempt = validAttempt();
            attempt.setExamSnapshot(Map.of("sections", List.of(Map.of("id", 3, "name", "READING", "parts", List.of(
                    Map.of("id", 4, html ? "content_html" : "instruction", html
                            ? "<p>chosen&nbsp;words; later <b>chosen words</b>.</p>"
                            : "chosen  words; later chosen words."))))));
            when(attemptRepository.findByIdForUpdate(70)).thenReturn(Optional.of(attempt));
            var req = new DictionaryLookupV3Request(UUID.randomUUID().toString(), 4,
                    WorkspaceTextSource.part(html ? WorkspaceTextSource.Kind.PART_CONTENT : WorkspaceTextSource.Kind.PART_INSTRUCTION),
                    "chosen words", "chosen words; later chosen words.");
            var reservation = ((DictionaryLookupTransactionCoordinator.Reserved) coordinator.beginV3(8, 70, req)).reservation();
            assertThat(reservation.sourceContext()).isEqualTo(req.contextText());
        }
        verify(quotaService, times(2)).reservePrepared(8);
        verify(requestRepository, times(2)).saveAndFlush(any());
    }

    @Test
    void r2F01ForgedCollapsedContextIsRejectedByRealReaderBeforeQuota() {
        TestAttempt attempt = validAttempt();
        attempt.setExamSnapshot(Map.of("sections", List.of(Map.of("id", 3, "name", "READING",
                "parts", List.of(Map.of("id", 4, "instruction", "First line\nchosen  words\u00a0after."))))));
        when(attemptRepository.findByIdForUpdate(70)).thenReturn(Optional.of(attempt));
        when(workspaceTextSourceReader.verify(anyMap(), anyInt(), any(), anyString(), anyString()))
                .thenAnswer(call -> new WorkspaceTextSourceReader().verify(call.getArgument(0), call.getArgument(1),
                        call.getArgument(2), call.getArgument(3), call.getArgument(4)));
        var req = new DictionaryLookupV3Request(UUID.randomUUID().toString(), 4,
                WorkspaceTextSource.part(WorkspaceTextSource.Kind.PART_INSTRUCTION), "chosen", "forged chosen context");
        assertThatThrownBy(() -> coordinator.beginV3(8, 70, req)).isInstanceOf(AppException.class);
        verifyNoInteractions(quotaService);
        verify(requestRepository, never()).saveAndFlush(any());
    }

    @Test
    void v3OwnerMockAndFinishedAttemptAreRejectedBeforeQuota() {
        var req = v3Request("elms", "The elms grow in Britain.");
        TestAttempt otherOwner = validAttempt();
        otherOwner.setUserId(99);
        when(attemptRepository.findByIdForUpdate(70)).thenReturn(Optional.of(otherOwner));
        assertThatThrownBy(() -> coordinator.beginV3(8, 70, req)).isInstanceOf(AppException.class);

        TestAttempt mockMode = validAttempt();
        mockMode.setTestMode(TestMode.MOCK_TEST);
        when(attemptRepository.findByIdForUpdate(70)).thenReturn(Optional.of(mockMode));
        assertThatThrownBy(() -> coordinator.beginV3(8, 70, req)).isInstanceOf(AppException.class);

        TestAttempt finished = validAttempt();
        finished.setStatus(AttemptStatus.SUBMITTED);
        when(attemptRepository.findByIdForUpdate(70)).thenReturn(Optional.of(finished));
        assertThatThrownBy(() -> coordinator.beginV3(8, 70, req)).isInstanceOf(AppException.class);
        verifyNoInteractions(quotaService);
        verifyNoInteractions(workspaceTextSourceReader);
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
    void v3ReplayOfSucceededRequestReturnsFrozenResponseWithoutConsumingQuota() {
        var req = v3Request("elms", "The elms grow in Britain.");
        String fingerprint = DictionaryLookupTransactionCoordinator.fingerprintV3(70, req);
        var old = DictionaryLookupRequestRecord.builder().userId(8).attemptId(70).partId(4)
                .documentId("PART_CONTENT").requestId("req-id").requestFingerprint(fingerprint)
                .status(DictionaryLookupRequestRecord.Status.SUCCEEDED)
                .contextJson(Map.of("schemaVersion", 3, "policyVersion", "NATIVE_PROFILE_V1",
                        "learningLanguage", "en", "meaningLanguage", "vi"))
                .resultJson(Map.of("meaning", "cây du", "phonetic", "/elm/", "partOfSpeech", "noun",
                        "example", "Elms grow.", "exampleTranslation", "Cây du phát triển."))
                .build();

        when(requestRepository.findByUserIdAndRequestIdForUpdate(8, "req-id")).thenReturn(Optional.of(old));

        var decision = coordinator.beginV3(8, 70, req);

        assertThat(decision).isInstanceOf(DictionaryLookupTransactionCoordinator.ReplayV3.class);
        var response = ((DictionaryLookupTransactionCoordinator.ReplayV3) decision).response();
        assertThat(response.requestId()).isEqualTo("req-id");
        assertThat(response.definition().meaning()).isEqualTo("cây du");
        assertThat(response.definition().meaningLanguage()).isEqualTo("vi");
        assertThat(response.definition().schemaVersion()).isEqualTo(2);
        assertThat(response.policyVersion()).isEqualTo("NATIVE_PROFILE_V1");
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
    void v3RequestIdWithDifferentFingerprintConflictsWithoutCharging() {
        var req = v3Request("elms", "The elms grow in Britain.");
        var old = DictionaryLookupRequestRecord.builder().userId(8).attemptId(70).partId(4)
                .documentId("PART_CONTENT").requestId("req-id").requestFingerprint("different-fingerprint")
                .status(DictionaryLookupRequestRecord.Status.FAILED).build();
        when(requestRepository.findByUserIdAndRequestIdForUpdate(8, "req-id")).thenReturn(Optional.of(old));

        assertThatThrownBy(() -> coordinator.beginV3(8, 70, req))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode())
                        .isEqualTo(ErrorCode.DICTIONARY_LOOKUP_REQUEST_CONFLICT));
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
    void v3CompletionStoresOnlyGeneratedDefinitionAndConsumesReservation() {
        var req = v3Request("elms", "The elms grow in Britain.");
        var reservation = new DictionaryLookupTransactionCoordinator.Reservation(12, "run-1", 8, 70, null, req,
                "The elms grow in Britain.", 9, NOW.plusSeconds(3600), NOW.plusSeconds(30), "en", "vi");
        var pending = DictionaryLookupRequestRecord.builder().status(DictionaryLookupRequestRecord.Status.PENDING)
                .runId("run-1").leaseUntil(NOW.plusSeconds(30)).quotaReserved(true).build();
        pending.setId(12);
        when(requestRepository.findByIdForUpdate(12)).thenReturn(Optional.of(pending));

        var result = coordinator.completeV3(reservation, v2Definition());

        assertThat(result).isPresent();
        assertThat(pending.getStatus()).isEqualTo(DictionaryLookupRequestRecord.Status.SUCCEEDED);
        assertThat(pending.getQuotaReserved()).isFalse();
        assertThat(pending.getResultJson()).containsOnlyKeys("meaning", "phonetic", "partOfSpeech", "example", "exampleTranslation");
        assertThat(pending.getResultJson()).doesNotContainKey("sourceContext");

        var response = result.get();
        assertThat(response.requestId()).isEqualTo("req-id");
        assertThat(response.definition().meaning()).isEqualTo("cây du");
        assertThat(response.policyVersion()).isEqualTo(DictionaryLookupV3Response.CURRENT_POLICY_VERSION);
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

    @Test
    void v3ReplayOfSucceededRequestSucceedsEvenIfCurrentNativeProfileIsMissingOrUnsupported() {
        var req = v3Request("elms", "The elms grow in Britain.");
        String fingerprint = DictionaryLookupTransactionCoordinator.fingerprintV3(70, req);
        var old = DictionaryLookupRequestRecord.builder().userId(8).attemptId(70).partId(4)
                .documentId("PART_CONTENT").requestId("req-id").requestFingerprint(fingerprint)
                .status(DictionaryLookupRequestRecord.Status.SUCCEEDED)
                .contextJson(Map.of("schemaVersion", 3, "policyVersion", "NATIVE_PROFILE_V1",
                        "learningLanguage", "en", "meaningLanguage", "vi"))
                .resultJson(Map.of("meaning", "cây du", "phonetic", "/elm/", "partOfSpeech", "noun",
                        "example", "Elms grow.", "exampleTranslation", "Cây du phát triển."))
                .build();

        when(requestRepository.findByUserIdAndRequestIdForUpdate(8, "req-id")).thenReturn(Optional.of(old));
        when(nativeLanguageResolver.requireNativeLanguage(any(), any()))
                .thenThrow(new AppException(ErrorCode.DICTIONARY_NATIVE_LANGUAGE_REQUIRED));

        var decision = coordinator.beginV3(8, 70, req);

        assertThat(decision).isInstanceOf(DictionaryLookupTransactionCoordinator.ReplayV3.class);
        var response = ((DictionaryLookupTransactionCoordinator.ReplayV3) decision).response();
        assertThat(response.requestId()).isEqualTo("req-id");
        assertThat(response.definition().meaning()).isEqualTo("cây du");
        assertThat(response.definition().meaningLanguage()).isEqualTo("vi");
        verify(nativeLanguageResolver, never()).requireNativeLanguage(any(), any());
        verify(quotaService, never()).reservePrepared(anyInt());
    }

    @Test
    void v3RecoveryOfExpiredRecordReusesFrozenNativeLanguageWithoutQueryingCurrentProfile() {
        var req = v3Request("elms", "The elms grow in Britain.");
        String fingerprint = DictionaryLookupTransactionCoordinator.fingerprintV3(70, req);
        var expired = DictionaryLookupRequestRecord.builder().userId(8).attemptId(70).partId(4)
                .documentId("PART_CONTENT").requestId("req-id").requestFingerprint(fingerprint)
                .status(DictionaryLookupRequestRecord.Status.PENDING)
                .leaseUntil(NOW.minusSeconds(5))
                .quotaReserved(true).quotaId(9).quotaResetDate(NOW.plusSeconds(3600))
                .contextJson(Map.of("schemaVersion", 3, "policyVersion", "NATIVE_PROFILE_V1",
                        "learningLanguage", "en", "meaningLanguage", "vi"))
                .build();

        when(requestRepository.findByUserIdAndRequestIdForUpdate(8, "req-id")).thenReturn(Optional.of(expired));
        when(nativeLanguageResolver.requireNativeLanguage(any(), any()))
                .thenThrow(new AppException(ErrorCode.DICTIONARY_NATIVE_LANGUAGE_REQUIRED));

        var decision = coordinator.beginV3(8, 70, req);

        assertThat(decision).isInstanceOf(DictionaryLookupTransactionCoordinator.Reserved.class);
        var res = ((DictionaryLookupTransactionCoordinator.Reserved) decision).reservation();
        assertThat(res.meaningLanguage()).isEqualTo("vi");
        verify(quotaService).refund(9, NOW.plusSeconds(3600));
        verify(quotaService).reservePrepared(8);
        verify(nativeLanguageResolver, never()).requireNativeLanguage(any(), any());
    }

    @Test
    void v3EnforcesWordCountLimitOnSnapshotLearningLanguageBeforeQuota() {
        var sixWordReq = v3Request("one two three four five six", "The context with one two three four five six words.");
        when(v3RequestValidator.validate(eq(sixWordReq), eq("en")))
                .thenThrow(new AppException(ErrorCode.VALIDATION_FAILED));

        assertThatThrownBy(() -> coordinator.beginV3(8, 70, sixWordReq))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.VALIDATION_FAILED));

        verify(v3RequestValidator).validate(sixWordReq, "en");
        verifyNoInteractions(quotaService);
    }

    @Test
    void sourceLedgerDocumentIdIsBoundedTo128CharactersAndCollisionResistant() {
        String long128 = "q".repeat(128);
        String other128 = "o".repeat(128);

        var maxOption = WorkspaceTextSource.option(long128, other128);
        assertThat(maxOption.sourceKey().length()).isEqualTo(277);
        assertThat(maxOption.ledgerDocumentId().length()).isLessThanOrEqualTo(128);
        assertThat(maxOption.ledgerDocumentId()).startsWith("OPTION_TEXT:h:");

        var diffOption = WorkspaceTextSource.option(long128, "x".repeat(128));
        assertThat(diffOption.ledgerDocumentId()).isNotEqualTo(maxOption.ledgerDocumentId());

        var maxQuestion = WorkspaceTextSource.question(long128);
        assertThat(maxQuestion.sourceKey().length()).isEqualTo(146);
        assertThat(maxQuestion.ledgerDocumentId().length()).isLessThanOrEqualTo(128);
        assertThat(maxQuestion.ledgerDocumentId()).startsWith("QUESTION_TEXT:h:");

        var maxGroup = WorkspaceTextSource.group(WorkspaceTextSource.Kind.GROUP_CONTENT, long128);
        assertThat(maxGroup.sourceKey().length()).isEqualTo(146);
        assertThat(maxGroup.ledgerDocumentId().length()).isLessThanOrEqualTo(128);
        assertThat(maxGroup.ledgerDocumentId()).startsWith("GROUP_CONTENT:h:");

        var shortPart = WorkspaceTextSource.part(WorkspaceTextSource.Kind.PART_CONTENT);
        assertThat(shortPart.ledgerDocumentId()).isEqualTo("PART_CONTENT");
    }

    @Test
    void v3BeginWithMaxLengthSourceStoresBoundedDocumentIdInLedger() {
        var longSource = WorkspaceTextSource.option("q".repeat(128), "o".repeat(128));
        var req = new DictionaryLookupV3Request("req-id", 4, longSource, "elms", "The elms grow in Britain.");
        when(workspaceTextSourceReader.verify(anyMap(), eq(4), eq(longSource), eq("elms"), eq("The elms grow in Britain.")))
                .thenReturn(new WorkspaceTextSourceReader.VerifiedSelection(
                        new WorkspaceTextSourceReader.WorkspaceTextDocument(4, longSource, longSource.sourceKey(),
                                "The elms grow in Britain.", "hash"),
                        "elms", "The elms grow in Britain.", 4, 8));

        var decision = coordinator.beginV3(8, 70, req);

        assertThat(decision).isInstanceOf(DictionaryLookupTransactionCoordinator.Reserved.class);
        verify(requestRepository).saveAndFlush(argThat(row ->
                row.getDocumentId().length() <= 128
                        && row.getDocumentId().startsWith("OPTION_TEXT:h:")
                        && "OPTION_TEXT:128:".concat("q".repeat(128)).concat(":128:").concat("o".repeat(128))
                                .equals(row.getContextJson().get("sourceKey"))
        ));
    }

    private DictionaryLookupRequest request(String selectedText, String contextText) {
        return new DictionaryLookupRequest("req-id", 4, "g-4", selectedText, contextText);
    }

    private DictionaryLookupV3Request v3Request(String selectedText, String contextText) {
        return new DictionaryLookupV3Request("req-id", 4,
                WorkspaceTextSource.part(WorkspaceTextSource.Kind.PART_CONTENT),
                selectedText, contextText);
    }

    private DictionaryLookupResponse response() {
        return new DictionaryLookupResponse("req-id", 70, 4, "g-4", "elms", "The elms grow in Britain.",
                "en", "vi", "cây du", null, "noun", "Elms grow.", "Cây du phát triển.");
    }

    private DictionaryLookupV2OutputParser.DictionaryLookupDefinitionV2 v2Definition() {
        return new DictionaryLookupV2OutputParser.DictionaryLookupDefinitionV2(
                "cây du", "/elm/", "noun", "Elms grow.", "Cây du phát triển.");
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
