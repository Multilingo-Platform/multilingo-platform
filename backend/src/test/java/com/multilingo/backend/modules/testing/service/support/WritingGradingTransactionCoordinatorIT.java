package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.FixtureAdaptersTestConfig;
import com.multilingo.backend.modules.analytics.entity.UserQuota;
import com.multilingo.backend.modules.analytics.repository.UserQuotaRepository;
import com.multilingo.backend.modules.analytics.service.UserQuotaReservationService;
import com.multilingo.backend.modules.testing.ai.grading.WritingGrade;
import com.multilingo.backend.modules.testing.ai.grading.WritingGradingContext;
import com.multilingo.backend.modules.testing.config.WritingGradingProperties;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.WritingGradingJob;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.entity.enums.WritingGradingJobStatus;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.repository.WritingGradingJobRepository;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiProperties;
import com.multilingo.backend.modules.testing.ai.media.ImageFetchProperties;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.boot.convert.DurationStyle;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = "spring.main.allow-bean-definition-overriding=true")
@Import(FixtureAdaptersTestConfig.class)
@ActiveProfiles("test")
public class WritingGradingTransactionCoordinatorIT {

    @Autowired
    private WritingGradingTransactionCoordinator coordinator;

    @Autowired
    private WritingGradingJobRepository jobRepository;

    @Autowired
    private TestAttemptRepository testAttemptRepository;

    @Autowired
    private AttemptAnswerRepository attemptAnswerRepository;

    @Autowired
    private UserQuotaRepository userQuotaRepository;

    @Autowired
    private WritingGradingProperties properties;

    @Autowired
    private GeminiProperties geminiProperties;

    @Autowired(required = false)
    private ImageFetchProperties imageFetchProperties;

    @Autowired
    private ObjectMapper objectMapper;

    private Integer testUserId = 8888;
    private TestAttempt testAttempt;
    private UserQuota testQuota;

    @BeforeEach
    void setUp() {
        properties.setEnabled(true);
        if (geminiProperties != null) {
            geminiProperties.setEnabled(true);
            geminiProperties.setRequestTimeout(Duration.ofSeconds(30));
        }

        testQuota = UserQuota.builder()
                .userId(testUserId)
                .featureCode(UserQuotaReservationService.GRADING_FEATURE_CODE)
                .maxLimit(5)
                .usedCount(0)
                .resetDate(Instant.now().plusSeconds(86400))
                .build();
        testQuota = userQuotaRepository.save(testQuota);

        testAttempt = TestAttempt.builder()
                .userId(testUserId)
                .examId(1)
                .testMode(TestMode.MOCK_TEST)
                .testScope(TestScope.FULL_EXAM)
                .status(AttemptStatus.AI_GRADING)
                .startTime(Instant.now().minusSeconds(100))
                .build();
        testAttempt = testAttemptRepository.save(testAttempt);
    }

    @AfterEach
    void tearDown() {
        if (geminiProperties != null) {
            geminiProperties.setEnabled(true);
        }
        jobRepository.deleteAll();
        attemptAnswerRepository.deleteAll();
        testAttemptRepository.deleteAll();
        userQuotaRepository.deleteAll();
    }

    private WritingGradingJob createJob(Integer partId, String questionId, WritingGradingJobStatus status) {
        Map<String, Object> contextJson = new LinkedHashMap<>();
        contextJson.put("partId", partId);
        contextJson.put("questionId", questionId);
        contextJson.put("taskPrompt", "Write an essay about " + questionId);
        contextJson.put("originalText", "Original essay content for question " + questionId);
        contextJson.put("learningLanguage", "en");
        contextJson.put("wordCount", 20);

        WritingGradingJob job = WritingGradingJob.builder()
                .attemptId(testAttempt.getId())
                .partId(partId)
                .questionId(questionId)
                .contextJson(contextJson)
                .inputHash("hash-" + questionId)
                .status(status)
                .attemptCount(0)
                .quotaReserved(false)
                .build();
        return jobRepository.save(job);
    }

