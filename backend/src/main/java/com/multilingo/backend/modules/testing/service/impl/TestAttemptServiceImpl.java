package com.multilingo.backend.modules.testing.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.adapter.ExamAdapter;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.adapter.dto.ExamFixture;
import com.multilingo.backend.modules.testing.adapter.dto.PartFixture;
import com.multilingo.backend.modules.testing.adapter.dto.SectionFixture;
import com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest;
import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.dto.response.AutosaveVersionResponse;
import com.multilingo.backend.modules.testing.dto.response.SubmitResultResponse;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.service.TestAttemptService;
import com.multilingo.backend.modules.testing.adapter.GradingAdapter;
import com.multilingo.backend.modules.testing.grading.ObjectiveGradingService;
import com.multilingo.backend.modules.testing.grading.dto.GradingResult;
import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;
import com.multilingo.backend.modules.testing.grading.dto.QuestionGradingResult;
import com.multilingo.backend.modules.testing.dto.request.SubmitAttemptRequest;
import com.multilingo.backend.modules.testing.entity.enums.SubmitReason;
import com.multilingo.backend.modules.testing.util.SnapshotGradingKeyExtractor;
import com.multilingo.backend.modules.testing.util.WorkspaceSnapshotSanitizer;
import com.multilingo.backend.modules.testing.dto.response.ResultSummaryResponse;
import com.multilingo.backend.modules.testing.dto.response.ExamReviewResponse;
import com.multilingo.backend.modules.testing.service.support.AttemptGradingInputFactory;
import com.multilingo.backend.modules.testing.service.support.AttemptResultSummaryMapper;
import com.multilingo.backend.modules.testing.service.support.AttemptReviewMapper;
import com.multilingo.backend.modules.testing.util.AttemptDuration;
import com.multilingo.backend.modules.testing.util.AttemptResultScope;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.TransactionDefinition;

import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
public class TestAttemptServiceImpl implements TestAttemptService {

    private final TestAttemptRepository testAttemptRepository;
    private final AttemptAnswerRepository attemptAnswerRepository;
    private final ExamAdapter examAdapter;
    private final IdentityAdapter identityAdapter;
    private final ObjectMapper objectMapper;
    private final GradingAdapter gradingAdapter;
    private final ObjectiveGradingService gradingService;
    private final PlatformTransactionManager transactionManager;
    private final EntityManager entityManager;
    private final AttemptGradingInputFactory gradingInputFactory;
    private final AttemptResultSummaryMapper summaryMapper;
    private final AttemptReviewMapper reviewMapper;

    public TestAttemptServiceImpl(
            TestAttemptRepository testAttemptRepository,
            AttemptAnswerRepository attemptAnswerRepository,
            ExamAdapter examAdapter,
            IdentityAdapter identityAdapter,
            ObjectMapper objectMapper,
            GradingAdapter gradingAdapter,
            ObjectiveGradingService gradingService,
            PlatformTransactionManager transactionManager,
            EntityManager entityManager) {
        this(testAttemptRepository, attemptAnswerRepository, examAdapter, identityAdapter, objectMapper, gradingAdapter, gradingService, transactionManager, entityManager, new AttemptGradingInputFactory(), new AttemptResultSummaryMapper(objectMapper), new AttemptReviewMapper(objectMapper));
    }

    public TestAttemptServiceImpl(
            TestAttemptRepository testAttemptRepository,
            AttemptAnswerRepository attemptAnswerRepository,
            ExamAdapter examAdapter,
            IdentityAdapter identityAdapter,
            ObjectMapper objectMapper,
            GradingAdapter gradingAdapter,
            ObjectiveGradingService gradingService,
            PlatformTransactionManager transactionManager,
            EntityManager entityManager,
            AttemptGradingInputFactory gradingInputFactory) {
        this(testAttemptRepository, attemptAnswerRepository, examAdapter, identityAdapter, objectMapper, gradingAdapter, gradingService, transactionManager, entityManager, gradingInputFactory, new AttemptResultSummaryMapper(objectMapper), new AttemptReviewMapper(objectMapper));
    }

