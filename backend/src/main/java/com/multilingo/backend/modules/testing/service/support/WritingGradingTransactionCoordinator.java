package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.adapter.WritingGradingQuotaAdapter;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiProperties;
import com.multilingo.backend.modules.testing.ai.grading.WritingGrade;
import com.multilingo.backend.modules.testing.ai.grading.WritingGradingContext;
import com.multilingo.backend.modules.testing.ai.grading.WritingGradingContextCodec;
import com.multilingo.backend.modules.testing.ai.grading.WritingGradingResultCodec;
import com.multilingo.backend.modules.testing.util.WritingLengthCounter;
import com.multilingo.backend.modules.testing.ai.grading.WritingGradingFailure;
import com.multilingo.backend.modules.testing.ai.grading.WritingImageRef;
import com.multilingo.backend.modules.testing.ai.media.ImageFetchProperties;
import com.multilingo.backend.modules.testing.config.WritingGradingProperties;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.WritingGradingJob;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.WritingGradingJobStatus;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.repository.WritingGradingJobRepository;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.convert.DurationStyle;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * Điều phối các giao dịch nhận việc (claim), hoàn thành (complete), ghi nhận lỗi (fail),
 * và phục hồi công việc quá hạn (recovery) cho quy trình chấm bài thi Writing tự động.
 *
 * Tuân thủ quy tắc khóa toàn cục nghiêm ngặt: TestAttempt -> UserQuota -> WritingGradingJob
 * nhằm tránh triệt để tình trạng deadlock và xung đột đa luồng.
 */
@Component
public class WritingGradingTransactionCoordinator {

    private final WritingGradingContextCodec contextCodec = new WritingGradingContextCodec();
    private final WritingGradingResultCodec resultCodec = new WritingGradingResultCodec();

    private final WritingGradingJobRepository jobRepository;
    private final TestAttemptRepository testAttemptRepository;
    private final AttemptAnswerRepository attemptAnswerRepository;
    private final WritingGradingQuotaAdapter quotaAdapter;
    private final WritingGradingAttemptStateResolver stateResolver;
    private final WritingGradingProperties properties;
    private final GeminiProperties geminiProperties;
    private final ImageFetchProperties imageFetchProperties;
    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final ObjectProvider<WritingGradingTransactionCoordinator> selfProvider;

    @Autowired
    public WritingGradingTransactionCoordinator(
            WritingGradingJobRepository jobRepository,
            TestAttemptRepository testAttemptRepository,
            AttemptAnswerRepository attemptAnswerRepository,
            WritingGradingQuotaAdapter quotaAdapter,
            WritingGradingAttemptStateResolver stateResolver,
            WritingGradingProperties properties,
            GeminiProperties geminiProperties,
            @Autowired(required = false) ImageFetchProperties imageFetchProperties,
            @Autowired(required = false) EntityManager entityManager,
            ObjectMapper objectMapper,
            Clock clock,
            ObjectProvider<WritingGradingTransactionCoordinator> selfProvider
    ) {
        this.jobRepository = Objects.requireNonNull(jobRepository, "jobRepository must not be null");
        this.testAttemptRepository = Objects.requireNonNull(testAttemptRepository, "testAttemptRepository must not be null");
        this.attemptAnswerRepository = Objects.requireNonNull(attemptAnswerRepository, "attemptAnswerRepository must not be null");
        this.quotaAdapter = Objects.requireNonNull(quotaAdapter, "quotaAdapter must not be null");
        this.stateResolver = Objects.requireNonNull(stateResolver, "stateResolver must not be null");
        this.properties = Objects.requireNonNull(properties, "properties must not be null");
        this.geminiProperties = Objects.requireNonNull(geminiProperties, "geminiProperties must not be null");
        this.imageFetchProperties = imageFetchProperties;
        this.entityManager = entityManager;
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper must not be null");
        this.clock = Objects.requireNonNull(clock, "clock must not be null");
        this.selfProvider = selfProvider;
    }

