package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.analytics.service.DictionaryLookupQuotaService;
import com.multilingo.backend.modules.analytics.service.UserQuotaReservationService;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiProperties;
import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupRequest;
import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupV2Request;
import com.multilingo.backend.modules.testing.dto.response.DictionaryLookupResponse;
import com.multilingo.backend.modules.testing.dto.response.DictionaryLookupV2Response;
import com.multilingo.backend.modules.testing.entity.DictionaryLookupRequestRecord;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.repository.DictionaryLookupRequestRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * Short transaction boundaries around the external AI call. Lock order is attempt → quota → ledger.
 * Passage text is never persisted; replay reconstructs it from the immutable attempt snapshot.
 */
@Component
@RequiredArgsConstructor
public class DictionaryLookupTransactionCoordinator {
    private static final Duration COOLDOWN = Duration.ofSeconds(2);
    private static final Duration LEASE_EXTENSION = Duration.ofSeconds(15);

    private final TestAttemptRepository attemptRepository;
    private final DictionaryLookupRequestRepository requestRepository;
    private final DictionaryLookupContextReader contextReader;
    private final DictionaryLookupRequestValidator requestValidator;
    private final DictionaryLookupV2RequestValidator v2RequestValidator;
    private final AttemptLanguageResolver languageResolver;
    private final DictionaryLookupQuotaService quotaService;
    private final GeminiProperties geminiProperties;
    private final Clock clock;

    public sealed interface BeginDecision permits Replay, ReplayV2, Reserved { }
    public record Replay(DictionaryLookupResponse response) implements BeginDecision { }
    public record ReplayV2(DictionaryLookupV2Response response) implements BeginDecision { }
    public record Reserved(Reservation reservation) implements BeginDecision { }

    public record Reservation(Integer ledgerId, String runId, Integer userId, Integer attemptId,
                              DictionaryLookupRequest request, String sourceContext,
                              Integer quotaId, Instant quotaResetDate, Instant leaseUntil,
                              String learningLanguage, String meaningLanguage) {
        public Reservation(Integer ledgerId, String runId, Integer userId, Integer attemptId,
                           DictionaryLookupRequest request, String sourceContext,
                           Integer quotaId, Instant quotaResetDate, Instant leaseUntil) {
            this(ledgerId, runId, userId, attemptId, request, sourceContext, quotaId, quotaResetDate,
                    leaseUntil, "en", "vi");
        }
        @Override public String toString() {
            return "DictionaryLookupReservation[ledgerId=" + ledgerId + ", runId=" + runId
                    + ", userId=" + userId + ", attemptId=" + attemptId + ", requestId="
                    + (request == null ? null : request.requestId()) + ", content=<redacted>]";
        }
    }

    @Transactional
    public BeginDecision begin(Integer userId, Integer attemptId, DictionaryLookupRequest rawRequest) {
        if (rawRequest != null && rawRequest.contractVersion() == 2) {
            DictionaryLookupV2Request v2 = new DictionaryLookupV2Request(rawRequest.requestId(), rawRequest.partId(),
                    rawRequest.documentId(), rawRequest.selectedText(), rawRequest.contextText(), rawRequest.meaningLanguage());
            return beginV2(userId, attemptId, v2);
        }
        DictionaryLookupRequest request = requestValidator.validate(rawRequest);
        return beginValidated(userId, attemptId, request, "en", "vi");
    }

    @Transactional
    public BeginDecision beginV2(Integer userId, Integer attemptId, DictionaryLookupV2Request rawRequest) {
        DictionaryLookupV2Request request = v2RequestValidator.validate(rawRequest, null);
        if (userId == null || userId <= 0 || attemptId == null || attemptId <= 0) throw denied();

        TestAttempt attempt = attemptRepository.findByIdForUpdate(attemptId).orElseThrow(DictionaryLookupTransactionCoordinator::denied);
        verifyAttempt(attempt, userId);
        var languageContext = languageResolver.resolve(attempt.getExamSnapshot(), userId);
        if (languageContext.examLanguage() == null) throw new AppException(ErrorCode.WRITING_HINTS_LANGUAGE_UNSUPPORTED);
        request = v2RequestValidator.validate(request, languageContext.examLanguage());
        String meaningLanguage = request.meaningLanguage() == null
                ? languageContext.defaultExplanationLanguage() : request.meaningLanguage();
        if (meaningLanguage == null) throw new AppException(ErrorCode.WRITING_HINTS_LANGUAGE_UNSUPPORTED);
        DictionaryLookupRequest internal = new DictionaryLookupRequest(request.requestId(), request.partId(),
                request.documentId(), request.selectedText(), request.contextText(), 2, request.meaningLanguage());
        DictionaryLookupContextReader.VerifiedContext verified = contextReader.read(attempt.getExamSnapshot(), internal);
        ensurePartUnlocked(attempt, request.partId());
        return beginValidated(userId, attemptId, internal, languageContext.examLanguage(), meaningLanguage, attempt, verified);
    }

