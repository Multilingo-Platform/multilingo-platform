package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.core.type.TypeReference;
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
import com.multilingo.backend.modules.testing.util.AttemptResultScope;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * Điều phối giao dịch cho Writing Hints:
 * Quản lý 3 pha (begin ngắn, Gemini ngoài transaction, complete/fail ngắn).
 * Bảo đảm tính lũy kế (idempotency), thu hồi quota và rào chắn thời hạn/phiên chạy (fencing).
 */
@Component
@RequiredArgsConstructor
public class WritingHintTransactionCoordinator {

    private final TestAttemptRepository attemptRepository;
    private final WritingHintRequestRepository requestRepository;
    private final WritingHintQuotaAdapter quotaAdapter;
    private final WritingHintContextReader contextReader;
    private final WritingHintLanguageResolver languageResolver;
    private final WritingHintsProperties writingHintsProperties;
    private final GeminiProperties geminiProperties;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public sealed interface BeginDecision {
        record Replay(WritingHintsResponse response) implements BeginDecision {}
        record Reserved(Reservation reservation) implements BeginDecision {}
        record Denied(ErrorCode errorCode, String message, Long retryAfterSeconds) implements BeginDecision {}

        static Replay replay(WritingHintsResponse response) {
            return new Replay(response);
        }

        static Reserved reserved(Reservation reservation) {
            return new Reserved(reservation);
        }

        static Denied denied(ErrorCode errorCode, String message, Long retryAfterSeconds) {
            return new Denied(errorCode, message, retryAfterSeconds);
        }

        static Denied denied(ErrorCode errorCode, String message) {
            return new Denied(errorCode, message, null);
        }
    }

    public record Reservation(
            Integer operationId,
            String runId,
            Integer userId,
            Integer attemptId,
            Integer partId,
            String questionId,
            String requestId,
            WritingHintLanguageResolver.ResolvedLanguages languages,
            WritingHintContextReader.HintContext hintContext,
            Instant leaseUntil,
            Integer quotaId,
            Instant quotaResetDate
    ) {}

    public sealed interface TerminalDecision {
        record Success(WritingHintsResponse response) implements TerminalDecision {}
        record Failure(ErrorCode errorCode, String message) implements TerminalDecision {}

        static Success success(WritingHintsResponse response) {
            return new Success(response);
        }

        static Failure failure(ErrorCode errorCode, String message) {
            return new Failure(errorCode, message);
        }
    }