    @Test
    @DisplayName("IT: Claim hợp lệ qua transaction proxy -> trừ quota, cấp UUID runId, cập nhật status RUNNING")
    void claim_reservesQuotaSetsRunningAndReturnsValidClaim() {
        WritingGradingJob job = createJob(1, "q-1", WritingGradingJobStatus.READY);

        ClaimDecision decision = coordinator.claim(job.getId());

        assertThat(decision).isInstanceOf(ClaimDecision.Granted.class);
        Claim claim = ((ClaimDecision.Granted) decision).claim();
        assertThat(claim.runId()).isNotBlank();
        assertThat(claim.attemptCount()).isEqualTo(1);
        assertThat(claim.jobId()).isEqualTo(job.getId());

        WritingGradingJob updatedJob = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(updatedJob.getStatus()).isEqualTo(WritingGradingJobStatus.RUNNING);
        assertThat(updatedJob.getQuotaReserved()).isTrue();
        assertThat(updatedJob.getRunId()).isEqualTo(claim.runId());

        UserQuota updatedQuota = userQuotaRepository.findById(testQuota.getId()).orElseThrow();
        assertThat(updatedQuota.getUsedCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("IT: Stale completion từ old run sau khi recovered -> bị fencing chặn, không ghi đè kết quả run mới")
    void complete_whenOldClaimCompletesAfterRecovery_fencingRejectsAndPreservesNewRun() {
        WritingGradingJob job = createJob(1, "q-1", WritingGradingJobStatus.READY);

        // 1. Claim lần đầu (oldClaim)
        ClaimDecision decision1 = coordinator.claim(job.getId());
        assertThat(decision1).isInstanceOf(ClaimDecision.Granted.class);
        Claim oldClaim = ((ClaimDecision.Granted) decision1).claim();

        // 2. Giả lập lease của oldClaim hết hạn trong DB
        job = jobRepository.findById(job.getId()).orElseThrow();
        job.setLeaseUntil(Instant.now().minusSeconds(10));
        jobRepository.save(job);

        // 3. Dispatcher/Worker chạy recovery
        int recovered = coordinator.recoverExpired(10);
        assertThat(recovered).isEqualTo(1);

        job = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.RETRY_WAIT);
        job.setNextAttemptAt(Instant.now().minusSeconds(1)); // Cho phép claim lại ngay
        jobRepository.save(job);

        // 4. Claim lần 2 (newClaim)
        ClaimDecision decision2 = coordinator.claim(job.getId());
        assertThat(decision2).isInstanceOf(ClaimDecision.Granted.class);
        Claim newClaim = ((ClaimDecision.Granted) decision2).claim();
        assertThat(newClaim.runId()).isNotEqualTo(oldClaim.runId());
        assertThat(newClaim.attemptCount()).isEqualTo(2);

        // Quota vẫn chỉ trừ 1 lần do retry không trừ thêm
        UserQuota quotaCheck = userQuotaRepository.findById(testQuota.getId()).orElseThrow();
        assertThat(quotaCheck.getUsedCount()).isEqualTo(1);

        // 5. Old callback cố gắng complete (oldClaim, oldGrade)
        WritingGrade oldGrade = new WritingGrade(
                WritingGrade.DEFAULT_RUBRIC, "vi", new BigDecimal("5.0"),
                List.of(), "Old feedback", "old essay", List.of(), List.of()
        );
        coordinator.complete(oldClaim, oldGrade);

        // Kiểm tra đúng theo kịch bản của plan:
        // complete(oldClaim, oldGrade);
        // assertThat(job.getRunId()).isEqualTo(newClaim.runId());
        // assertThat(savedFeedback).doesNotContainValue(oldGrade);
        // assertThat(quota.getUsedCount()).isEqualTo(1);
        job = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(job.getRunId()).isEqualTo(newClaim.runId());
        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.RUNNING);

        AttemptAnswer answer = attemptAnswerRepository.findByAttemptIdAndPartId(testAttempt.getId(), 1).orElse(null);
        if (answer != null && answer.getAiFeedback() != null) {
            assertThat(answer.getAiFeedback().toString()).doesNotContain("Old feedback");
        }
        quotaCheck = userQuotaRepository.findById(testQuota.getId()).orElseThrow();
        assertThat(quotaCheck.getUsedCount()).isEqualTo(1);

        // 6. New callback hoàn tất (newClaim, newGrade)
        WritingGrade newGrade = new WritingGrade(
                WritingGrade.DEFAULT_RUBRIC, "vi", new BigDecimal("7.5"),
                List.of(), "New valid feedback", "new essay", List.of(), List.of()
        );
        coordinator.complete(newClaim, newGrade);

        job = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.SUCCEEDED);
        assertThat(job.getRunId()).isEqualTo(newClaim.runId());