    private BeginDecision beginValidated(Integer userId, Integer attemptId, DictionaryLookupRequest request,
                                         String learningLanguage, String meaningLanguage) {
        TestAttempt attempt = attemptRepository.findByIdForUpdate(attemptId).orElseThrow(DictionaryLookupTransactionCoordinator::denied);
        verifyAttempt(attempt, userId);
        DictionaryLookupContextReader.VerifiedContext verified = contextReader.read(attempt.getExamSnapshot(), request);
        ensurePartUnlocked(attempt, request.partId());
        return beginValidated(userId, attemptId, request, learningLanguage, meaningLanguage, attempt, verified);
    }

    private BeginDecision beginValidated(Integer userId, Integer attemptId, DictionaryLookupRequest request,
                                         String learningLanguage, String meaningLanguage, TestAttempt attempt,
                                         DictionaryLookupContextReader.VerifiedContext verified) {

        // Lock/provision quota before acquiring any ledger lock. A later invalid request never reaches this point.
        quotaService.prepareDailyQuota(userId);
        Instant now = clock.instant();
        String fingerprint = fingerprint(attemptId, request);
        DictionaryLookupRequestRecord existing = requestRepository
                .findByUserIdAndRequestIdForUpdate(userId, request.requestId()).orElse(null);

        if (existing != null) {
            if (!Objects.equals(existing.getRequestFingerprint(), fingerprint)
                    || !Objects.equals(existing.getAttemptId(), attemptId)) {
                throw new AppException(ErrorCode.DICTIONARY_LOOKUP_REQUEST_CONFLICT);
            }
            if (request.contractVersion() == 2 && existing.getContextJson() != null) {
                // A retry with omitted meaningLanguage retains the first reservation's resolved language.
                learningLanguage = string(existing.getContextJson(), "learningLanguage");
                meaningLanguage = string(existing.getContextJson(), "meaningLanguage");
                if (learningLanguage == null || meaningLanguage == null) {
                    throw new AppException(ErrorCode.DICTIONARY_LOOKUP_REQUEST_CONFLICT);
                }
            }
            if (existing.getStatus() == DictionaryLookupRequestRecord.Status.SUCCEEDED) {
                verifyAttempt(attempt, userId);
                if (request.contractVersion() == 2) return new ReplayV2(toV2Response(existing.getResultJson(),
                        existing.getContextJson(), attemptId, request, verified.sourceContext()));
                return new Replay(toResponse(existing.getResultJson(), attemptId, request, verified.sourceContext()));
            }
            if (existing.getStatus() == DictionaryLookupRequestRecord.Status.PENDING
                    && existing.getLeaseUntil() != null && existing.getLeaseUntil().isAfter(now)) {
                throw new AppException(ErrorCode.DICTIONARY_LOOKUP_IN_PROGRESS);
            }
            if (Boolean.TRUE.equals(existing.getQuotaReserved())) {
                quotaService.refund(existing.getQuotaId(), existing.getQuotaResetDate());
                existing.setQuotaReserved(false);
            }
            existing.setStatus(DictionaryLookupRequestRecord.Status.FAILED);
            existing.setFailureCode("LEASE_EXPIRED");
        }

        List<DictionaryLookupRequestRecord> pending = requestRepository.findByUserIdAndStatusForUpdate(
                userId, DictionaryLookupRequestRecord.Status.PENDING);
        for (DictionaryLookupRequestRecord other : pending) {
            if (existing != null && Objects.equals(other.getId(), existing.getId())) continue;
            if (other.getLeaseUntil() != null && other.getLeaseUntil().isAfter(now)) {
                throw new AppException(ErrorCode.DICTIONARY_LOOKUP_IN_PROGRESS);
            }
            recoverRecord(other);
        }

        Optional<DictionaryLookupRequestRecord> lastRequest = requestRepository.findFirstByUserIdOrderByLastStartedAtDesc(userId);
        if (lastRequest.isPresent() && lastRequest.get().getLastStartedAt() != null
                && now.isBefore(lastRequest.get().getLastStartedAt().plus(COOLDOWN))) {
            throw new com.multilingo.backend.modules.testing.exception.DictionaryLookupRetryAfterException(
                    ErrorCode.DICTIONARY_LOOKUP_RATE_LIMITED, COOLDOWN.toSeconds());
        }

        UserQuotaReservationService.QuotaReservation quota = quotaService.reservePrepared(userId);
        Duration providerTimeout = geminiProperties.getRequestTimeout() == null
                ? Duration.ofSeconds(30) : geminiProperties.getRequestTimeout();
        Instant leaseUntil = now.plus(providerTimeout).plus(LEASE_EXTENSION);
        String runId = UUID.randomUUID().toString();
        DictionaryLookupRequestRecord ledger = existing == null
                ? new DictionaryLookupRequestRecord() : existing;
        ledger.setUserId(userId);
        ledger.setAttemptId(attemptId);
        ledger.setPartId(request.partId());
        ledger.setDocumentId(request.documentId());
        ledger.setRequestId(request.requestId());
        ledger.setRequestFingerprint(fingerprint);
        ledger.setStatus(DictionaryLookupRequestRecord.Status.PENDING);
        ledger.setRunId(runId);
        ledger.setLeaseUntil(leaseUntil);
        ledger.setLastStartedAt(now);
        ledger.setQuotaId(quota.quotaId());
        ledger.setQuotaResetDate(quota.resetDate());
        ledger.setQuotaReserved(true);
        ledger.setFailureCode(null);
        ledger.setResultJson(null);
        ledger.setContextJson(request.contractVersion() == 2 ? Map.of("schemaVersion", 2,
                "learningLanguage", learningLanguage, "meaningLanguage", meaningLanguage,
                "requestedMeaningLanguage", request.meaningLanguage() == null ? "" : request.meaningLanguage(),
                "policyVersion", "TV3_LANG_V1") : null);
        DictionaryLookupRequestRecord saved = requestRepository.saveAndFlush(ledger);
        return new Reserved(new Reservation(saved.getId(), runId, userId, attemptId, request,
                verified.sourceContext(), quota.quotaId(), quota.resetDate(), leaseUntil,
                learningLanguage, meaningLanguage));
    }