    public TestAttemptServiceImpl(
            TestAttemptRepository testAttemptRepository,
            AttemptAnswerRepository attemptAnswerRepository,
            ExamAdapter examAdapter,
            IdentityAdapter identityAdapter,
            ObjectMapper objectMapper,
            GradingAdapter gradingAdapter,
            ObjectiveGradingService gradingService,
            PlatformTransactionManager transactionManager,
            EntityManager entityManager,
            AttemptGradingInputFactory gradingInputFactory,
            AttemptResultSummaryMapper summaryMapper) {
        this(testAttemptRepository, attemptAnswerRepository, examAdapter, identityAdapter, objectMapper, gradingAdapter, gradingService, transactionManager, entityManager, gradingInputFactory, summaryMapper, new AttemptReviewMapper(objectMapper));
    }

    @org.springframework.beans.factory.annotation.Autowired
    public TestAttemptServiceImpl(
            TestAttemptRepository testAttemptRepository,
            AttemptAnswerRepository attemptAnswerRepository,
            ExamAdapter examAdapter,
            IdentityAdapter identityAdapter,
            ObjectMapper objectMapper,
            GradingAdapter gradingAdapter,
            ObjectiveGradingService gradingService,
            PlatformTransactionManager transactionManager,
            EntityManager entityManager,
            AttemptGradingInputFactory gradingInputFactory,
            AttemptResultSummaryMapper summaryMapper,
            AttemptReviewMapper reviewMapper) {
        this.testAttemptRepository = testAttemptRepository;
        this.attemptAnswerRepository = attemptAnswerRepository;
        this.examAdapter = examAdapter;
        this.identityAdapter = identityAdapter;
        this.objectMapper = objectMapper;
        this.gradingAdapter = gradingAdapter;
        this.gradingService = gradingService;
        this.transactionManager = transactionManager;
        this.entityManager = entityManager;
        this.gradingInputFactory = gradingInputFactory;
        this.summaryMapper = summaryMapper;
        this.reviewMapper = reviewMapper;
    }