        AttemptAnswer savedAnswer = attemptAnswerRepository.findByAttemptIdAndPartId(testAttempt.getId(), 1).orElseThrow();
        assertThat(savedAnswer.getAiFeedback().toString()).contains("New valid feedback");
        assertThat(savedAnswer.getAiFeedback().toString()).doesNotContain("Old feedback");
    }

    @Test
    @DisplayName("IT: Hai ESSAY trong cùng một Part -> hoàn tất đồng thời merge đầy đủ cả 2 feedback vào tasks map")
    void complete_twoEssaysInSamePart_mergesBothFeedbacksWithoutOverwriting() {
        WritingGradingJob job1 = createJob(1, "q-1", WritingGradingJobStatus.READY);
        WritingGradingJob job2 = createJob(1, "q-2", WritingGradingJobStatus.READY);

        ClaimDecision dec1 = coordinator.claim(job1.getId());
        ClaimDecision dec2 = coordinator.claim(job2.getId());

        assertThat(dec1).isInstanceOf(ClaimDecision.Granted.class);
        assertThat(dec2).isInstanceOf(ClaimDecision.Granted.class);
        Claim claim1 = ((ClaimDecision.Granted) dec1).claim();
        Claim claim2 = ((ClaimDecision.Granted) dec2).claim();

        WritingGrade grade1 = new WritingGrade(
                WritingGrade.DEFAULT_RUBRIC, "vi", new BigDecimal("6.0"),
                List.of(), "Feedback Q1", "essay 1", List.of(), List.of()
        );
        WritingGrade grade2 = new WritingGrade(
                WritingGrade.DEFAULT_RUBRIC, "vi", new BigDecimal("7.0"),
                List.of(), "Feedback Q2", "essay 2", List.of(), List.of()
        );

        // Complete job 1
        coordinator.complete(claim1, grade1);
        // Complete job 2
        coordinator.complete(claim2, grade2);

        // Kiểm tra AttemptAnswer cho part 1
        AttemptAnswer answer = attemptAnswerRepository.findByAttemptIdAndPartId(testAttempt.getId(), 1).orElseThrow();
        Map<String, Object> aiFeedback = answer.getAiFeedback();
        assertThat(aiFeedback).isNotNull();
        assertThat(aiFeedback.get("schemaVersion")).isEqualTo(1);

        @SuppressWarnings("unchecked")
        Map<String, Object> tasks = (Map<String, Object>) aiFeedback.get("tasks");
        assertThat(tasks).isNotNull();
        assertThat(tasks).containsKeys("q-1", "q-2");

        @SuppressWarnings("unchecked")
        Map<String, Object> task1Map = (Map<String, Object>) tasks.get("q-1");
        assertThat(task1Map.get("overallFeedback")).isEqualTo("Feedback Q1");

        @SuppressWarnings("unchecked")
        Map<String, Object> task2Map = (Map<String, Object>) tasks.get("q-2");
        assertThat(task2Map.get("overallFeedback")).isEqualTo("Feedback Q2");

        // Cả 2 job đều SUCCEEDED -> Attempt chuyển sang COMPLETED
        TestAttempt updatedAttempt = testAttemptRepository.findById(testAttempt.getId()).orElseThrow();
        assertThat(updatedAttempt.getStatus()).isEqualTo(AttemptStatus.COMPLETED);
    }

    @Test
    @DisplayName("IT: Concurrency - 2 thread cùng tranh chấp 1 job qua production JPA -> chỉ 1 claim Granted, quota trừ đúng 1 lần")
    void claim_twoConcurrentThreads_productionJpa_onlyOneClaimGrantedAndQuotaReservedOnce() throws Exception {
        WritingGradingJob job = createJob(1, "q-concurrent", WritingGradingJobStatus.READY);

        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(2);

        ConcurrentLinkedQueue<ClaimDecision> decisions = new ConcurrentLinkedQueue<>();
        ExecutorService executor = Executors.newFixedThreadPool(2);

        for (int i = 0; i < 2; i++) {
            executor.submit(() -> {
                try {
                    startLatch.await();
                    ClaimDecision decision = coordinator.claim(job.getId());
                    decisions.add(decision);
                } catch (Exception e) {
                    e.printStackTrace();
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        boolean completed = doneLatch.await(10, TimeUnit.SECONDS);
        executor.shutdown();

        assertThat(completed).isTrue();
        assertThat(decisions).hasSize(2);

        long grantedCount = decisions.stream().filter(d -> d instanceof ClaimDecision.Granted).count();
        long rejectedCount = decisions.stream().filter(d -> d instanceof ClaimDecision.Rejected).count();

        assertThat(grantedCount).as("Chỉ duy nhất 1 thread được cấp claim").isEqualTo(1);
        assertThat(rejectedCount).as("Thread còn lại phải bị từ chối").isEqualTo(1);

        WritingGradingJob updatedJob = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(updatedJob.getStatus()).isEqualTo(WritingGradingJobStatus.RUNNING);
        assertThat(updatedJob.getAttemptCount()).isEqualTo(1);
        assertThat(updatedJob.getQuotaReserved()).isTrue();

        UserQuota updatedQuota = userQuotaRepository.findById(testQuota.getId()).orElseThrow();
        assertThat(updatedQuota.getUsedCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("IT: Khi provider Gemini bị disabled -> claim trả Waiting(PROVIDER_DISABLED) và không trừ quota")
    void claim_whenProviderDisabled_returnsWaitingProviderDisabled_andDoesNotReserveQuota() {
        geminiProperties.setEnabled(false);

        WritingGradingJob job = createJob(1, "q-disabled", WritingGradingJobStatus.READY);

        ClaimDecision decision = coordinator.claim(job.getId());

        assertThat(decision).isInstanceOf(ClaimDecision.Waiting.class);
        assertThat(((ClaimDecision.Waiting) decision).reason()).isEqualTo("PROVIDER_DISABLED");

        WritingGradingJob updatedJob = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(updatedJob.getStatus()).isEqualTo(WritingGradingJobStatus.WAITING);
        assertThat(updatedJob.getWaitReason()).isEqualTo("PROVIDER_DISABLED");
        assertThat(updatedJob.getAttemptCount()).isEqualTo(0);
        assertThat(updatedJob.getQuotaReserved()).isFalse();

        UserQuota updatedQuota = userQuotaRepository.findById(testQuota.getId()).orElseThrow();
        assertThat(updatedQuota.getUsedCount()).isEqualTo(0);
    }

    @Test
    @DisplayName("IT: Attempt có task visual local UNAVAILABLE và job text thành công -> attemptStatus kết thúc là GRADING_FAILED")
    void complete_whenAttemptHasVisualLocalUnavailable_setsAttemptStatusToGradingFailed() {
        WritingGradingJob textJob = createJob(1, "q-text", WritingGradingJobStatus.READY);

        Map<String, Object> visualTaskFeedback = new LinkedHashMap<>();
        visualTaskFeedback.put("status", "UNAVAILABLE");
        visualTaskFeedback.put("reasonCode", "VISUAL_CONTEXT_UNSUPPORTED");

        Map<String, Object> tasksMap = new LinkedHashMap<>();
        tasksMap.put("q-visual", visualTaskFeedback);

        Map<String, Object> aiFeedback = new LinkedHashMap<>();
        aiFeedback.put("schemaVersion", 1);
        aiFeedback.put("tasks", tasksMap);

        AttemptAnswer visualAnswer = AttemptAnswer.builder()
                .attempt(testAttempt)
                .partId(2)
                .userAnswers(new LinkedHashMap<>())
                .aiFeedback(aiFeedback)
                .build();
        attemptAnswerRepository.save(visualAnswer);

        ClaimDecision dec = coordinator.claim(textJob.getId());
        assertThat(dec).isInstanceOf(ClaimDecision.Granted.class);
        Claim claim = ((ClaimDecision.Granted) dec).claim();

        WritingGrade grade = new WritingGrade(
                WritingGrade.DEFAULT_RUBRIC, "vi", new BigDecimal("7.0"),
                List.of(), "Feedback text", "essay text", List.of(), List.of()
        );
        coordinator.complete(claim, grade);

        WritingGradingJob updatedTextJob = jobRepository.findById(textJob.getId()).orElseThrow();
        assertThat(updatedTextJob.getStatus()).isEqualTo(WritingGradingJobStatus.SUCCEEDED);

        TestAttempt updatedAttempt = testAttemptRepository.findById(testAttempt.getId()).orElseThrow();
        assertThat(updatedAttempt.getStatus()).isEqualTo(AttemptStatus.GRADING_FAILED);
    }

    @Test
    @DisplayName("IT: Lease được tính đúng bao gồm ngân sách tải ảnh: n * imageFetchTimeout + geminiTimeout + leaseExt")
    void claim_calculatesLeaseWithImageBudgetAccurately() {
        WritingGradingJob visualJob = createJob(1, "q-visual-lease", WritingGradingJobStatus.READY);
        visualJob.setImageCount(2);
        visualJob = jobRepository.save(visualJob);

        Instant beforeClaim = Instant.now();
        ClaimDecision dec = coordinator.claim(visualJob.getId());
        Instant afterClaim = Instant.now();

        assertThat(dec).isInstanceOf(ClaimDecision.Granted.class);
        Claim claim = ((ClaimDecision.Granted) dec).claim();

        long leaseSecondsMin = Duration.between(afterClaim, claim.leaseUntil()).toSeconds();
        long leaseSecondsMax = Duration.between(beforeClaim, claim.leaseUntil()).toSeconds();

        long expectedLeaseSeconds = Duration.ofSeconds(30).getSeconds()
                + (imageFetchProperties == null ? Duration.ofSeconds(10).getSeconds()
                : DurationStyle.detectAndParse(imageFetchProperties.getRequestTimeout()).getSeconds()) * 2
                + properties.getLeaseExtension().getSeconds();
        assertThat(leaseSecondsMin).isGreaterThanOrEqualTo(expectedLeaseSeconds - 1);
        assertThat(leaseSecondsMax).isLessThanOrEqualTo(expectedLeaseSeconds + 1);
    }
}