    public WritingGradingTransactionCoordinator(
            WritingGradingJobRepository jobRepository,
            TestAttemptRepository testAttemptRepository,
            AttemptAnswerRepository attemptAnswerRepository,
            WritingGradingQuotaAdapter quotaAdapter,
            WritingGradingAttemptStateResolver stateResolver,
            WritingGradingProperties properties,
            GeminiProperties geminiProperties,
            ImageFetchProperties imageFetchProperties,
            EntityManager entityManager,
            ObjectMapper objectMapper,
            Clock clock
    ) {
        this(jobRepository, testAttemptRepository, attemptAnswerRepository, quotaAdapter, stateResolver,
                properties, geminiProperties, imageFetchProperties, entityManager, objectMapper, clock, null);
    }

    public WritingGradingTransactionCoordinator(
            WritingGradingJobRepository jobRepository,
            TestAttemptRepository testAttemptRepository,
            AttemptAnswerRepository attemptAnswerRepository,
            WritingGradingQuotaAdapter quotaAdapter,
            WritingGradingAttemptStateResolver stateResolver,
            WritingGradingProperties properties,
            GeminiProperties geminiProperties,
            ObjectMapper objectMapper,
            Clock clock
    ) {
        this(jobRepository, testAttemptRepository, attemptAnswerRepository, quotaAdapter, stateResolver,
                properties, geminiProperties, null, null, objectMapper, clock, null);
    }