    /** Returns empty when this execution lost its lease/run fence or the attempt became ineligible. */
    @Transactional
    public Optional<DictionaryLookupResponse> complete(Reservation reservation, DictionaryLookupResponse generated) {
        TestAttempt attempt = attemptRepository.findByIdForUpdate(reservation.attemptId()).orElse(null);
        quotaService.prepareDailyQuota(reservation.userId());
        DictionaryLookupRequestRecord ledger = requestRepository.findByIdForUpdate(reservation.ledgerId()).orElse(null);
        Instant now = clock.instant();
        if (!ownsLiveRun(ledger, reservation, now)) return Optional.empty();
        try {
            verifyAttempt(attempt, reservation.userId());
            DictionaryLookupContextReader.VerifiedContext context = contextReader.read(attempt.getExamSnapshot(), reservation.request());
            ensurePartUnlocked(attempt, reservation.request().partId());
            DictionaryLookupResponse response = new DictionaryLookupResponse(
                    reservation.request().requestId(), reservation.attemptId(), reservation.request().partId(),
                    reservation.request().documentId(), reservation.request().selectedText(), context.sourceContext(),
                    "en", "vi", generated.meaningVi(), generated.phonetic(), generated.partOfSpeech(),
                    generated.exampleEn(), generated.exampleVi());
            ledger.setResultJson(toStoredResult(response));
            ledger.setStatus(DictionaryLookupRequestRecord.Status.SUCCEEDED);
            ledger.setQuotaReserved(false);
            ledger.setFailureCode(null);
            ledger.setLeaseUntil(null);
            requestRepository.save(ledger);
            return Optional.of(response);
        } catch (AppException ineligible) {
            failLedger(ledger, "ATTEMPT_NO_LONGER_ELIGIBLE");
            return Optional.empty();
        }
    }