    @Override
    @Transactional
    public WorkspaceResponse createAttempt(CreateAttemptRequest request) {
        Integer userId = identityAdapter.getCurrentUserId();

        // 1. Validate exam exists
        ExamFixture exam = examAdapter.findSnapshotById(request.getExamId())
                .or(() -> examAdapter.findById(request.getExamId()))
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND,
                        "Exam not found: " + request.getExamId()));

        Instant now = Instant.now();

        // 2. Validate mode/scope constraints
        Instant deadline = computeDeadline(exam, request, now);

        // 3. Build server-side exam snapshot (safe — no correct answers, filtered by scope)
        Map<String, Object> snapshot = buildExamSnapshot(exam, request);

        // 4. Persist attempt
        TestAttempt attempt = TestAttempt.builder()
                .userId(userId)
                .examId(request.getExamId())
                .testScope(request.getTestScope())
                .testMode(request.getTestMode())
                .startTime(now)
                .deadline(deadline)
                .examSnapshot(snapshot)
                .build();

        TestAttempt saved = testAttemptRepository.save(attempt);

        return toWorkspaceResponse(saved);
    }

    @Override
    @Transactional
    public WorkspaceResponse getAttemptWorkspace(Integer attemptId) {
        Integer userId = identityAdapter.getCurrentUserId();

        TestAttempt attempt = testAttemptRepository.findByIdAndUserIdForUpdate(attemptId, userId)
                .orElseThrow(() -> new AppException(ErrorCode.FORBIDDEN,
                        "Attempt not found or access denied: " + attemptId));

        Instant now = Instant.now();
        if (attempt.getTestMode() == TestMode.MOCK_TEST
                && attempt.getStatus() == AttemptStatus.IN_PROGRESS
                && attempt.getDeadline() != null
                && now.isAfter(attempt.getDeadline().plusSeconds(15))) {
            finalizeAndGradeAttempt(attempt, SubmitReason.TIMEOUT_SERVER, null, userId);
        }

        return toWorkspaceResponse(attempt);
    }

    private TestAttempt ensureFinalized(TestAttempt attempt, Integer userId) {
        if (attempt.getTestMode() == TestMode.MOCK_TEST
                && attempt.getStatus() == AttemptStatus.IN_PROGRESS
                && attempt.getDeadline() != null
                && Instant.now().isAfter(attempt.getDeadline().plusSeconds(15))) {
            
            // Lazy Finalize in a new transaction
            TransactionTemplate transactionTemplate = new TransactionTemplate(transactionManager);
            transactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            
            transactionTemplate.execute(status -> {
                TestAttempt lockedAttempt = testAttemptRepository.findByIdAndUserIdForUpdate(attempt.getId(), userId)
                        .orElseThrow(() -> new AppException(ErrorCode.FORBIDDEN, "Attempt not found"));
                if (lockedAttempt.getStatus() == AttemptStatus.IN_PROGRESS) {
                    finalizeAndGradeAttempt(lockedAttempt, SubmitReason.TIMEOUT_SERVER, null, userId);
                }
                return null;
            });
            entityManager.refresh(attempt);
            return attempt;
        }
        return attempt;
    }

    @Override
    @Transactional
    public AutosaveVersionResponse autosaveAnswers(Integer attemptId, AutosaveAnswersRequest request) {
        Integer userId = identityAdapter.getCurrentUserId();
        TestAttempt attempt = testAttemptRepository.findByIdAndUserIdForUpdate(attemptId, userId)
                .orElseThrow(() -> new AppException(ErrorCode.FORBIDDEN,
                        "Attempt not found or access denied: " + attemptId));

        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            throw new AppException(ErrorCode.ATTEMPT_ALREADY_SUBMITTED);
        }

        if (attempt.getTestMode() == TestMode.MOCK_TEST && attempt.getDeadline() != null && Instant.now().isAfter(attempt.getDeadline())) {
            throw new AppException(ErrorCode.ATTEMPT_EXPIRED);
        }

        Integer currentVersion = attempt.getVersion() != null ? attempt.getVersion() : 1;
        if (request == null || request.getVersion() == null || !request.getVersion().equals(currentVersion)) {
            throw new AppException(ErrorCode.VERSION_CONFLICT,
                    "Version conflict: current attempt version is " + currentVersion);
        }

        if (request.getAnswers() != null && !request.getAnswers().isEmpty()) {
            saveAnswersInternal(attempt, request.getAnswers());
        }

        int newVersion = currentVersion + 1;
        attempt.setVersion(newVersion);
        testAttemptRepository.save(attempt);

        return AutosaveVersionResponse.builder()
                .version(newVersion)
                .build();
    }

    @Override
    @Transactional
    public SubmitResultResponse submitAttempt(Integer attemptId, AutosaveAnswersRequest request) {
        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .baseVersion(request != null ? request.getVersion() : null)
                .finalAnswers(request != null ? request.getAnswers() : null)
                .build();
        return submitAttempt(attemptId, submitReq);
    }

    @Override
    @Transactional
    public SubmitResultResponse submitAttempt(Integer attemptId, SubmitAttemptRequest request) {
        Integer userId = identityAdapter.getCurrentUserId();
        TestAttempt attempt = testAttemptRepository.findByIdAndUserIdForUpdate(attemptId, userId)
                .orElseThrow(() -> new AppException(ErrorCode.FORBIDDEN,
                        "Attempt not found or access denied: " + attemptId));

        // Idempotency: if already finalized, return existing result without re-grading
        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            return SubmitResultResponse.from(attempt.getId(), attempt.getStatus());
        }

        Instant now = Instant.now();
        SubmitReason reason = (request != null && request.getReason() != null)
                ? request.getReason()
                : SubmitReason.MANUAL;

        if (attempt.getTestMode() == TestMode.MOCK_TEST && attempt.getDeadline() != null) {
            if (reason == SubmitReason.MANUAL && now.isAfter(attempt.getDeadline())) {
                throw new AppException(ErrorCode.ATTEMPT_EXPIRED);
            }
            if (reason == SubmitReason.TIMEOUT_CLIENT && now.isAfter(attempt.getDeadline().plusSeconds(15))) {
                // Past 15s grace window: discard payload and finalize with saved answers
                reason = SubmitReason.TIMEOUT_SERVER;
            }
        }

        List<AutosaveAnswersRequest.PartAnswerDto> finalAnswers =
                (reason != SubmitReason.TIMEOUT_SERVER && request != null) ? request.getFinalAnswers() : null;

        return finalizeAndGradeAttempt(attempt, reason, finalAnswers, userId);
    }

    @Override
    @Transactional
    public void expireAttemptBySystem(Integer attemptId) {
        TestAttempt attempt = testAttemptRepository.findByIdForUpdate(attemptId).orElse(null);
        if (attempt == null || attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            return;
        }
        if (attempt.getDeadline() == null || !Instant.now().isAfter(attempt.getDeadline())) {
            return;
        }
        finalizeAndGradeAttempt(attempt, SubmitReason.TIMEOUT_SERVER, null, attempt.getUserId());
    }

    private SubmitResultResponse finalizeAndGradeAttempt(TestAttempt attempt,
                                                         SubmitReason reason,
                                                         List<AutosaveAnswersRequest.PartAnswerDto> finalAnswers,
                                                         Integer userId) {
        Instant now = Instant.now();

        // Phase 1: Finalize (lock answers & set end_time)
        if (reason != SubmitReason.TIMEOUT_SERVER && finalAnswers != null) {
            saveAnswersInternal(attempt, finalAnswers);
        }

        Instant calculatedEndTime = (attempt.getDeadline() != null && now.isAfter(attempt.getDeadline()))
                ? attempt.getDeadline()
                : now;
        attempt.setEndTime(calculatedEndTime);
        Integer duration = AttemptDuration.calculateSeconds(attempt.getStartTime(), calculatedEndTime);
        attempt.setTimeSpentSeconds(duration != null ? duration : 0);
        attempt.setStatus(AttemptStatus.SUBMITTED);
        testAttemptRepository.save(attempt);

        // Phase 2: Grading
        try {
            List<AttemptAnswer> savedAnswers = attemptAnswerRepository.findByAttemptId(attempt.getId());
            Map<Integer, PartGradingKey> keys = SnapshotGradingKeyExtractor.extractFromSnapshot(attempt.getExamSnapshot());
            if (keys == null || keys.isEmpty()) {
                if (SnapshotGradingKeyExtractor.hasObjectiveQuestions(attempt.getExamSnapshot())) {
                    keys = gradingAdapter.loadPartKeys(attempt.getExamId());
                } else {
                    keys = Collections.emptyMap();
                }
            }
            if (keys == null) {
                keys = Collections.emptyMap();
            }

            AttemptGradingInputFactory.GradingInput input = gradingInputFactory.prepare(
                    attempt.getExamSnapshot(), savedAnswers, keys);

            GradingResult gradingResult = gradingService.gradeAttempt(input.getAnswers(), input.getPartKeys());

            // Serialize grading result before mutating or persisting any derived fields:
            String serializedSummary = objectMapper.writeValueAsString(gradingResult);

            for (AttemptAnswer aa : savedAnswers) {
                Map<String, QuestionGradingResult> partResult =
                        gradingResult.getPartResults().get(aa.getPartId());
                if (partResult != null) {
                    Map<String, Object> flags = partResult.entrySet().stream()
                            .collect(Collectors.toMap(
                                    Map.Entry::getKey,
                                    e -> (Object) e.getValue().getVerdict().name()));
                    aa.setIsCorrectFlags(flags);
                    aa.setEarnedScore(partResult.values().stream()
                            .map(QuestionGradingResult::getScore)
                            .reduce(BigDecimal.ZERO, BigDecimal::add));
                }
            }
            attemptAnswerRepository.saveAll(savedAnswers);

            attempt.setResultSummary(serializedSummary);
            attempt.setOverallScore(gradingResult.getTotalScore());
            Map<String, Object> sectionMap = new HashMap<>(gradingResult.getSectionScores());
            attempt.setSectionScores(sectionMap);

            boolean hasWriting = checkHasWriting(input.getScopedParts());
            if (hasWriting) {
                boolean hasQuota = checkAiQuota(userId);
                attempt.setStatus(hasQuota ? AttemptStatus.AI_GRADING : AttemptStatus.AI_GRADING_QUEUED);
            } else {
                attempt.setStatus(AttemptStatus.COMPLETED);
            }
            testAttemptRepository.save(attempt);
        } catch (Exception e) {
            log.error("Grading failed for attempt {}: {} - {}", attempt.getId(), e.getClass().getSimpleName(), e.getMessage(), e);
            attempt.setStatus(AttemptStatus.GRADING_FAILED);
            testAttemptRepository.save(attempt);
        }

        return SubmitResultResponse.from(attempt.getId(), attempt.getStatus());
    }

    // ─── private helpers ────────────────────────────────────────────────────────

    private boolean checkHasWriting(List<AttemptResultScope.ScopedPart> scopedParts) {
        if (scopedParts == null) return false;
        return scopedParts.stream()
                .flatMap(p -> p.getQuestions().stream())
                .anyMatch(q -> "ESSAY".equalsIgnoreCase(q.getType()));
    }

    private boolean checkAiQuota(Integer userId) {
        // Stub for Sprint 05: default true, will connect to user_quotas in Sprint 08/09
        return true;
    }

    @Override
    @Transactional
    public void lockSection(Integer attemptId, Integer sectionId) {
        Integer userId = identityAdapter.getCurrentUserId();
        TestAttempt attempt = testAttemptRepository.findByIdAndUserIdForUpdate(attemptId, userId)
                .orElseThrow(() -> new AppException(ErrorCode.FORBIDDEN, "Attempt not found or access denied"));

        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            throw new AppException(ErrorCode.ATTEMPT_ALREADY_SUBMITTED);
        }

        if (attempt.getTestMode() != TestMode.MOCK_TEST || attempt.getTestScope() != TestScope.FULL_EXAM) {
            return; // Only applies to MOCK_TEST and FULL_EXAM
        }

        List<Integer> locked = attempt.getLockedSections();
        if (locked == null) {
            locked = new java.util.ArrayList<>();
        }
        if (!locked.contains(sectionId)) {
            locked.add(sectionId);
            attempt.setLockedSections(locked);
            testAttemptRepository.save(attempt);
        }
    }

    @Override
    @Transactional
    public com.multilingo.backend.modules.testing.dto.response.ExamResultResponse getAttemptResult(Integer attemptId) {
        Integer userId = identityAdapter.getCurrentUserId();
        TestAttempt attempt = testAttemptRepository.findByIdAndUserId(attemptId, userId)
                .orElseThrow(() -> new AppException(ErrorCode.FORBIDDEN, "Attempt not found"));

        attempt = ensureFinalized(attempt, userId);

        if (attempt.getStatus() == AttemptStatus.IN_PROGRESS) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Attempt is not submitted yet");
        }

        List<AttemptAnswer> savedAnswers = attemptAnswerRepository.findByAttemptId(attempt.getId());
        ResultSummaryResponse resultSummary = summaryMapper.map(attempt, savedAnswers);
        boolean summaryAvailable = resultSummary != null;

        Integer duration = AttemptDuration.resolveDuration(attempt);
        List<com.multilingo.backend.modules.testing.dto.response.ReviewPartNavigationDto> reviewParts =
                reviewMapper != null ? reviewMapper.extractReviewParts(attempt.getExamSnapshot()) : Collections.emptyList();

        return com.multilingo.backend.modules.testing.dto.response.ExamResultResponse.builder()
                .attemptId(attempt.getId())
                .status(attempt.getStatus())
                .testScope(attempt.getTestScope())
                .testMode(attempt.getTestMode())
                .startTime(attempt.getStartTime())
                .endTime(attempt.getEndTime())
                .timeSpentSeconds(duration)
                .overallScore(attempt.getOverallScore())
                .summaryAvailable(summaryAvailable)
                .resultSummary(resultSummary)
                .reviewParts(reviewParts)
                .build();
    }

    @Override
    @Transactional
    public ExamReviewResponse getAttemptReview(Integer attemptId, Integer partId) {
        Integer userId = identityAdapter.getCurrentUserId();
        TestAttempt attempt = testAttemptRepository.findByIdAndUserId(attemptId, userId)
                .orElseThrow(() -> new AppException(ErrorCode.FORBIDDEN, "Attempt not found"));

        attempt = ensureFinalized(attempt, userId);

        if (attempt.getStatus() == AttemptStatus.IN_PROGRESS) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Attempt is not submitted yet");
        }

        AttemptReviewMapper.PartScope targetScope = reviewMapper.findPartInSnapshot(attempt.getExamSnapshot(), partId);
        if (targetScope == null) {
            throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Part not found in attempt scope: " + partId);
        }

        AttemptAnswer answer = attemptAnswerRepository.findByAttemptIdAndPartId(attemptId, partId).orElse(null);

        PartGradingKey fallbackKey = null;
        if (!hasCorrectAnswersInPart(targetScope.getPartData())
                && SnapshotGradingKeyExtractor.hasObjectiveQuestionsInPart(targetScope.getPartData())) {
            try {
                Map<Integer, PartGradingKey> keys = gradingAdapter.loadPartKeys(attempt.getExamId());
                if (keys != null) {
                    fallbackKey = keys.get(partId);
                }
            } catch (Exception ignored) {}
        }

        return reviewMapper.mapReview(attempt, targetScope, answer, fallbackKey);
    }

    @SuppressWarnings("unchecked")
    private boolean hasCorrectAnswersInPart(Map<String, Object> partData) {
        if (partData == null) return false;
        Object groupsObj = partData.get("question_groups");
        if (groupsObj == null) groupsObj = partData.get("questionGroups");
        if (groupsObj instanceof List<?> groups) {
            for (Object gObj : groups) {
                if (gObj instanceof Map<?, ?> gMap) {
                    Object qList = gMap.get("questions");
                    if (qList instanceof List<?> questions) {
                        for (Object qObj : questions) {
                            if (qObj instanceof Map<?, ?> qMap) {
                                if (qMap.containsKey("correct_answer") || qMap.containsKey("correctAnswer")) {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }
        Object qList = partData.get("questions");
        if (qList instanceof List<?> questions) {
            for (Object qObj : questions) {
                if (qObj instanceof Map<?, ?> qMap) {
                    if (qMap.containsKey("correct_answer") || qMap.containsKey("correctAnswer")) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private void saveAnswersInternal(TestAttempt attempt, List<AutosaveAnswersRequest.PartAnswerDto> answers) {
        if (answers == null) return;

        Map<Integer, Integer> partToSection = new java.util.HashMap<>();
        Map<String, Object> examSnapshot = attempt.getExamSnapshot();
        if (examSnapshot != null && examSnapshot.get("sections") instanceof java.util.List) {
            java.util.List<Map<String, Object>> sections = (java.util.List<Map<String, Object>>) examSnapshot.get("sections");
            for (Map<String, Object> section : sections) {
                Integer sId = null;
                if (section.get("id") instanceof Number) sId = ((Number) section.get("id")).intValue();
                if (section.get("section_id") instanceof Number) sId = ((Number) section.get("section_id")).intValue();
                
                Object partsObj = section.get("parts");
                if (partsObj instanceof java.util.List) {
                    java.util.List<Map<String, Object>> parts = (java.util.List<Map<String, Object>>) partsObj;
                    for (Map<String, Object> part : parts) {
                        Integer pId = null;
                        if (part.get("id") instanceof Number) pId = ((Number) part.get("id")).intValue();
                        if (part.get("part_id") instanceof Number) pId = ((Number) part.get("part_id")).intValue();
                        if (pId != null && sId != null) {
                            partToSection.put(pId, sId);
                        }
                    }
                }
            }
        }

        for (AutosaveAnswersRequest.PartAnswerDto partDto : answers) {
            if (partDto.getPartId() == null) continue;

            Integer sectionId = partToSection.get(partDto.getPartId());
            if (sectionId != null && attempt.getLockedSections() != null && attempt.getLockedSections().contains(sectionId)) {
                continue; // Skip saving answers for locked sections
            }

            Map<String, Object> qMap = new HashMap<>();
            if (partDto.getAnswers() != null) {
                for (AutosaveAnswersRequest.QuestionAnswerDto qDto : partDto.getAnswers()) {
                    if (qDto.getQuestionId() != null) {
                        qMap.put(qDto.getQuestionId(), qDto.getAnswer());
                    }
                }
            }

            AttemptAnswer answerRecord = attemptAnswerRepository
                    .findByAttemptIdAndPartId(attempt.getId(), partDto.getPartId())
                    .orElseGet(() -> AttemptAnswer.builder()
                            .attempt(attempt)
                            .partId(partDto.getPartId())
                            .build());

            answerRecord.setUserAnswers(qMap);
            attemptAnswerRepository.save(answerRecord);
        }
    }

    /**
     * Computes deadline based on scope and mode.
     * PRACTICE mode → always null.
     * MOCK_TEST + FULL_EXAM → startTime + exam.durationMinutes (must not be null).
     * MOCK_TEST + SINGLE_SKILL/PART → startTime + relevant section/part duration.
     */
    private Instant computeDeadline(ExamFixture exam, CreateAttemptRequest request, Instant startTime) {
        if (request.getTestMode() == TestMode.PRACTICE) {
            return null;
        }
        // MOCK_TEST — duration required
        Integer durationMinutes = resolveDuration(exam, request);
        if (durationMinutes == null || durationMinutes <= 0) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Cannot create MOCK_TEST attempt: exam has no configured duration");
        }
        return startTime.plus(durationMinutes, ChronoUnit.MINUTES);
    }

    private Integer resolveDuration(ExamFixture exam, CreateAttemptRequest request) {
        if (request.getTestScope() == TestScope.FULL_EXAM) {
            return exam.getDurationMinutes();
        }
        if (request.getTestScope() == TestScope.SINGLE_SKILL) {
            if (request.getTargetSectionId() == null) {
                throw new AppException(ErrorCode.INVALID_REQUEST,
                        "targetSectionId is required for SINGLE_SKILL scope");
            }
            return exam.getSections().stream()
                    .filter(s -> request.getTargetSectionId().equals(s.getId()))
                    .findFirst()
                    .map(s -> s.getDurationMinutes())
                    .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND,
                            "Section not found: " + request.getTargetSectionId()));
        }
        if (request.getTestScope() == TestScope.SINGLE_PART) {
            if (request.getTargetPartId() == null) {
                throw new AppException(ErrorCode.INVALID_REQUEST,
                        "targetPartId is required for SINGLE_PART scope");
            }
            SectionFixture containingSection = findSectionContainingPart(exam, request.getTargetPartId());
            if (containingSection == null) {
                throw new AppException(ErrorCode.RESOURCE_NOT_FOUND,
                        "Part not found: " + request.getTargetPartId());
            }
            return containingSection.getDurationMinutes();
        }
        return exam.getDurationMinutes();
    }

    private SectionFixture findSectionContainingPart(ExamFixture exam, Integer partId) {
        if (exam == null || exam.getSections() == null || partId == null) {
            return null;
        }
        for (SectionFixture section : exam.getSections()) {
            if (section != null && section.getParts() != null) {
                for (PartFixture part : section.getParts()) {
                    if (part != null && partId.equals(part.getId())) {
                        return section;
                    }
                }
            }
        }
        return null;
    }

    /**
     * Builds an exam snapshot safe to store and return to client.
     * Uses ObjectMapper to convert ExamFixture → Map, which strips any fields
     * not present in the DTO (correct_answer, explanation are never in ExamFixture).
     * Filters sections and parts based on testScope (SINGLE_SKILL or SINGLE_PART).
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> buildExamSnapshot(ExamFixture exam, CreateAttemptRequest request) {
        if (request.getTestScope() == TestScope.FULL_EXAM) {
            return objectMapper.convertValue(exam, Map.class);
        }

        // Deep copy / clone via Jackson
        ExamFixture cloned = objectMapper.convertValue(
                objectMapper.convertValue(exam, Map.class), ExamFixture.class);

        if (request.getTestScope() == TestScope.SINGLE_SKILL) {
            SectionFixture targetSection = cloned.getSections().stream()
                    .filter(s -> request.getTargetSectionId().equals(s.getId()))
                    .findFirst()
                    .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND,
                            "Section not found: " + request.getTargetSectionId()));

            cloned.setSections(List.of(targetSection));
            cloned.setDurationMinutes(targetSection.getDurationMinutes());
            return objectMapper.convertValue(cloned, Map.class);
        }

        if (request.getTestScope() == TestScope.SINGLE_PART) {
            if (cloned.getSections() != null) {
                for (SectionFixture section : cloned.getSections()) {
                    if (section != null && section.getParts() != null) {
                        for (PartFixture part : section.getParts()) {
                            if (part != null && request.getTargetPartId().equals(part.getId())) {
                                Integer sectionDuration = section.getDurationMinutes();
                                section.setParts(List.of(part));
                                section.setDurationMinutes(sectionDuration);
                                cloned.setSections(List.of(section));
                                cloned.setDurationMinutes(sectionDuration);
                                return objectMapper.convertValue(cloned, Map.class);
                            }
                        }
                    }
                }
            }
            throw new AppException(ErrorCode.RESOURCE_NOT_FOUND,
                    "Part not found: " + request.getTargetPartId());
        }

        return objectMapper.convertValue(exam, Map.class);
    }

    private WorkspaceResponse toWorkspaceResponse(TestAttempt attempt) {
        List<AutosaveAnswersRequest.PartAnswerDto> savedAnswers = loadSavedAnswers(attempt.getId());
        Map<String, Object> sanitizedSnapshot = WorkspaceSnapshotSanitizer.sanitize(attempt.getExamSnapshot());
        Instant serverTime = Instant.now();

        return WorkspaceResponse.builder()
                .attemptId(attempt.getId())
                .status(attempt.getStatus())
                .testScope(attempt.getTestScope())
                .testMode(attempt.getTestMode())
                .startTime(attempt.getStartTime())
                .deadline(attempt.getDeadline())
                .serverTime(serverTime)
                .gracePeriodSeconds(15)
                .version(attempt.getVersion())
                .savedAnswers(savedAnswers)
                .examSnapshot(sanitizedSnapshot)
                .lockedSections(attempt.getLockedSections() != null ? attempt.getLockedSections() : new java.util.ArrayList<>())
                .build();
    }

    private List<AutosaveAnswersRequest.PartAnswerDto> loadSavedAnswers(Integer attemptId) {
        return attemptAnswerRepository.findByAttemptId(attemptId).stream()
                .sorted(Comparator.comparing(AttemptAnswer::getPartId))
                .map(saved -> AutosaveAnswersRequest.PartAnswerDto.builder()
                        .partId(saved.getPartId())
                        .answers(saved.getUserAnswers() == null
                                ? List.of()
                                : saved.getUserAnswers().entrySet().stream()
                                        .map(entry -> AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                .questionId(entry.getKey())
                                                .answer(entry.getValue())
                                                .build())
                                        .toList())
                        .build())
                .toList();
    }
}