    /**
     * Nhận việc chấm điểm bài thi Writing.
     * Khóa attempt -> quota -> job, kiểm tra trạng thái và hạn ngạch (quota),
     * cấp UUID run token và lease, commit giao dịch trước khi trả về Claim.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ClaimDecision claim(Integer jobId) {
        if (jobId == null) {
            return new ClaimDecision.Rejected("JOB_ID_NULL");
        }

        Optional<Integer> attemptIdOpt = jobRepository.findAttemptIdById(jobId);
        if (attemptIdOpt.isEmpty()) {
            return new ClaimDecision.Rejected("JOB_NOT_FOUND");
        }
        Integer attemptId = attemptIdOpt.get();

        // 1. Lock Attempt
        Optional<TestAttempt> attemptOpt = testAttemptRepository.findByIdForUpdate(attemptId);
        if (attemptOpt.isEmpty()) {
            return new ClaimDecision.Rejected("ATTEMPT_NOT_FOUND");
        }
        TestAttempt attempt = attemptOpt.get();
        if (entityManager != null && entityManager.contains(attempt)) {
            entityManager.refresh(attempt);
        }
        if (attempt.getStatus() == AttemptStatus.IN_PROGRESS) {
            return new ClaimDecision.Rejected("ATTEMPT_IN_PROGRESS");
        }

        // 2. Lock Quota
        quotaAdapter.lockAccount(attempt.getUserId());

        // 3. Lock Job
        Optional<WritingGradingJob> jobOpt = jobRepository.findByIdForUpdate(jobId);
        if (jobOpt.isEmpty()) {
            return new ClaimDecision.Rejected("JOB_NOT_FOUND");
        }
        WritingGradingJob job = jobOpt.get();
        if (entityManager != null && entityManager.contains(job)) {
            entityManager.refresh(job);
        }

        // 4. Sample clock after acquiring all locks
        Instant now = clock.instant();

        // Kiểm tra trạng thái hiện tại
        if (job.getStatus() == WritingGradingJobStatus.RUNNING) {
            if (job.getLeaseUntil() != null && job.getLeaseUntil().isAfter(now)) {
                return new ClaimDecision.Rejected("ALREADY_RUNNING");
            }
        }
        if (job.getStatus() == WritingGradingJobStatus.SUCCEEDED
                || job.getStatus() == WritingGradingJobStatus.FAILED
                || job.getStatus() == WritingGradingJobStatus.UNAVAILABLE) {
            return new ClaimDecision.Rejected("TERMINAL_STATUS_" + job.getStatus());
        }

        if (job.getNextAttemptAt() != null && job.getNextAttemptAt().isAfter(now)) {
            return new ClaimDecision.Rejected("NOT_DUE");
        }

        if (!properties.isEnabled()) {
            job.setStatus(WritingGradingJobStatus.WAITING);
            job.setWaitReason("FEATURE_DISABLED");
            job.setNextAttemptAt(now.plus(properties.getQuotaRecheckInterval()));
            jobRepository.save(job);
            updateAttemptStatus(attempt);
            return new ClaimDecision.Waiting("FEATURE_DISABLED");
        }

        if (!geminiProperties.isEnabled()) {
            job.setStatus(WritingGradingJobStatus.WAITING);
            job.setWaitReason("PROVIDER_DISABLED");
            job.setNextAttemptAt(now.plus(properties.getQuotaRecheckInterval()));
            jobRepository.save(job);
            updateAttemptStatus(attempt);
            return new ClaimDecision.Waiting("PROVIDER_DISABLED");
        }

        // Kiểm tra hạn mức số lần thử (tối đa 1 lần đầu + 3 lần retry = 4 lần claim)
        if (job.getAttemptCount() >= 4) {
            job.setStatus(WritingGradingJobStatus.FAILED);
            job.setLastErrorCode("RETRY_BUDGET_EXHAUSTED");
            job.setCompletedAt(now);
            job.setLeaseUntil(null);
            job.setNextAttemptAt(null);
            if (Boolean.TRUE.equals(job.getQuotaReserved())) {
                quotaAdapter.refund(job.getQuotaId(), job.getQuotaResetDate());
                job.setQuotaReserved(false);
            }
            jobRepository.save(job);
            updateAttemptStatus(attempt);
            return new ClaimDecision.Rejected("RETRY_BUDGET_EXHAUSTED");
        }

        // Quota: Reserve một lần duy nhất trước khi gọi provider, retry không trừ thêm
        if (!Boolean.TRUE.equals(job.getQuotaReserved())) {
            Optional<WritingGradingQuotaAdapter.QuotaReservation> resOpt = quotaAdapter.tryReserve(attempt.getUserId());
            if (resOpt.isEmpty()) {
                job.setStatus(WritingGradingJobStatus.WAITING);
                job.setWaitReason("QUOTA_UNAVAILABLE");
                job.setNextAttemptAt(now.plus(properties.getQuotaRecheckInterval()));
                jobRepository.save(job);
                updateAttemptStatus(attempt);
                return new ClaimDecision.Waiting("QUOTA_UNAVAILABLE");
            }
            WritingGradingQuotaAdapter.QuotaReservation res = resOpt.get();
            job.setQuotaId(res.quotaId());
            job.setQuotaResetDate(res.resetDate());
            job.setQuotaReserved(true);
        }

        // Cấp Claim
        int newAttemptCount = job.getAttemptCount() + 1;
        job.setAttemptCount(newAttemptCount);
        String runId = UUID.randomUUID().toString();
        job.setRunId(runId);

        int imageCount = (job.getImageCount() != null && job.getImageCount() > 0) ? job.getImageCount() : 0;
        Duration imageFetchTimeout = parseImageFetchTimeout();
        Duration totalImageTimeout = imageFetchTimeout.multipliedBy(imageCount);

        Duration geminiTimeout = geminiProperties.getRequestTimeout() != null
                ? geminiProperties.getRequestTimeout()
                : Duration.ofSeconds(30);
        Duration leaseExt = properties.getLeaseExtension() != null
                ? properties.getLeaseExtension()
                : Duration.ofSeconds(15);
        Duration totalLeaseDuration = totalImageTimeout.plus(geminiTimeout).plus(leaseExt);
        Instant leaseUntil = now.plus(totalLeaseDuration);

        job.setLeaseUntil(leaseUntil);
        job.setLastStartedAt(now);
        job.setStatus(WritingGradingJobStatus.RUNNING);
        job.setWaitReason(null);
        job.setLastErrorCode(null);

        job = jobRepository.save(job);
        updateAttemptStatus(attempt);

        WritingGradingContext context = deserializeContext(job.getContextJson());
        Claim claim = new Claim(
                job.getId(),
                job.getAttemptId(),
                job.getPartId(),
                job.getQuestionId(),
                runId,
                leaseUntil,
                newAttemptCount,
                job.getInputHash(),
                context
        );
        return new ClaimDecision.Granted(claim);
    }

    /**
     * Hoàn tất công việc chấm bài thành công.
     * Xác thực fencing (status RUNNING, token runId khớp, lease còn hạn, inputHash không đổi).
     * Trộn aiFeedback vào AttemptAnswer theo câu hỏi và lưu job SUCCEEDED.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void complete(Claim claim, WritingGrade grade) {
        if (claim == null || grade == null) {
            return;
        }

        // 1. Lock Attempt
        Optional<TestAttempt> attemptOpt = testAttemptRepository.findByIdForUpdate(claim.attemptId());
        if (attemptOpt.isEmpty()) {
            return;
        }
        TestAttempt attempt = attemptOpt.get();
        if (entityManager != null && entityManager.contains(attempt)) {
            entityManager.refresh(attempt);
        }

        // 2. Lock Quota
        quotaAdapter.lockAccount(attempt.getUserId());

        // 3. Lock Job
        Optional<WritingGradingJob> jobOpt = jobRepository.findByIdForUpdate(claim.jobId());
        if (jobOpt.isEmpty()) {
            return;
        }
        WritingGradingJob job = jobOpt.get();
        if (entityManager != null && entityManager.contains(job)) {
            entityManager.refresh(job);
        }

        // 4. Sample clock after locks
        Instant now = clock.instant();

        // Fencing check
        if (job.getStatus() != WritingGradingJobStatus.RUNNING) {
            return;
        }
        if (!Objects.equals(job.getRunId(), claim.runId())) {
            return;
        }
        if (job.getLeaseUntil() != null && job.getLeaseUntil().isBefore(now)) {
            return;
        }
        if (!Objects.equals(job.getInputHash(), claim.inputHash())) {
            return;
        }

        // Merge aiFeedback under attempt lock
        @SuppressWarnings("unchecked")
        Map<String, Object> rawGradeMap = objectMapper.convertValue(grade, Map.class);
        Map<String, Object> gradeMap = claim.context() != null && claim.context().rubricPolicy() != null
                ? resultCodec.encode(rawGradeMap, claim.context().rubricPolicy(), claim.context().feedbackLanguage(),
                    claim.context().lengthMetric() != null ? claim.context().lengthMetric()
                            : new WritingLengthCounter().count(claim.context().originalText(), claim.context().learningLanguage()))
                : rawGradeMap;
        mergeAiFeedback(attempt, claim.partId(), claim.questionId(), gradeMap);

        // Update Job
        job.setStatus(WritingGradingJobStatus.SUCCEEDED);
        job.setResultJson(gradeMap);
        job.setCompletedAt(now);
        job.setLeaseUntil(null);
        job.setNextAttemptAt(null);
        job.setLastErrorCode(null);

        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("rubric", grade.rubricCode());
        if (grade.imageDigests() != null && !grade.imageDigests().isEmpty()) {
            metadata.put("imageDigests", grade.imageDigests());
        }
        job.setModelMetadata(metadata);

        jobRepository.save(job);
        updateAttemptStatus(attempt);
    }

    /**
     * Ghi nhận lỗi khi xử lý công việc chấm bài.
     * Xác thực fencing, nếu retryable thì backoff 5/30/120s sang RETRY_WAIT giữ quota.
     * Nếu terminal hoặc hết budget thì chuyển FAILED/UNAVAILABLE và hoàn quota 1 lần.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(Claim claim, WritingGradingFailure failure) {
        if (claim == null || failure == null) {
            return;
        }

        // 1. Lock Attempt
        Optional<TestAttempt> attemptOpt = testAttemptRepository.findByIdForUpdate(claim.attemptId());
        if (attemptOpt.isEmpty()) {
            return;
        }
        TestAttempt attempt = attemptOpt.get();
        if (entityManager != null && entityManager.contains(attempt)) {
            entityManager.refresh(attempt);
        }

        // 2. Lock Quota
        quotaAdapter.lockAccount(attempt.getUserId());

        // 3. Lock Job
        Optional<WritingGradingJob> jobOpt = jobRepository.findByIdForUpdate(claim.jobId());
        if (jobOpt.isEmpty()) {
            return;
        }
        WritingGradingJob job = jobOpt.get();
        if (entityManager != null && entityManager.contains(job)) {
            entityManager.refresh(job);
        }

        // 4. Sample clock after locks
        Instant now = clock.instant();

        // Fencing check
        if (job.getStatus() != WritingGradingJobStatus.RUNNING) {
            return;
        }
        if (!Objects.equals(job.getRunId(), claim.runId())) {
            return;
        }
        if (job.getLeaseUntil() != null && job.getLeaseUntil().isBefore(now)) {
            return;
        }
        if (!Objects.equals(job.getInputHash(), claim.inputHash())) {
            return;
        }

        if (failure.isWaiting()) {
            // Restore attempt count so WAITING (e.g. PROVIDER_DISABLED race) does not burn retry budget
            job.setAttemptCount(Math.max(0, job.getAttemptCount() - 1));
            job.setStatus(WritingGradingJobStatus.WAITING);
            job.setWaitReason(failure.errorCode());
            job.setNextAttemptAt(now.plus(properties.getQuotaRecheckInterval()));
            job.setLeaseUntil(null);
            job.setLastErrorCode(failure.errorCode());
            jobRepository.save(job);
        } else if (failure.isRetryable() && job.getAttemptCount() < 4) {
            Duration backoff = computeBackoff(job.getAttemptCount());
            job.setStatus(WritingGradingJobStatus.RETRY_WAIT);
            job.setNextAttemptAt(now.plus(backoff));
            job.setLastErrorCode(failure.errorCode());
            job.setLeaseUntil(null);
            jobRepository.save(job);
        } else {
            // Terminal failure or exhausted retry budget
            if (failure.destination() == WritingGradingFailure.TerminalDestination.UNAVAILABLE) {
                job.setStatus(WritingGradingJobStatus.UNAVAILABLE);
            } else {
                job.setStatus(WritingGradingJobStatus.FAILED);
            }
            job.setLastErrorCode(failure.errorCode());
            job.setCompletedAt(now);
            job.setLeaseUntil(null);
            job.setNextAttemptAt(null);
            if (Boolean.TRUE.equals(job.getQuotaReserved())) {
                quotaAdapter.refund(job.getQuotaId(), job.getQuotaResetDate());
                job.setQuotaReserved(false);
            }
            jobRepository.save(job);
        }

        updateAttemptStatus(attempt);
    }

    /**
     * Phục hồi các công việc RUNNING bị crash hoặc quá hạn lease.
     */
    public int recoverExpired(int limit) {
        Instant now = clock.instant();
        List<Integer> expiredIds = jobRepository.findExpiredJobIds(now, PageRequest.of(0, Math.max(1, limit)));
        int recoveredCount = 0;
        WritingGradingTransactionCoordinator proxy = selfProvider != null ? selfProvider.getIfAvailable(() -> this) : this;
        for (Integer jobId : expiredIds) {
            try {
                if (proxy.recoverJob(jobId)) {
                    recoveredCount++;
                }
            } catch (Exception ignored) {
                // Tiếp tục phục hồi các job khác nếu một job gặp lỗi
            }
        }
        return recoveredCount;
    }