    @Transactional
    public Optional<DictionaryLookupV2Response> completeV2(Reservation reservation,
            com.multilingo.backend.modules.testing.ai.dictionary.DictionaryLookupV2OutputParser.DictionaryLookupDefinitionV2 generated) {
        TestAttempt attempt = attemptRepository.findByIdForUpdate(reservation.attemptId()).orElse(null);
        quotaService.prepareDailyQuota(reservation.userId());
        DictionaryLookupRequestRecord ledger = requestRepository.findByIdForUpdate(reservation.ledgerId()).orElse(null);
        if (!ownsLiveRun(ledger, reservation, clock.instant())) return Optional.empty();
        try {
            verifyAttempt(attempt, reservation.userId());
            DictionaryLookupContextReader.VerifiedContext context = contextReader.read(attempt.getExamSnapshot(), reservation.request());
            ensurePartUnlocked(attempt, reservation.request().partId());
            var definition = new DictionaryLookupV2Response.DictionaryDefinitionV2(2, reservation.learningLanguage(),
                    reservation.meaningLanguage(), generated.meaning(), generated.phonetic(), generated.partOfSpeech(),
                    generated.example(), generated.exampleTranslation());
            var response = new DictionaryLookupV2Response(reservation.request().requestId(), reservation.attemptId(),
                    reservation.request().partId(), reservation.request().documentId(), reservation.request().selectedText(),
                    context.sourceContext(), definition);
            ledger.setResultJson(toStoredResult(response));
            ledger.setStatus(DictionaryLookupRequestRecord.Status.SUCCEEDED);
            ledger.setQuotaReserved(false); ledger.setFailureCode(null); ledger.setLeaseUntil(null);
            requestRepository.save(ledger);
            return Optional.of(response);
        } catch (AppException ineligible) {
            failLedger(ledger, "ATTEMPT_NO_LONGER_ELIGIBLE");
            return Optional.empty();
        }
    }

    @Transactional
    public boolean fail(Reservation reservation, String safeFailureCode) {
        attemptRepository.findByIdForUpdate(reservation.attemptId());
        quotaService.prepareDailyQuota(reservation.userId());
        DictionaryLookupRequestRecord ledger = requestRepository.findByIdForUpdate(reservation.ledgerId()).orElse(null);
        if (!ownsLiveRun(ledger, reservation, clock.instant())) return false;
        failLedger(ledger, safeFailureCode);
        return true;
    }

    @Transactional
    public int recoverExpiredForUser(Integer userId, Instant now) {
        quotaService.prepareDailyQuota(userId);
        List<DictionaryLookupRequestRecord> expired = requestRepository.findExpiredPendingForUserForUpdate(userId, now);
        int recovered = 0;
        for (DictionaryLookupRequestRecord ledger : expired) {
            recoverRecord(ledger);
            recovered++;
        }
        return recovered;
    }

    @Transactional(readOnly = true)
    public List<Integer> findExpiredUserIds(Instant now) {
        return requestRepository.findDistinctExpiredPendingUserIds(now);
    }

    public static String fingerprint(Integer attemptId, DictionaryLookupRequest request) {
        String canonical = request.contractVersion() == 1
                ? String.join("\u0000", attemptId.toString(), request.partId().toString(), request.documentId(),
                request.selectedText(), request.contextText())
                : String.join("\u0000", "v" + request.contractVersion(), request.meaningLanguage() == null ? "<default>" : request.meaningLanguage(),
                attemptId.toString(), request.partId().toString(), request.documentId(), request.selectedText(), request.contextText());
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private boolean ownsLiveRun(DictionaryLookupRequestRecord ledger, Reservation reservation, Instant now) {
        return ledger != null && ledger.getStatus() == DictionaryLookupRequestRecord.Status.PENDING
                && Objects.equals(ledger.getRunId(), reservation.runId())
                && ledger.getLeaseUntil() != null && ledger.getLeaseUntil().isAfter(now);
    }

    private void verifyAttempt(TestAttempt attempt, Integer userId) {
        if (attempt == null || !Objects.equals(attempt.getUserId(), userId)
                || attempt.getTestMode() != TestMode.PRACTICE) throw denied();
        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) throw new AppException(ErrorCode.ATTEMPT_ALREADY_SUBMITTED);
        if (attempt.getDeadline() != null && !attempt.getDeadline().isAfter(clock.instant())) {
            throw new AppException(ErrorCode.ATTEMPT_EXPIRED);
        }
    }

    private void ensurePartUnlocked(TestAttempt attempt, Integer partId) {
        Object sectionsValue = attempt.getExamSnapshot() == null ? null : attempt.getExamSnapshot().get("sections");
        if (!(sectionsValue instanceof List<?> sections)) throw denied();
        for (Object sectionValue : sections) {
            if (!(sectionValue instanceof Map<?, ?> section) || !(section.get("parts") instanceof List<?> parts)) continue;
            for (Object partValue : parts) {
                if (!(partValue instanceof Map<?, ?> part)) continue;
                if (partId.equals(readId(first(part, "id", "part_id", "partId")))) {
                    Integer sectionId = readId(first(section, "id", "section_id", "sectionId"));
                    if (sectionId == null) throw denied();
                    if (attempt.getLockedSections() != null && attempt.getLockedSections().contains(sectionId)) {
                        throw new AppException(ErrorCode.FORBIDDEN, "Reading section is locked");
                    }
                    return;
                }
            }
        }
        throw denied();
    }

