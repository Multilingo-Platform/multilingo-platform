package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.adapter.WritingGradingQuotaAdapter;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiProperties;
import com.multilingo.backend.modules.testing.ai.grading.WritingGrade;
import com.multilingo.backend.modules.testing.ai.grading.WritingGradingContext;
import com.multilingo.backend.modules.testing.ai.grading.WritingGradingFailure;
import com.multilingo.backend.modules.testing.config.WritingGradingProperties;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.WritingGradingJob;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.WritingGradingJobStatus;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.repository.WritingGradingJobRepository;
import com.multilingo.backend.modules.testing.ai.media.ImageFetchProperties;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WritingGradingTransactionCoordinatorTest {

    @Mock
    private WritingGradingJobRepository jobRepository;

    @Mock
    private TestAttemptRepository testAttemptRepository;

    @Mock
    private AttemptAnswerRepository attemptAnswerRepository;

    @Mock
    private WritingGradingQuotaAdapter quotaAdapter;

    @Mock
    private WritingGradingAttemptStateResolver stateResolver;

    @Mock
    private EntityManager entityManager;

    private WritingGradingProperties properties;
    private GeminiProperties geminiProperties;
    private ImageFetchProperties imageFetchProperties;
    private ObjectMapper objectMapper;
    private Clock clock;
    private Instant now;

    private WritingGradingTransactionCoordinator coordinator;

    @BeforeEach
    void setUp() {
        now = Instant.parse("2026-10-14T20:00:00Z");
        clock = Clock.fixed(now, ZoneId.of("UTC"));

        properties = new WritingGradingProperties();
        properties.setEnabled(true);
        properties.setLeaseExtension(Duration.ofSeconds(15));
        properties.setQuotaRecheckInterval(Duration.ofSeconds(60));

        geminiProperties = new GeminiProperties();
        geminiProperties.setEnabled(true);
        geminiProperties.setRequestTimeout(Duration.ofSeconds(30));

        imageFetchProperties = new ImageFetchProperties();
        imageFetchProperties.setRequestTimeout("10s");

        objectMapper = new ObjectMapper();

        coordinator = new WritingGradingTransactionCoordinator(
                jobRepository,
                testAttemptRepository,
                attemptAnswerRepository,
                quotaAdapter,
                stateResolver,
                properties,
                geminiProperties,
                imageFetchProperties,
                entityManager,
                objectMapper,
                clock
        );
    }

    private WritingGradingJob createTestJob(Integer id, Integer attemptId, WritingGradingJobStatus status) {
        Map<String, Object> contextJson = new LinkedHashMap<>();
        contextJson.put("partId", 101);
        contextJson.put("questionId", "q-1");
        contextJson.put("taskPrompt", "Write an essay about technology.");
        contextJson.put("originalText", "Technology is developing very fast in modern life today.");
        contextJson.put("learningLanguage", "en");
        contextJson.put("wordCount", 9);

        WritingGradingJob job = WritingGradingJob.builder()
                .attemptId(attemptId)
                .partId(101)
                .questionId("q-1")
                .contextJson(contextJson)
                .inputHash("test-hash-123")
                .status(status)
                .attemptCount(0)
                .quotaReserved(false)
                .build();
        job.setId(id);
        return job;
    }

    private TestAttempt createTestAttempt(Integer id, Integer userId, AttemptStatus status) {
        TestAttempt attempt = TestAttempt.builder()
                .userId(userId)
                .examId(1)
                .status(status)
                .build();
        attempt.setId(id);
        return attempt;
    }

    @Test
    @DisplayName("claim: Từ chối nếu job đang RUNNING với lease còn hạn")
    void claim_whenJobAlreadyRunningWithValidLease_returnsRejected() {
        WritingGradingJob job = createTestJob(1, 10, WritingGradingJobStatus.RUNNING);
        job.setRunId("existing-run-id");
        job.setLeaseUntil(now.plusSeconds(30));

        TestAttempt attempt = createTestAttempt(10, 42, AttemptStatus.AI_GRADING);

        when(jobRepository.findAttemptIdById(1)).thenReturn(Optional.of(10));
        when(testAttemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));
        when(jobRepository.findByIdForUpdate(1)).thenReturn(Optional.of(job));

        ClaimDecision decision = coordinator.claim(1);

        assertThat(decision).isInstanceOf(ClaimDecision.Rejected.class);
        ClaimDecision.Rejected rejected = (ClaimDecision.Rejected) decision;
        assertThat(rejected.reason()).contains("ALREADY_RUNNING");
        verify(quotaAdapter, never()).tryReserve(any());
        verify(jobRepository, never()).save(any());
    }

    @Test
    @DisplayName("claim: Nhận job READY và còn quota -> reserve quota, tăng attemptCount=1, status=RUNNING, trả Claim")
    void claim_whenReadyJobAndQuotaAvailable_reservesQuotaSetsRunningAndReturnsGrantedClaim() {
        WritingGradingJob job = createTestJob(1, 10, WritingGradingJobStatus.READY);
        TestAttempt attempt = createTestAttempt(10, 42, AttemptStatus.AI_GRADING);

        when(jobRepository.findAttemptIdById(1)).thenReturn(Optional.of(10));
        when(testAttemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));
        when(jobRepository.findByIdForUpdate(1)).thenReturn(Optional.of(job));
        when(jobRepository.save(any(WritingGradingJob.class))).thenAnswer(inv -> inv.getArgument(0));

        Instant resetDate = now.plusSeconds(86400);
        when(quotaAdapter.tryReserve(42)).thenReturn(Optional.of(new WritingGradingQuotaAdapter.QuotaReservation(99, resetDate)));
        when(stateResolver.resolve(any(), any())).thenReturn(AttemptStatus.AI_GRADING);

        ClaimDecision decision = coordinator.claim(1);

        assertThat(decision).isInstanceOf(ClaimDecision.Granted.class);
        Claim claim = ((ClaimDecision.Granted) decision).claim();
        assertThat(claim.jobId()).isEqualTo(1);
        assertThat(claim.attemptId()).isEqualTo(10);
        assertThat(claim.attemptCount()).isEqualTo(1);
        assertThat(claim.runId()).isNotBlank();
        assertThat(claim.leaseUntil()).isEqualTo(now.plusSeconds(45)); // 30s timeout + 15s lease extension
        assertThat(claim.context().learningLanguage()).isEqualTo("en");

        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.RUNNING);
        assertThat(job.getQuotaReserved()).isTrue();
        assertThat(job.getQuotaId()).isEqualTo(99);
        assertThat(job.getQuotaResetDate()).isEqualTo(resetDate);
        verify(quotaAdapter).lockAccount(42);
        verify(quotaAdapter).tryReserve(42);
    }

    @Test
    @DisplayName("claim: Nhận job RETRY_WAIT -> không reserve quota lại, tăng attemptCount 1->2, cấp runId mới")
    void claim_whenRetryWaitJob_doesNotReserveQuotaAgainAndIncrementsAttemptCount() {
        WritingGradingJob job = createTestJob(1, 10, WritingGradingJobStatus.RETRY_WAIT);
        job.setAttemptCount(1);
        job.setQuotaReserved(true);
        job.setQuotaId(99);
        job.setQuotaResetDate(now.plusSeconds(86400));
        job.setNextAttemptAt(now.minusSeconds(1));

        TestAttempt attempt = createTestAttempt(10, 42, AttemptStatus.AI_GRADING);

        when(jobRepository.findAttemptIdById(1)).thenReturn(Optional.of(10));
        when(testAttemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));
        when(jobRepository.findByIdForUpdate(1)).thenReturn(Optional.of(job));
        when(jobRepository.save(any(WritingGradingJob.class))).thenAnswer(inv -> inv.getArgument(0));
        when(stateResolver.resolve(any(), any())).thenReturn(AttemptStatus.AI_GRADING);

        ClaimDecision decision = coordinator.claim(1);

        assertThat(decision).isInstanceOf(ClaimDecision.Granted.class);
        Claim claim = ((ClaimDecision.Granted) decision).claim();
        assertThat(claim.attemptCount()).isEqualTo(2);
        assertThat(job.getAttemptCount()).isEqualTo(2);
        assertThat(job.getQuotaReserved()).isTrue();
        verify(quotaAdapter, never()).tryReserve(any());
    }

    @Test
    @DisplayName("claim: Quota không sẵn sàng -> chuyển job sang WAITING, không tăng attemptCount")
    void claim_whenQuotaUnavailable_transitionsJobToWaitingWithoutIncrementingAttemptCount() {
        WritingGradingJob job = createTestJob(1, 10, WritingGradingJobStatus.READY);
        TestAttempt attempt = createTestAttempt(10, 42, AttemptStatus.AI_GRADING);

        when(jobRepository.findAttemptIdById(1)).thenReturn(Optional.of(10));
        when(testAttemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));
        when(jobRepository.findByIdForUpdate(1)).thenReturn(Optional.of(job));
        when(jobRepository.save(any(WritingGradingJob.class))).thenAnswer(inv -> inv.getArgument(0));

        when(quotaAdapter.tryReserve(42)).thenReturn(Optional.empty());
        when(stateResolver.resolve(any(), any())).thenReturn(AttemptStatus.AI_GRADING_QUEUED);

        ClaimDecision decision = coordinator.claim(1);

        assertThat(decision).isInstanceOf(ClaimDecision.Waiting.class);
        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.WAITING);
        assertThat(job.getWaitReason()).isEqualTo("QUOTA_UNAVAILABLE");
        assertThat(job.getAttemptCount()).isEqualTo(0);
        assertThat(job.getNextAttemptAt()).isEqualTo(now.plusSeconds(60));
    }

    @Test
    @DisplayName("claim: Hết lượt retry (attemptCount >= 4) -> chuyển FAILED và refund quota 1 lần")
    void claim_whenAttemptCountExhausted_transitionsJobToFailedAndRefundsQuota() {
        WritingGradingJob job = createTestJob(1, 10, WritingGradingJobStatus.RETRY_WAIT);
        job.setAttemptCount(4);
        job.setQuotaReserved(true);
        job.setQuotaId(99);
        Instant resetDate = now.plusSeconds(86400);
        job.setQuotaResetDate(resetDate);

        TestAttempt attempt = createTestAttempt(10, 42, AttemptStatus.AI_GRADING);

        when(jobRepository.findAttemptIdById(1)).thenReturn(Optional.of(10));
        when(testAttemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));
        when(jobRepository.findByIdForUpdate(1)).thenReturn(Optional.of(job));
        when(jobRepository.save(any(WritingGradingJob.class))).thenAnswer(inv -> inv.getArgument(0));
        when(stateResolver.resolve(any(), any())).thenReturn(AttemptStatus.GRADING_FAILED);

        ClaimDecision decision = coordinator.claim(1);

        assertThat(decision).isInstanceOf(ClaimDecision.Rejected.class);
        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.FAILED);
        assertThat(job.getLastErrorCode()).isEqualTo("RETRY_BUDGET_EXHAUSTED");
        assertThat(job.getQuotaReserved()).isFalse();
        verify(quotaAdapter).refund(99, resetDate);
    }

    @Test
    @DisplayName("complete: Hợp lệ -> lưu SUCCEEDED vào job, merge aiFeedback vào AttemptAnswer, cập nhật attempt")
    void complete_whenValidRunningClaim_mergesFeedbackAndSetsJobSucceededAndUpdatesAttemptStatus() {
        WritingGradingJob job = createTestJob(1, 10, WritingGradingJobStatus.RUNNING);
        job.setRunId("run-uuid-1");
        job.setLeaseUntil(now.plusSeconds(30));
        job.setQuotaReserved(true);

        TestAttempt attempt = createTestAttempt(10, 42, AttemptStatus.AI_GRADING);

        when(testAttemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));
        when(jobRepository.findByIdForUpdate(1)).thenReturn(Optional.of(job));
        when(attemptAnswerRepository.findByAttemptIdAndPartId(10, 101)).thenReturn(Optional.empty());
        when(attemptAnswerRepository.save(any(AttemptAnswer.class))).thenAnswer(inv -> inv.getArgument(0));
        when(jobRepository.save(any(WritingGradingJob.class))).thenAnswer(inv -> inv.getArgument(0));
        when(stateResolver.resolve(any(), any())).thenReturn(AttemptStatus.COMPLETED);

        WritingGradingContext context = new WritingGradingContext(
                101, "q-1", "en", "prompt", "essay text", 2, List.of()
        );
        Claim claim = new Claim(1, 10, 101, "q-1", "run-uuid-1", now.plusSeconds(30), 1, "test-hash-123", context);

        WritingGrade grade = new WritingGrade(
                WritingGrade.DEFAULT_RUBRIC,
                "vi",
                new BigDecimal("6.5"),
                List.of(new WritingGrade.CriterionGrade("TR", new BigDecimal("6.5"), "Good")),
                "Overall good",
                "essay text corrected",
                List.of(),
                List.of()
        );

        coordinator.complete(claim, grade);

        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.SUCCEEDED);
        assertThat(job.getCompletedAt()).isEqualTo(now);
        assertThat(job.getResultJson()).isNotNull();

        verify(attemptAnswerRepository).save(argThat(ans -> {
            Map<String, Object> aiFeedback = ans.getAiFeedback();
            assertThat(aiFeedback).isNotNull();
            assertThat(aiFeedback.get("schemaVersion")).isEqualTo(1);
            @SuppressWarnings("unchecked")
            Map<String, Object> tasks = (Map<String, Object>) aiFeedback.get("tasks");
            assertThat(tasks).containsKey("q-1");
            return true;
        }));

        verify(testAttemptRepository).save(argThat(att -> {
            assertThat(att.getStatus()).isEqualTo(AttemptStatus.COMPLETED);
            return true;
        }));
    }

    @Test
    @DisplayName("complete: Fencing chặn callback cũ khi lease đã hết hạn")
    void complete_whenLateCompletionWithExpiredLease_doesNotMutateJobOrFeedback() {
        WritingGradingJob job = createTestJob(1, 10, WritingGradingJobStatus.RUNNING);
        job.setRunId("run-uuid-1");
        job.setLeaseUntil(now.minusSeconds(5)); // EXPIRED!

        TestAttempt attempt = createTestAttempt(10, 42, AttemptStatus.AI_GRADING);

        when(testAttemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));
        when(jobRepository.findByIdForUpdate(1)).thenReturn(Optional.of(job));

        WritingGradingContext context = new WritingGradingContext(
                101, "q-1", "en", "prompt", "essay text", 2, List.of()
        );
        Claim claim = new Claim(1, 10, 101, "q-1", "run-uuid-1", now.minusSeconds(5), 1, "test-hash-123", context);

        WritingGrade grade = WritingGrade.tooShort("essay text");

        coordinator.complete(claim, grade);

        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.RUNNING);
        verify(jobRepository, never()).save(any());
        verify(attemptAnswerRepository, never()).save(any());
    }

    @Test
    @DisplayName("fail: Lỗi retryable trong lượt 1 -> chuyển RETRY_WAIT, backoff 5s, không refund quota")
    void fail_whenRetryableAndUnderRetryBudget_transitionsToRetryWaitAndAppliesBackoffWithoutRefund() {
        WritingGradingJob job = createTestJob(1, 10, WritingGradingJobStatus.RUNNING);
        job.setRunId("run-uuid-1");
        job.setLeaseUntil(now.plusSeconds(30));
        job.setAttemptCount(1);
        job.setQuotaReserved(true);
        job.setQuotaId(99);

        TestAttempt attempt = createTestAttempt(10, 42, AttemptStatus.AI_GRADING);

        when(testAttemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));
        when(jobRepository.findByIdForUpdate(1)).thenReturn(Optional.of(job));
        when(jobRepository.save(any(WritingGradingJob.class))).thenAnswer(inv -> inv.getArgument(0));
        when(stateResolver.resolve(any(), any())).thenReturn(AttemptStatus.AI_GRADING);

        WritingGradingContext context = new WritingGradingContext(
                101, "q-1", "en", "prompt", "essay text", 2, List.of()
        );
        Claim claim = new Claim(1, 10, 101, "q-1", "run-uuid-1", now.plusSeconds(30), 1, "test-hash-123", context);

        WritingGradingFailure failure = WritingGradingFailure.retryable("RATE_LIMIT", "Rate limit exceeded");

        coordinator.fail(claim, failure);

        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.RETRY_WAIT);
        assertThat(job.getNextAttemptAt()).isEqualTo(now.plusSeconds(5)); // 5s backoff for 1st retry
        assertThat(job.getLastErrorCode()).isEqualTo("RATE_LIMIT");
        assertThat(job.getQuotaReserved()).isTrue();
        verify(quotaAdapter, never()).refund(any(), any());
    }

    @Test
    @DisplayName("fail: Lỗi terminal -> chuyển FAILED ngay và refund quota đúng 1 lần")
    void fail_whenTerminalFailure_transitionsToFailedAndRefundsQuotaExactlyOnce() {
        WritingGradingJob job = createTestJob(1, 10, WritingGradingJobStatus.RUNNING);
        job.setRunId("run-uuid-1");
        job.setLeaseUntil(now.plusSeconds(30));
        job.setAttemptCount(1);
        job.setQuotaReserved(true);
        job.setQuotaId(99);
        Instant resetDate = now.plusSeconds(86400);
        job.setQuotaResetDate(resetDate);

        TestAttempt attempt = createTestAttempt(10, 42, AttemptStatus.AI_GRADING);

        when(testAttemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));
        when(jobRepository.findByIdForUpdate(1)).thenReturn(Optional.of(job));
        when(jobRepository.save(any(WritingGradingJob.class))).thenAnswer(inv -> inv.getArgument(0));
        when(stateResolver.resolve(any(), any())).thenReturn(AttemptStatus.GRADING_FAILED);

        WritingGradingContext context = new WritingGradingContext(
                101, "q-1", "en", "prompt", "essay text", 2, List.of()
        );
        Claim claim = new Claim(1, 10, 101, "q-1", "run-uuid-1", now.plusSeconds(30), 1, "test-hash-123", context);

        WritingGradingFailure failure = WritingGradingFailure.terminal("MALFORMED_OUTPUT", "JSON corrupted");

        coordinator.fail(claim, failure);

        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.FAILED);
        assertThat(job.getLastErrorCode()).isEqualTo("MALFORMED_OUTPUT");
        assertThat(job.getCompletedAt()).isEqualTo(now);
        assertThat(job.getQuotaReserved()).isFalse();
        verify(quotaAdapter).refund(99, resetDate);
    }

    @Test
    @DisplayName("recoverExpired: Hết hạn lease khi attemptCount=1 (<4) -> chuyển RETRY_WAIT, backoff 5s, giữ quota")
    void recoverExpired_whenLeaseExpiredAndUnderRetryBudget_transitionsToRetryWait() {
        WritingGradingJob job = createTestJob(1, 10, WritingGradingJobStatus.RUNNING);
        job.setRunId("run-uuid-1");
        job.setLeaseUntil(now.minusSeconds(10)); // EXPIRED
        job.setAttemptCount(1);
        job.setQuotaReserved(true);

        TestAttempt attempt = createTestAttempt(10, 42, AttemptStatus.AI_GRADING);

        when(jobRepository.findExpiredJobIds(eq(now), any(PageRequest.class))).thenReturn(List.of(1));
        when(jobRepository.findAttemptIdById(1)).thenReturn(Optional.of(10));
        when(testAttemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));
        when(jobRepository.findByIdForUpdate(1)).thenReturn(Optional.of(job));
        when(jobRepository.save(any(WritingGradingJob.class))).thenAnswer(inv -> inv.getArgument(0));
        when(stateResolver.resolve(any(), any())).thenReturn(AttemptStatus.AI_GRADING);

        int recovered = coordinator.recoverExpired(10);

        assertThat(recovered).isEqualTo(1);
        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.RETRY_WAIT);
        assertThat(job.getLastErrorCode()).isEqualTo("LEASE_EXPIRED");
        assertThat(job.getNextAttemptAt()).isEqualTo(now.plusSeconds(5));
        assertThat(job.getQuotaReserved()).isTrue();
        verify(quotaAdapter, never()).refund(any(), any());
    }

    @Test
    @DisplayName("fail: Gọi fail lần 2 không hoàn tiền lần nữa (idempotent refund)")
    void fail_whenCalledTwice_doesNotRefundAgain() {
        WritingGradingJob job = createTestJob(1, 10, WritingGradingJobStatus.RUNNING);
        job.setRunId("run-uuid-1");
        job.setLeaseUntil(now.plusSeconds(30));
        job.setAttemptCount(1);
        job.setQuotaReserved(true);
        job.setQuotaId(99);
        Instant resetDate = now.plusSeconds(86400);
        job.setQuotaResetDate(resetDate);

        TestAttempt attempt = createTestAttempt(10, 42, AttemptStatus.AI_GRADING);

        when(testAttemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));
        when(jobRepository.findByIdForUpdate(1)).thenReturn(Optional.of(job));
        when(jobRepository.save(any(WritingGradingJob.class))).thenAnswer(inv -> inv.getArgument(0));
        when(stateResolver.resolve(any(), any())).thenReturn(AttemptStatus.GRADING_FAILED);

        WritingGradingContext context = new WritingGradingContext(
                101, "q-1", "en", "prompt", "essay text", 2, List.of()
        );
        Claim claim = new Claim(1, 10, 101, "q-1", "run-uuid-1", now.plusSeconds(30), 1, "test-hash-123", context);
        WritingGradingFailure failure = WritingGradingFailure.terminal("AUTH_ERROR", "Invalid token");

        coordinator.fail(claim, failure);
        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.FAILED);
        assertThat(job.getQuotaReserved()).isFalse();
        verify(quotaAdapter, times(1)).refund(99, resetDate);

        // Gọi fail lần thứ 2 với cùng claim: status đã là FAILED, fencing chặn lại
        coordinator.fail(claim, failure);
        verify(quotaAdapter, times(1)).refund(99, resetDate); // Vẫn chỉ là 1 lần, không double refund
    }

    @Test
    @DisplayName("recoverExpired: Hết hạn lease khi attemptCount=4 (hết lượt) -> chuyển FAILED và refund quota 1 lần")
    void recoverExpired_whenLeaseExpiredAndBudgetExhausted_transitionsToFailedAndRefundsQuota() {
        WritingGradingJob job = createTestJob(1, 10, WritingGradingJobStatus.RUNNING);
        job.setRunId("run-uuid-1");
        job.setLeaseUntil(now.minusSeconds(10)); // EXPIRED
        job.setAttemptCount(4); // EXHAUSTED
        job.setQuotaReserved(true);
        job.setQuotaId(99);
        Instant resetDate = now.plusSeconds(86400);
        job.setQuotaResetDate(resetDate);

        TestAttempt attempt = createTestAttempt(10, 42, AttemptStatus.AI_GRADING);

        when(jobRepository.findExpiredJobIds(eq(now), any(PageRequest.class))).thenReturn(List.of(1));
        when(jobRepository.findAttemptIdById(1)).thenReturn(Optional.of(10));
        when(testAttemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));
        when(jobRepository.findByIdForUpdate(1)).thenReturn(Optional.of(job));
        when(jobRepository.save(any(WritingGradingJob.class))).thenAnswer(inv -> inv.getArgument(0));
        when(stateResolver.resolve(any(), any())).thenReturn(AttemptStatus.GRADING_FAILED);

        int recovered = coordinator.recoverExpired(10);

        assertThat(recovered).isEqualTo(1);
        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.FAILED);
        assertThat(job.getLastErrorCode()).isEqualTo("LEASE_EXPIRED");
        assertThat(job.getQuotaReserved()).isFalse();
        verify(quotaAdapter).refund(99, resetDate);
    }

    @Test
    @DisplayName("claim: Provider disabled -> chuyển WAITING (PROVIDER_DISABLED), không reserve quota, không tăng attemptCount")
    void claim_whenProviderDisabled_returnsWaitingProviderDisabled_doesNotReserveQuotaOrIncrementAttemptCount() {
        geminiProperties.setEnabled(false);

        WritingGradingJob job = createTestJob(1, 10, WritingGradingJobStatus.READY);
        TestAttempt attempt = createTestAttempt(10, 42, AttemptStatus.AI_GRADING);

        when(jobRepository.findAttemptIdById(1)).thenReturn(Optional.of(10));
        when(testAttemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));
        when(jobRepository.findByIdForUpdate(1)).thenReturn(Optional.of(job));
        when(jobRepository.save(any(WritingGradingJob.class))).thenAnswer(inv -> inv.getArgument(0));

        ClaimDecision decision = coordinator.claim(1);

        assertThat(decision).isInstanceOf(ClaimDecision.Waiting.class);
        assertThat(((ClaimDecision.Waiting) decision).reason()).isEqualTo("PROVIDER_DISABLED");

        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.WAITING);
        assertThat(job.getWaitReason()).isEqualTo("PROVIDER_DISABLED");
        assertThat(job.getAttemptCount()).isEqualTo(0);
        assertThat(job.getNextAttemptAt()).isEqualTo(now.plus(properties.getQuotaRecheckInterval()));
        assertThat(job.getQuotaReserved()).isFalse();

        verify(quotaAdapter, never()).tryReserve(anyInt());
    }

    @Test
    @DisplayName("claim: Provider disabled khi job đã có quota reservation -> giữ nguyên quotaReserved và chuyển WAITING")
    void claim_whenProviderDisabledAndJobAlreadyHasQuota_preservesReservationAndSetsWaiting() {
        geminiProperties.setEnabled(false);

        WritingGradingJob job = createTestJob(1, 10, WritingGradingJobStatus.READY);
        job.setQuotaReserved(true);
        job.setQuotaId(55);
        job.setQuotaResetDate(now.plusSeconds(86400));

        TestAttempt attempt = createTestAttempt(10, 42, AttemptStatus.AI_GRADING);

        when(jobRepository.findAttemptIdById(1)).thenReturn(Optional.of(10));
        when(testAttemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));
        when(jobRepository.findByIdForUpdate(1)).thenReturn(Optional.of(job));
        when(jobRepository.save(any(WritingGradingJob.class))).thenAnswer(inv -> inv.getArgument(0));

        ClaimDecision decision = coordinator.claim(1);

        assertThat(decision).isInstanceOf(ClaimDecision.Waiting.class);
        assertThat(((ClaimDecision.Waiting) decision).reason()).isEqualTo("PROVIDER_DISABLED");

        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.WAITING);
        assertThat(job.getWaitReason()).isEqualTo("PROVIDER_DISABLED");
        assertThat(job.getQuotaReserved()).isTrue();
        assertThat(job.getQuotaId()).isEqualTo(55);

        verify(quotaAdapter, never()).refund(anyInt(), any());
        verify(quotaAdapter, never()).tryReserve(anyInt());
    }

    @Test
    @DisplayName("fail: Khi failure là isWaiting (e.g. PROVIDER_DISABLED race) -> khôi phục attemptCount để không tiêu ngân sách retry")
    void fail_whenFailureIsWaiting_restoresAttemptCountSoRetryBudgetIsNotBurned() {
        WritingGradingJob job = createTestJob(1, 10, WritingGradingJobStatus.RUNNING);
        job.setRunId("run-uuid-1");
        job.setAttemptCount(1);
        job.setLeaseUntil(now.plusSeconds(30));

        TestAttempt attempt = createTestAttempt(10, 42, AttemptStatus.AI_GRADING);

        when(testAttemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));
        when(jobRepository.findByIdForUpdate(1)).thenReturn(Optional.of(job));
        when(jobRepository.save(any(WritingGradingJob.class))).thenAnswer(inv -> inv.getArgument(0));

        WritingGradingContext context = new WritingGradingContext(
                101, "q-1", "en", "prompt", "essay text", 2, List.of()
        );
        Claim claim = new Claim(1, 10, 101, "q-1", "run-uuid-1", now.plusSeconds(30), 1, "test-hash-123", context);
        WritingGradingFailure failure = WritingGradingFailure.waiting("PROVIDER_DISABLED", "Gemini provider is temporarily disabled");

        coordinator.fail(claim, failure);

        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.WAITING);
        assertThat(job.getWaitReason()).isEqualTo("PROVIDER_DISABLED");
        assertThat(job.getAttemptCount()).isEqualTo(0);
        assertThat(job.getLeaseUntil()).isNull();
        assertThat(job.getNextAttemptAt()).isEqualTo(now.plus(properties.getQuotaRecheckInterval()));

        verify(quotaAdapter, never()).refund(anyInt(), any());
    }

    @Test
    @DisplayName("claim: Lease được tính đúng theo công thức R2: n * imageFetchTimeout + geminiTimeout + leaseExt")
    void claim_calculatesLeaseWithImageBudgetAccurately_forZeroOneTwoImages() {
        when(jobRepository.findAttemptIdById(1)).thenReturn(Optional.of(10));
        TestAttempt attempt = createTestAttempt(10, 42, AttemptStatus.AI_GRADING);
        when(testAttemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));

        WritingGradingQuotaAdapter.QuotaReservation reservation =
                new WritingGradingQuotaAdapter.QuotaReservation(123, now.plusSeconds(86400));
        when(quotaAdapter.tryReserve(42)).thenReturn(Optional.of(reservation));
        when(jobRepository.save(any(WritingGradingJob.class))).thenAnswer(inv -> inv.getArgument(0));

        // Test 0 images: 0 * 10s + 30s + 15s = 45s
        WritingGradingJob job0 = createTestJob(1, 10, WritingGradingJobStatus.READY);
        job0.setImageCount(0);
        when(jobRepository.findByIdForUpdate(1)).thenReturn(Optional.of(job0));

        ClaimDecision dec0 = coordinator.claim(1);
        assertThat(dec0).isInstanceOf(ClaimDecision.Granted.class);
        Claim claim0 = ((ClaimDecision.Granted) dec0).claim();
        assertThat(claim0.leaseUntil()).isEqualTo(now.plusSeconds(45));

        // Test 1 image: 1 * 10s + 30s + 15s = 55s
        WritingGradingJob job1 = createTestJob(1, 10, WritingGradingJobStatus.READY);
        job1.setImageCount(1);
        when(jobRepository.findByIdForUpdate(1)).thenReturn(Optional.of(job1));

        ClaimDecision dec1 = coordinator.claim(1);
        assertThat(dec1).isInstanceOf(ClaimDecision.Granted.class);
        Claim claim1 = ((ClaimDecision.Granted) dec1).claim();
        assertThat(claim1.leaseUntil()).isEqualTo(now.plusSeconds(55));

        // Test 2 images: 2 * 10s + 30s + 15s = 65s
        WritingGradingJob job2 = createTestJob(1, 10, WritingGradingJobStatus.READY);
        job2.setImageCount(2);
        when(jobRepository.findByIdForUpdate(1)).thenReturn(Optional.of(job2));

        ClaimDecision dec2 = coordinator.claim(1);
        assertThat(dec2).isInstanceOf(ClaimDecision.Granted.class);
        Claim claim2 = ((ClaimDecision.Granted) dec2).claim();
        assertThat(claim2.leaseUntil()).isEqualTo(now.plusSeconds(65));
    }

    @Test
    @DisplayName("complete: Khi attempt có local UNAVAILABLE task trong answers -> updateAttemptStatus tổng hợp thành GRADING_FAILED")
    void complete_whenAttemptHasVisualLocalUnavailable_setsAttemptStatusToGradingFailed() {
        WritingGradingJob job = createTestJob(1, 10, WritingGradingJobStatus.RUNNING);
        job.setRunId("run-uuid-1");
        job.setAttemptCount(1);
        job.setLeaseUntil(now.plusSeconds(30));

        TestAttempt attempt = createTestAttempt(10, 42, AttemptStatus.AI_GRADING);

        when(testAttemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));
        when(jobRepository.findByIdForUpdate(1)).thenReturn(Optional.of(job));
        when(jobRepository.save(any(WritingGradingJob.class))).thenAnswer(inv -> inv.getArgument(0));

        AttemptAnswer localAnswer = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(1)
                .userAnswers(new LinkedHashMap<>())
                .aiFeedback(Map.of(
                        "schemaVersion", 1,
                        "tasks", Map.of("q-visual", Map.of(
                                "status", "UNAVAILABLE",
                                "reasonCode", "VISUAL_CONTEXT_UNSUPPORTED"
                        ))
                ))
                .build();
        when(attemptAnswerRepository.findByAttemptId(10)).thenReturn(List.of(localAnswer));
        when(attemptAnswerRepository.findByAttemptIdAndPartId(10, 101)).thenReturn(Optional.empty());
        when(attemptAnswerRepository.save(any(AttemptAnswer.class))).thenAnswer(inv -> inv.getArgument(0));

        when(stateResolver.resolve(any(), eq(List.of(localAnswer)))).thenReturn(AttemptStatus.GRADING_FAILED);

        WritingGradingContext context = new WritingGradingContext(
                101, "q-1", "en", "prompt", "essay text", 2, List.of()
        );
        Claim claim = new Claim(1, 10, 101, "q-1", "run-uuid-1", now.plusSeconds(30), 1, "test-hash-123", context);
        WritingGrade grade = new WritingGrade(
                WritingGrade.DEFAULT_RUBRIC, "vi", new BigDecimal("7.0"),
                List.of(), "Good essay", "essay text", List.of(), List.of()
        );

        coordinator.complete(claim, grade);

        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.SUCCEEDED);
        assertThat(attempt.getStatus()).isEqualTo(AttemptStatus.GRADING_FAILED);
        verify(testAttemptRepository).save(attempt);
    }

    @Test
    @DisplayName("claim: Dùng scalar projection findAttemptIdById và entityManager.refresh dưới lock để tránh stale entity")
    void claim_usesFindAttemptIdByIdAndRefreshesEntityUnderLock() {
        WritingGradingJob job = createTestJob(1, 10, WritingGradingJobStatus.READY);
        TestAttempt attempt = createTestAttempt(10, 42, AttemptStatus.AI_GRADING);

        when(jobRepository.findAttemptIdById(1)).thenReturn(Optional.of(10));
        when(testAttemptRepository.findByIdForUpdate(10)).thenReturn(Optional.of(attempt));
        when(jobRepository.findByIdForUpdate(1)).thenReturn(Optional.of(job));
        when(entityManager.contains(attempt)).thenReturn(true);
        when(entityManager.contains(job)).thenReturn(true);

        WritingGradingQuotaAdapter.QuotaReservation reservation =
                new WritingGradingQuotaAdapter.QuotaReservation(123, now.plusSeconds(86400));
        when(quotaAdapter.tryReserve(42)).thenReturn(Optional.of(reservation));
        when(jobRepository.save(any(WritingGradingJob.class))).thenAnswer(inv -> inv.getArgument(0));

        ClaimDecision decision = coordinator.claim(1);

        assertThat(decision).isInstanceOf(ClaimDecision.Granted.class);
        verify(jobRepository).findAttemptIdById(1);
        verify(jobRepository, never()).findById(1);
        verify(entityManager).refresh(attempt);
        verify(entityManager).refresh(job);
    }
}