    /**
     * Phục hồi một job cụ thể trong transaction riêng.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean recoverJob(Integer jobId) {
        if (jobId == null) {
            return false;
        }

        Optional<Integer> attemptIdOpt = jobRepository.findAttemptIdById(jobId);
        if (attemptIdOpt.isEmpty()) {
            return false;
        }
        Integer attemptId = attemptIdOpt.get();

        // 1. Lock Attempt
        Optional<TestAttempt> attemptOpt = testAttemptRepository.findByIdForUpdate(attemptId);
        if (attemptOpt.isEmpty()) {
            return false;
        }
        TestAttempt attempt = attemptOpt.get();
        if (entityManager != null && entityManager.contains(attempt)) {
            entityManager.refresh(attempt);
        }

        // 2. Lock Quota
        quotaAdapter.lockAccount(attempt.getUserId());

        // 3. Lock Job
        Optional<WritingGradingJob> jobOpt = jobRepository.findByIdForUpdate(jobId);
        if (jobOpt.isEmpty()) {
            return false;
        }
        WritingGradingJob job = jobOpt.get();
        if (entityManager != null && entityManager.contains(job)) {
            entityManager.refresh(job);
        }

        // 4. Sample clock after locks
        Instant now = clock.instant();

        // Fencing check
        if (job.getStatus() != WritingGradingJobStatus.RUNNING) {
            return false;
        }
        if (job.getLeaseUntil() == null || !job.getLeaseUntil().isBefore(now)) {
            return false;
        }

        // Áp dụng cùng logic ngân sách thử lại như fail
        if (job.getAttemptCount() < 4) {
            Duration backoff = computeBackoff(job.getAttemptCount());
            job.setStatus(WritingGradingJobStatus.RETRY_WAIT);
            job.setNextAttemptAt(now.plus(backoff));
            job.setLastErrorCode("LEASE_EXPIRED");
            job.setLeaseUntil(null);
        } else {
            job.setStatus(WritingGradingJobStatus.FAILED);
            job.setLastErrorCode("LEASE_EXPIRED");
            job.setCompletedAt(now);
            job.setLeaseUntil(null);
            job.setNextAttemptAt(null);
            if (Boolean.TRUE.equals(job.getQuotaReserved())) {
                quotaAdapter.refund(job.getQuotaId(), job.getQuotaResetDate());
                job.setQuotaReserved(false);
            }
        }

        jobRepository.save(job);
        updateAttemptStatus(attempt);
        return true;
    }

    private void mergeAiFeedback(TestAttempt attempt, Integer partId, String questionId, Map<String, Object> gradeMap) {
        AttemptAnswer answer = attemptAnswerRepository.findByAttemptIdAndPartId(attempt.getId(), partId)
                .orElseGet(() -> AttemptAnswer.builder()
                        .attempt(attempt)
                        .partId(partId)
                        .userAnswers(new LinkedHashMap<>())
                        .build());

        Map<String, Object> feedback = answer.getAiFeedback();
        if (feedback == null) {
            feedback = new LinkedHashMap<>();
        } else {
            feedback = new LinkedHashMap<>(feedback);
        }
        feedback.put("schemaVersion", 1);

        @SuppressWarnings("unchecked")
        Map<String, Object> tasks = (Map<String, Object>) feedback.get("tasks");
        if (tasks == null) {
            tasks = new LinkedHashMap<>();
        } else {
            tasks = new LinkedHashMap<>(tasks);
        }
        tasks.put(questionId, gradeMap);
        feedback.put("tasks", tasks);

        answer.setAiFeedback(feedback);
        attemptAnswerRepository.save(answer);
    }

    private void updateAttemptStatus(TestAttempt attempt) {
        List<WritingGradingJob> allJobs = jobRepository.findAllByAttemptId(attempt.getId());
        List<AttemptAnswer> answers = attemptAnswerRepository.findByAttemptId(attempt.getId());
        AttemptStatus resolved = stateResolver.resolve(allJobs, answers);
        if (attempt.getStatus() != resolved) {
            attempt.setStatus(resolved);
            testAttemptRepository.save(attempt);
        }
    }

    private Duration parseImageFetchTimeout() {
        if (imageFetchProperties == null || imageFetchProperties.getRequestTimeout() == null || imageFetchProperties.getRequestTimeout().isBlank()) {
            return Duration.ofSeconds(10);
        }
        try {
            return DurationStyle.detectAndParse(imageFetchProperties.getRequestTimeout());
        } catch (Exception e) {
            return Duration.ofSeconds(10);
        }
    }

    private Duration computeBackoff(int attemptCount) {
        return switch (attemptCount) {
            case 1 -> Duration.ofSeconds(5);
            case 2 -> Duration.ofSeconds(30);
            default -> Duration.ofSeconds(120);
        };
    }

    private WritingGradingContext deserializeContext(Map<String, Object> map) {
        if (map == null) {
            return new WritingGradingContext(0, "", "en", "", "", 0, List.of());
        }
        Integer partId = map.get("partId") instanceof Number n ? n.intValue() : 0;
        String questionId = map.get("questionId") instanceof String s ? s : "";
        String partTitle = (String) map.get("partTitle");
        String partInstruction = (String) map.get("partInstruction");
        String groupInstruction = (String) map.get("groupInstruction");
        String taskPrompt = (String) map.get("taskPrompt");
        String originalText = (String) map.get("originalText");
        String learningLanguage = map.get("learningLanguage") instanceof String s ? s : "en";
        int wordCount = map.get("wordCount") instanceof Number n ? n.intValue() : 0;

        List<WritingImageRef> images = List.of();
        if (map.get("images") instanceof List<?> imgList) {
            images = imgList.stream()
                    .filter(item -> item instanceof Map<?, ?>)
                    .map(item -> {
                        Map<?, ?> imgMap = (Map<?, ?>) item;
                        String url = (String) imgMap.get("url");
                        return (url != null && !url.isBlank()) ? new WritingImageRef(url) : null;
                    })
                    .filter(Objects::nonNull)
                    .toList();
        }

        WritingGradingContext base = new WritingGradingContext(
                partId,
                questionId,
                partTitle,
                partInstruction,
                groupInstruction,
                taskPrompt != null ? taskPrompt : "",
                originalText != null ? originalText : "",
                learningLanguage,
                wordCount,
                images
        );
        WritingGradingContextCodec.Decoded decoded = contextCodec.decode(map);
        if (decoded.legacy() || decoded.policy() == null) return base;
        WritingLengthCounter.WritingLengthMetric metric = readLengthMetric(map.get("lengthMetric"), learningLanguage);
        return base.withPolicy(decoded.policy(), decoded.feedbackLanguage(), metric);
    }

    private WritingLengthCounter.WritingLengthMetric readLengthMetric(Object raw, String language) {
        if (!(raw instanceof Map<?, ?> metric)) return new WritingLengthCounter().count("", language);
        int value = metric.get("value") instanceof Number number ? Math.max(0, number.intValue()) : 0;
        WritingLengthCounter.Unit unit;
        try { unit = WritingLengthCounter.Unit.valueOf(String.valueOf(metric.get("unit"))); }
        catch (RuntimeException exception) { throw new IllegalArgumentException("Writing grading length metric is invalid"); }
        if (!"TV3_LENGTH_V1".equals(metric.get("policyVersion"))) throw new IllegalArgumentException("Writing grading length metric is invalid");
        return new WritingLengthCounter.WritingLengthMetric(value, unit, "TV3_LENGTH_V1");
    }
}