    private static Integer readId(Object value) {
        if (value instanceof Number number) {
            int id = number.intValue();
            return id > 0 && number.doubleValue() == id ? id : null;
        }
        if (value instanceof String string) {
            try { int id = Integer.parseInt(string); return id > 0 ? id : null; }
            catch (NumberFormatException ignored) { return null; }
        }
        return null;
    }

    private static Object first(Map<?, ?> map, String... keys) {
        for (String key : keys) if (map.containsKey(key)) return map.get(key);
        return null;
    }

    private void recoverRecord(DictionaryLookupRequestRecord record) {
        if (Boolean.TRUE.equals(record.getQuotaReserved())) {
            quotaService.refund(record.getQuotaId(), record.getQuotaResetDate());
            record.setQuotaReserved(false);
        }
        record.setStatus(DictionaryLookupRequestRecord.Status.FAILED);
        record.setFailureCode("LEASE_EXPIRED");
        record.setLeaseUntil(null);
        record.setRunId(null);
        requestRepository.save(record);
    }

    private void failLedger(DictionaryLookupRequestRecord ledger, String safeFailureCode) {
        if (Boolean.TRUE.equals(ledger.getQuotaReserved())) {
            quotaService.refund(ledger.getQuotaId(), ledger.getQuotaResetDate());
            ledger.setQuotaReserved(false);
        }
        ledger.setStatus(DictionaryLookupRequestRecord.Status.FAILED);
        ledger.setFailureCode(safeFailureCode == null ? "PROVIDER_FAILURE" : safeFailureCode);
        ledger.setRunId(null);
        ledger.setLeaseUntil(null);
        requestRepository.save(ledger);
    }

    private Map<String, Object> toStoredResult(DictionaryLookupResponse response) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("meaningVi", response.meaningVi());
        result.put("phonetic", response.phonetic());
        result.put("partOfSpeech", response.partOfSpeech());
        result.put("exampleEn", response.exampleEn());
        result.put("exampleVi", response.exampleVi());
        return result;
    }

    private Map<String, Object> toStoredResult(DictionaryLookupV2Response response) {
        var definition = response.definition();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("meaning", definition.meaning()); result.put("phonetic", definition.phonetic());
        result.put("partOfSpeech", definition.partOfSpeech()); result.put("example", definition.example());
        result.put("exampleTranslation", definition.exampleTranslation());
        return result;
    }

    private DictionaryLookupV2Response toV2Response(Map<String, Object> stored, Map<String, Object> context,
            Integer attemptId, DictionaryLookupRequest request, String sourceContext) {
        if (stored == null || context == null) throw new AppException(ErrorCode.CONFLICT, "Dictionary result is unavailable");
        String learning = string(context, "learningLanguage");
        String meaning = string(context, "meaningLanguage");
        var definition = new DictionaryLookupV2Response.DictionaryDefinitionV2(2, learning, meaning,
                string(stored, "meaning"), string(stored, "phonetic"), string(stored, "partOfSpeech"),
                string(stored, "example"), string(stored, "exampleTranslation"));
        return new DictionaryLookupV2Response(request.requestId(), attemptId, request.partId(), request.documentId(),
                request.selectedText(), sourceContext, definition);
    }

    private DictionaryLookupResponse toResponse(Map<String, Object> stored, Integer attemptId,
                                                DictionaryLookupRequest request, String sourceContext) {
        if (stored == null) throw new AppException(ErrorCode.CONFLICT, "Dictionary result is unavailable");
        return new DictionaryLookupResponse(request.requestId(), attemptId, request.partId(), request.documentId(),
                request.selectedText(), sourceContext, "en", "vi", string(stored, "meaningVi"),
                string(stored, "phonetic"), string(stored, "partOfSpeech"), string(stored, "exampleEn"), string(stored, "exampleVi"));
    }

    private String string(Map<String, Object> map, String key) {
        Object value = map.get(key);
        return value == null ? null : value instanceof String string ? string : null;
    }

    private static AppException denied() {
        return new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Dictionary lookup resource is unavailable");
    }
}