    /**
     * Pha 1: Giao dịch ngắn thực hiện kiểm tra quyền, trạng thái attempt,
     * thu hồi lease quá hạn, replay cache, cooldown và đặt trước quota.
     */
    @Transactional
    public BeginDecision begin(Integer userId, Integer attemptId, WritingHintsRequest request) {
        if (!writingHintsProperties.isEnabled()) {
            throw new AppException(ErrorCode.WRITING_HINTS_UNAVAILABLE, "Dịch vụ gợi ý viết hiện đang tắt");
        }

        if (userId == null) {
            throw new AppException(ErrorCode.FORBIDDEN, "Yêu cầu cần xác thực");
        }
        if (attemptId == null || request == null || request.partId() == null || request.questionId() == null || request.requestId() == null) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "Thiếu thông tin yêu cầu gợi ý viết");
        }

        // 1. Kiểm tra attempt và khóa dòng attempt (Lock order: 1. Attempt)
        TestAttempt attempt = attemptRepository.findByIdForUpdate(attemptId)
                .orElseThrow(() -> new AppException(ErrorCode.FORBIDDEN, "Không tìm thấy bài thi hoặc không có quyền"));

        if (!Objects.equals(attempt.getUserId(), userId) || attempt.getTestMode() != TestMode.PRACTICE) {
            throw new AppException(ErrorCode.FORBIDDEN, "Chỉ hỗ trợ gợi ý viết cho bài làm PRACTICE của chính người dùng");
        }

        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            throw new AppException(ErrorCode.ATTEMPT_ALREADY_SUBMITTED, "Bài thi đã nộp hoặc không còn trong tiến trình");
        }

        Instant now = clock.instant();
        if (attempt.getDeadline() != null && !attempt.getDeadline().isAfter(now)) {
            throw new AppException(ErrorCode.ATTEMPT_EXPIRED, "Bài thi đã hết thời gian làm bài");
        }

        // 2. Kiểm tra part/question existence và skill WRITING trong snapshot scope (P1-05, P1-07)
        List<AttemptResultScope.ScopedPart> scopedParts;
        try {
            scopedParts = AttemptResultScope.read(attempt.getExamSnapshot());
        } catch (AppException e) {
            throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Không tìm thấy cấu trúc bài thi hợp lệ trong snapshot");
        }

        AttemptResultScope.ScopedPart targetPart = scopedParts.stream()
                .filter(sp -> Objects.equals(sp.getPartId(), request.partId()))
                .findFirst()
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Part không tồn tại trong snapshot bài thi"));

        AttemptResultScope.ScopedQuestion targetQuestion = targetPart.getQuestions().stream()
                .filter(sq -> Objects.equals(sq.getQuestionId(), request.questionId()))
                .findFirst()
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Question không tồn tại trong part bài thi"));

        if (!"WRITING".equalsIgnoreCase(targetPart.getSkill())) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "Gợi ý viết chỉ áp dụng cho section có kỹ năng WRITING");
        }

        String qType = targetQuestion.getType();
        if (!"ESSAY".equalsIgnoreCase(qType) && !AttemptResultScope.WRITING_TYPES.contains(qType)) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "Gợi ý viết chỉ áp dụng cho câu hỏi dạng ESSAY");
        }

        // Kiểm tra khóa section
        Integer sectionId = findSectionIdForPart(attempt.getExamSnapshot(), request.partId());
        if (sectionId == null) {
            throw new AppException(ErrorCode.CONFLICT, "Không xác định được trạng thái khóa của section chứa part");
        }
        if (attempt.getLockedSections() != null && attempt.getLockedSections().contains(sectionId)) {
            throw new AppException(ErrorCode.CONFLICT, "Section đang làm đã bị khóa");
        }

        // 3. Khóa tài khoản Quota của người dùng (Lock order: 2. Quota)
        quotaAdapter.lockAccount(userId);

        // Lấy lại thời gian sau khi khóa quota để đảm bảo time-dependent admission chính xác (P1-01)
        now = clock.instant();

        // 4. Thu hồi lease quá hạn cho user (Lock order: 3. Ledger rows theo ID ASC)
        lazyRecoverExpiredPending(userId, now);

        if (attempt.getDeadline() != null && !attempt.getDeadline().isAfter(now)) {
            return BeginDecision.denied(ErrorCode.ATTEMPT_EXPIRED, "Bài thi đã hết thời gian làm bài");
        }

        // 5. Kiểm tra request đã tồn tại với (userId, requestId)
        Optional<WritingHintRequest> existingOpt = requestRepository.findByUserIdAndRequestIdForUpdate(userId, request.requestId());
        WritingHintLanguageResolver.ResolvedLanguages languages = null;

        String reqFingerprint = computeFingerprint(
                attemptId, request.partId(), request.questionId(), request.learningLanguage(), request.hintLanguage()
        );

        if (existingOpt.isPresent()) {
            WritingHintRequest existing = existingOpt.get();
            Map<String, Object> ctx = existing.getContextJson();

            // Kiểm tra tính nhất quán của request intent (P1-03)
            boolean intentMatches = Objects.equals(existing.getAttemptId(), attemptId)
                    && Objects.equals(existing.getPartId(), request.partId())
                    && Objects.equals(existing.getQuestionId(), request.questionId());

            if (ctx != null && (ctx.containsKey("requestedLearningLanguage") || ctx.containsKey("requestedHintLanguage"))) {
                String storedReqLearning = ctx.get("requestedLearningLanguage") != null ? ctx.get("requestedLearningLanguage").toString() : "";
                String storedReqHint = ctx.get("requestedHintLanguage") != null ? ctx.get("requestedHintLanguage").toString() : "";
                String currentReqLearning = request.learningLanguage() != null ? request.learningLanguage() : "";
                String currentReqHint = request.hintLanguage() != null ? request.hintLanguage() : "";
                if (!storedReqLearning.equals(currentReqLearning) || !storedReqHint.equals(currentReqHint)) {
                    intentMatches = false;
                }
            }

            // Nếu fingerprint hoặc intent không khớp -> conflict (P1-01: trả về Denied để lazy recovery commit)
            if (!intentMatches || !Objects.equals(existing.getRequestFingerprint(), reqFingerprint)) {
                return BeginDecision.denied(ErrorCode.WRITING_HINTS_REQUEST_CONFLICT, "Request ID bị xung đột dữ liệu với yêu cầu trước");
            }

            // Nếu đã SUCCEEDED -> Replay kết quả với exact generatedAt và frozen languages (P1-03, P2-01)
            if (existing.getStatus() == WritingHintRequest.Status.SUCCEEDED) {
                WritingHintsResponse.Content content = deserializeContent(existing.getResultJson());
                Instant generatedAt = extractGeneratedAt(existing);
                String learningLang = ctx != null ? (String) ctx.get("learningLanguage") : "en";
                String hintLang = ctx != null ? (String) ctx.get("hintLanguage") : "en";

                WritingHintsResponse response = WritingHintsResponse.of(
                        existing.getAttemptId(),
                        existing.getPartId(),
                        existing.getQuestionId(),
                        existing.getRequestId(),
                        learningLang,
                        hintLang,
                        generatedAt,
                        content
                );
                return BeginDecision.replay(response);
            }

            // Nếu đang PENDING và lease còn hiệu lực
            if (existing.getStatus() == WritingHintRequest.Status.PENDING) {
                if (existing.getLeaseUntil() != null && existing.getLeaseUntil().isAfter(now)) {
                    long retryAfter = Duration.between(now, existing.getLeaseUntil()).toSeconds();
                    if (retryAfter < 1) retryAfter = 1;
                    return BeginDecision.denied(ErrorCode.WRITING_HINTS_IN_PROGRESS, "Yêu cầu gợi ý viết đang được xử lý", retryAfter);
                }
                // Lease đã hết hạn: hoàn quota cũ nếu còn giữ
                if (Boolean.TRUE.equals(existing.getQuotaReserved())) {
                    quotaAdapter.refund(existing.getQuotaId(), existing.getQuotaResetDate());
                    existing.setQuotaReserved(false);
                }
            }

            // Nếu FAILED -> Retry dùng ngôn ngữ đã đóng băng trong frozen context (P1-03)
            if (existing.getStatus() == WritingHintRequest.Status.FAILED && ctx != null) {
                String frozenLearning = (String) ctx.get("learningLanguage");
                String frozenHint = (String) ctx.get("hintLanguage");
                if (frozenLearning != null && frozenHint != null) {
                    languages = new WritingHintLanguageResolver.ResolvedLanguages(frozenLearning, frozenHint);
                }
            }
        }

        // 6. Kiểm tra user có request PENDING nào khác đang chạy không
        Optional<WritingHintRequest> activePending = requestRepository.findByUserIdAndStatusForUpdate(userId, WritingHintRequest.Status.PENDING);
        if (activePending.isPresent() && !Objects.equals(activePending.get().getRequestId(), request.requestId())) {
            WritingHintRequest pend = activePending.get();
            if (pend.getLeaseUntil() != null && pend.getLeaseUntil().isAfter(now)) {
                long retryAfter = Duration.between(now, pend.getLeaseUntil()).toSeconds();
                if (retryAfter < 1) retryAfter = 1;
                return BeginDecision.denied(ErrorCode.WRITING_HINTS_IN_PROGRESS, "Người dùng đã có một yêu cầu gợi ý viết đang chạy", retryAfter);
            }
        }

        // 7. Kiểm tra cooldown (mặc định 10s)
        Optional<WritingHintRequest> lastReq = requestRepository.findFirstByUserIdOrderByLastStartedAtDesc(userId);
        if (lastReq.isPresent() && lastReq.get().getLastStartedAt() != null) {
            Duration minInterval = writingHintsProperties.getMinInterval() != null
                    ? writingHintsProperties.getMinInterval()
                    : Duration.ofSeconds(10);
            Instant cooldownUntil = lastReq.get().getLastStartedAt().plus(minInterval);
            if (now.isBefore(cooldownUntil)) {
                long retryAfter = Duration.between(now, cooldownUntil).toSeconds();
                if (retryAfter < 1) retryAfter = 1;
                return BeginDecision.denied(ErrorCode.WRITING_HINTS_RATE_LIMITED, "Bạn đang gửi yêu cầu quá nhanh, vui lòng thử lại sau", retryAfter);
            }
        }

        // 8. Phân giải ngôn ngữ nếu chưa có từ frozen context (P1-01: chuyển AppException thành Denied để lazy recovery commit)
        if (languages == null) {
            try {
                languages = languageResolver.resolve(
                        userId, request.learningLanguage(), request.hintLanguage()
                );
            } catch (AppException e) {
                return BeginDecision.denied(e.getErrorCode(), e.getMessage());
            }
        }

        // Đọc ngữ cảnh câu hỏi trong snapshot bất biến (P1-01: chuyển AppException thành Denied để lazy recovery commit)
        WritingHintContextReader.HintContext hintContext;
        try {
            hintContext = contextReader.read(attempt, request.partId(), request.questionId());
        } catch (AppException e) {
            return BeginDecision.denied(e.getErrorCode(), e.getMessage());
        }

        // 9. Đặt trước quota nguyên tử (P1-01: tryReserve không ném để tránh rollback recovery)
        Optional<WritingHintQuotaAdapter.QuotaReservation> quotaResOpt = quotaAdapter.tryReserve(userId);
        if (quotaResOpt.isEmpty()) {
            return BeginDecision.denied(ErrorCode.QUOTA_EXCEEDED, "Hạn mức sử dụng tính năng gợi ý viết đã hết");
        }
        WritingHintQuotaAdapter.QuotaReservation quotaRes = quotaResOpt.get();

        // 10. Tạo mới hoặc cập nhật ledger dòng PENDING
        Duration leaseExtension = writingHintsProperties.getLeaseExtension() != null
                ? writingHintsProperties.getLeaseExtension()
                : Duration.ofSeconds(15);
        Duration requestTimeout = geminiProperties.getRequestTimeout() != null
                ? geminiProperties.getRequestTimeout()
                : Duration.ofSeconds(30);
        Instant leaseUntil = now.plus(requestTimeout).plus(leaseExtension);
        String runId = UUID.randomUUID().toString();

        WritingHintRequest ledger = existingOpt.orElseGet(() -> WritingHintRequest.builder()
                .userId(userId)
                .attemptId(attemptId)
                .partId(request.partId())
                .questionId(request.questionId())
                .requestId(request.requestId())
                .build());

        ledger.setRequestFingerprint(reqFingerprint);
        ledger.setContextJson(Map.of(
                "requestedLearningLanguage", request.learningLanguage() != null ? request.learningLanguage() : "",
                "requestedHintLanguage", request.hintLanguage() != null ? request.hintLanguage() : "",
                "learningLanguage", languages.learningLanguage(),
                "hintLanguage", languages.hintLanguage(),
                "promptVersion", "writing-hints-v1"
        ));
        ledger.setStatus(WritingHintRequest.Status.PENDING);
        ledger.setRunId(runId);
        ledger.setLeaseUntil(leaseUntil);
        ledger.setLastStartedAt(now);
        ledger.setQuotaId(quotaRes.quotaId());
        ledger.setQuotaResetDate(quotaRes.resetDate());
        ledger.setQuotaReserved(true);
        ledger.setFailureCode(null);

        WritingHintRequest savedLedger = requestRepository.save(ledger);

        Reservation reservation = new Reservation(
                savedLedger.getId(),
                runId,
                userId,
                attemptId,
                request.partId(),
                request.questionId(),
                request.requestId(),
                languages,
                hintContext,
                leaseUntil,
                quotaRes.quotaId(),
                quotaRes.resetDate()
        );

        return BeginDecision.reserved(reservation);
    }

    /**
     * Pha 3 (Thành công): Giao dịch ngắn recheck attempt guards,
     * kiểm tra run/lease fencing, lưu kết quả resultJson và cập nhật SUCCEEDED.
     */
    @Transactional
    public TerminalDecision complete(Reservation reservation, WritingHintsResponse.Content content) {
        // 1. Re-lock attempt (Lock order: 1. Attempt)
        TestAttempt attempt = attemptRepository.findByIdForUpdate(reservation.attemptId()).orElse(null);

        // 2. Lock quota row for user (Lock order: 2. Quota)
        quotaAdapter.lockAccount(reservation.userId());

        // 3. Re-lock ledger (Lock order: 3. Ledger)
        WritingHintRequest ledger = requestRepository.findByIdForUpdate(reservation.operationId())
                .orElse(null);

        // Lấy lại thời gian sau khi đã giữ toàn bộ row locks để đảm bảo time-dependent guards chính xác (P1-01)
        Instant now = clock.instant();

        // 4. Run fencing & PENDING check (P1-02): không hoàn quota hoặc ghi đè nếu run đã bị thay thế hoặc kết thúc
        if (ledger == null || !Objects.equals(ledger.getRunId(), reservation.runId())
                || ledger.getStatus() != WritingHintRequest.Status.PENDING) {
            return TerminalDecision.failure(ErrorCode.WRITING_HINTS_TIMEOUT, "Phiên xử lý đã bị thay thế bởi phiên chạy mới hơn");
        }

        // 5. Kiểm tra lease expiration (P1-02, P1-01 re-review Round 2: equality boundary & fresh now sau lock wait)
        if (ledger.getLeaseUntil() != null && !now.isBefore(ledger.getLeaseUntil())) {
            if (Boolean.TRUE.equals(ledger.getQuotaReserved())) {
                quotaAdapter.refund(ledger.getQuotaId(), ledger.getQuotaResetDate());
                ledger.setQuotaReserved(false);
            }
            ledger.setStatus(WritingHintRequest.Status.FAILED);
            ledger.setFailureCode("LEASE_EXPIRED");
            requestRepository.save(ledger);
            return TerminalDecision.failure(ErrorCode.WRITING_HINTS_TIMEOUT, "Thời hạn xử lý gợi ý viết đã quá hạn");
        }

        // 6. Recheck full access guards on attempt (P1-06)
        if (attempt == null || !Objects.equals(attempt.getUserId(), reservation.userId())
                || attempt.getTestMode() != TestMode.PRACTICE) {
            if (Boolean.TRUE.equals(ledger.getQuotaReserved())) {
                quotaAdapter.refund(ledger.getQuotaId(), ledger.getQuotaResetDate());
                ledger.setQuotaReserved(false);
            }
            ledger.setStatus(WritingHintRequest.Status.FAILED);
            ledger.setFailureCode("ACCESS_GUARD_FAILED");
            requestRepository.save(ledger);
            return TerminalDecision.failure(ErrorCode.FORBIDDEN, "Không có quyền truy cập bài thi");
        }

        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            if (Boolean.TRUE.equals(ledger.getQuotaReserved())) {
                quotaAdapter.refund(ledger.getQuotaId(), ledger.getQuotaResetDate());
                ledger.setQuotaReserved(false);
            }
            ledger.setStatus(WritingHintRequest.Status.FAILED);
            ledger.setFailureCode("ATTEMPT_ALREADY_SUBMITTED");
            requestRepository.save(ledger);
            return TerminalDecision.failure(ErrorCode.ATTEMPT_ALREADY_SUBMITTED, "Bài thi đã kết thúc trong lúc tạo gợi ý");
        }

        if (attempt.getDeadline() != null && !attempt.getDeadline().isAfter(now)) {
            if (Boolean.TRUE.equals(ledger.getQuotaReserved())) {
                quotaAdapter.refund(ledger.getQuotaId(), ledger.getQuotaResetDate());
                ledger.setQuotaReserved(false);
            }
            ledger.setStatus(WritingHintRequest.Status.FAILED);
            ledger.setFailureCode("ATTEMPT_EXPIRED");
            requestRepository.save(ledger);
            return TerminalDecision.failure(ErrorCode.ATTEMPT_EXPIRED, "Bài thi đã hết thời gian làm bài");
        }

        Integer sectionId = findSectionIdForPart(attempt.getExamSnapshot(), reservation.partId());
        if (sectionId == null || (attempt.getLockedSections() != null && attempt.getLockedSections().contains(sectionId))) {
            if (Boolean.TRUE.equals(ledger.getQuotaReserved())) {
                quotaAdapter.refund(ledger.getQuotaId(), ledger.getQuotaResetDate());
                ledger.setQuotaReserved(false);
            }
            ledger.setStatus(WritingHintRequest.Status.FAILED);
            ledger.setFailureCode("SECTION_LOCKED");
            requestRepository.save(ledger);
            return TerminalDecision.failure(ErrorCode.CONFLICT, "Section đang làm đã bị khóa hoặc không xác định");
        }

        // 7. Chuyển đổi và lưu trữ kết quả thành công kèm generatedAt để replay chính xác (P2-01)
        Map<String, Object> resultMap = new HashMap<>(objectMapper.convertValue(content, new TypeReference<Map<String, Object>>() {}));
        resultMap.put("generatedAt", now.toString());
        ledger.setResultJson(resultMap);
        ledger.setStatus(WritingHintRequest.Status.SUCCEEDED);
        ledger.setQuotaReserved(false);
        ledger.setFailureCode(null);
        requestRepository.save(ledger);

        WritingHintsResponse response = WritingHintsResponse.of(
                reservation.attemptId(),
                reservation.partId(),
                reservation.questionId(),
                reservation.requestId(),
                reservation.languages().learningLanguage(),
                reservation.languages().hintLanguage(),
                now,
                content
        );

        return TerminalDecision.success(response);
    }

    /**
     * Pha 3 (Thất bại): Giao dịch ngắn hoàn trả quota (nếu còn giữ) và ghi nhận FAILED.
     */
    @Transactional
    public TerminalDecision fail(Reservation reservation, ErrorCode failure, String message) {
        // Khóa quota row trước (Lock order: 2. Quota)
        quotaAdapter.lockAccount(reservation.userId());

        // Khóa ledger row (Lock order: 3. Ledger)
        Optional<WritingHintRequest> ledgerOpt = requestRepository.findByIdForUpdate(reservation.operationId());
        if (ledgerOpt.isPresent()) {
            WritingHintRequest ledger = ledgerOpt.get();
            // Run fencing & PENDING check (P1-02)
            if (Objects.equals(ledger.getRunId(), reservation.runId())
                    && ledger.getStatus() == WritingHintRequest.Status.PENDING) {
                if (Boolean.TRUE.equals(ledger.getQuotaReserved())) {
                    quotaAdapter.refund(ledger.getQuotaId(), ledger.getQuotaResetDate());
                    ledger.setQuotaReserved(false);
                }
                ledger.setStatus(WritingHintRequest.Status.FAILED);
                ledger.setFailureCode(failure != null ? failure.name() : "FAILED");
                requestRepository.save(ledger);
            }
        }
        return TerminalDecision.failure(failure != null ? failure : ErrorCode.WRITING_HINTS_UNAVAILABLE, message);
    }

    @Transactional
    public TerminalDecision fail(Reservation reservation, ErrorCode failure) {
        return fail(reservation, failure, failure != null ? failure.getMessage() : "Yêu cầu thất bại");
    }

    private void lazyRecoverExpiredPending(Integer userId, Instant now) {
        List<WritingHintRequest> expiredList = requestRepository.findExpiredPendingRequestsByUserIdOrderByIdAsc(userId, now);
        for (WritingHintRequest exp : expiredList) {
            if (Boolean.TRUE.equals(exp.getQuotaReserved())) {
                quotaAdapter.refund(exp.getQuotaId(), exp.getQuotaResetDate());
                exp.setQuotaReserved(false);
            }
            exp.setStatus(WritingHintRequest.Status.FAILED);
            exp.setFailureCode("LEASE_EXPIRED");
            requestRepository.save(exp);
        }
    }

    private Integer findSectionIdForPart(Map<String, Object> snapshot, Integer partId) {
        if (snapshot == null) return null;
        Object sectionsObj = snapshot.get("sections");
        if (!(sectionsObj instanceof List<?> sectionList)) {
            return null;
        }
        for (Object sObj : sectionList) {
            if (!(sObj instanceof Map<?, ?> sectionMap)) {
                continue;
            }
            Object partsObj = sectionMap.get("parts");
            if (!(partsObj instanceof List<?> partList)) {
                continue;
            }
            for (Object pObj : partList) {
                if (!(pObj instanceof Map<?, ?> partMap)) {
                    continue;
                }
                Integer pid = resolveId(partMap.get("id"), partMap.get("part_id"), partMap.get("partId"));
                if (Objects.equals(pid, partId)) {
                    return resolveId(sectionMap.get("id"), sectionMap.get("section_id"), sectionMap.get("sectionId"));
                }
            }
        }
        return null;
    }

    private Integer resolveId(Object... candidates) {
        for (Object cand : candidates) {
            if (cand == null) continue;
            if (cand instanceof Number n) {
                int val = n.intValue();
                if (val > 0) return val;
            }
            try {
                int val = Integer.parseInt(cand.toString().trim());
                if (val > 0) return val;
            } catch (NumberFormatException ignored) {}
        }
        return null;
    }

    private WritingHintsResponse.Content deserializeContent(Map<String, Object> resultJson) {
        if (resultJson == null || resultJson.isEmpty()) {
            return new WritingHintsResponse.Content(List.of(), List.of(), List.of());
        }
        return objectMapper.convertValue(resultJson, WritingHintsResponse.Content.class);
    }

    private Instant extractGeneratedAt(WritingHintRequest request) {
        if (request.getResultJson() != null && request.getResultJson().get("generatedAt") != null) {
            try {
                return Instant.parse(request.getResultJson().get("generatedAt").toString());
            } catch (Exception ignored) {}
        }
        return request.getUpdatedAt() != null ? request.getUpdatedAt() : request.getCreatedAt();
    }

    public static String computeFingerprint(
            Integer attemptId,
            Integer partId,
            String questionId,
            String learningLanguage,
            String hintLanguage
    ) {
        String langPart = (learningLanguage != null ? learningLanguage : "") + ":" + (hintLanguage != null ? hintLanguage : "");
        String raw = attemptId + ":" + partId + ":" + questionId + ":" + langPart;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not supported", e);
        }
    }
}
