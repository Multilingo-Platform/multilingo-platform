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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TestAttemptServiceImpl implements TestAttemptService {

    private final TestAttemptRepository testAttemptRepository;
    private final AttemptAnswerRepository attemptAnswerRepository;
    private final ExamAdapter examAdapter;
    private final IdentityAdapter identityAdapter;
    private final ObjectMapper objectMapper;
    private final GradingAdapter gradingAdapter;
    private final ObjectiveGradingService gradingService;

    @Override
    @Transactional
    public WorkspaceResponse createAttempt(CreateAttemptRequest request) {
        Integer userId = identityAdapter.getCurrentUserId();

        // 1. Validate exam exists
        ExamFixture exam = examAdapter.findById(request.getExamId())
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
    @Transactional(readOnly = true)
    public WorkspaceResponse getAttemptWorkspace(Integer attemptId) {
        Integer userId = identityAdapter.getCurrentUserId();

        // Ownership check: returns empty if attempt doesn't exist OR belongs to another user
        TestAttempt attempt = testAttemptRepository.findByIdAndUserId(attemptId, userId)
                .orElseThrow(() -> new AppException(ErrorCode.FORBIDDEN,
                        "Attempt not found or access denied: " + attemptId));

        return toWorkspaceResponse(attempt);
    }

    @Override
    @Transactional
    public void autosaveAnswers(Integer attemptId, AutosaveAnswersRequest request) {
        Integer userId = identityAdapter.getCurrentUserId();
        TestAttempt attempt = testAttemptRepository.findByIdAndUserId(attemptId, userId)
                .orElseThrow(() -> new AppException(ErrorCode.FORBIDDEN,
                        "Attempt not found or access denied: " + attemptId));

        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            return;
        }

        if (request.getAnswers() != null) {
            for (AutosaveAnswersRequest.PartAnswerDto partDto : request.getAnswers()) {
                if (partDto.getPartId() == null) continue;

                Map<String, Object> qMap = new HashMap<>();
                if (partDto.getAnswers() != null) {
                    for (AutosaveAnswersRequest.QuestionAnswerDto qDto : partDto.getAnswers()) {
                        if (qDto.getQuestionId() != null) {
                            qMap.put(qDto.getQuestionId(), qDto.getAnswer());
                        }
                    }
                }

                AttemptAnswer answerRecord = attemptAnswerRepository
                        .findByAttemptIdAndPartId(attemptId, partDto.getPartId())
                        .orElseGet(() -> AttemptAnswer.builder()
                                .attempt(attempt)
                                .partId(partDto.getPartId())
                                .build());

                answerRecord.setUserAnswers(qMap);
                attemptAnswerRepository.save(answerRecord);
            }
        }
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
        TestAttempt attempt = testAttemptRepository.findByIdAndUserId(attemptId, userId)
                .orElseThrow(() -> new AppException(ErrorCode.FORBIDDEN,
                        "Attempt not found or access denied: " + attemptId));

        // Idempotency: if already finalized, return existing result without re-grading
        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            return SubmitResultResponse.from(attempt.getId(), attempt.getStatus());
        }

        // Phase 1: Finalize (lock answers & set end_time)
        if (request != null && request.getFinalAnswers() != null) {
            AutosaveAnswersRequest saveReq = AutosaveAnswersRequest.builder()
                    .version(request.getBaseVersion() != null ? request.getBaseVersion() : 1)
                    .answers(request.getFinalAnswers())
                    .build();
            autosaveAnswers(attemptId, saveReq);
        }

        Instant now = Instant.now();
        Instant calculatedEndTime = (attempt.getDeadline() != null && now.isAfter(attempt.getDeadline()))
                ? attempt.getDeadline()
                : now;
        attempt.setEndTime(calculatedEndTime);
        attempt.setStatus(AttemptStatus.SUBMITTED);
        testAttemptRepository.save(attempt);

        // Phase 2: Grading
        try {
            List<AttemptAnswer> savedAnswers = attemptAnswerRepository.findByAttemptId(attemptId);
            Map<Integer, PartGradingKey> keys = gradingAdapter.loadPartKeys(attempt.getExamId());
            GradingResult gradingResult = gradingService.gradeAttempt(savedAnswers, keys);

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

            attempt.setOverallScore(gradingResult.getTotalScore());
            Map<String, Object> sectionMap = new HashMap<>(gradingResult.getSectionScores());
            attempt.setSectionScores(sectionMap);

            attempt.setStatus(AttemptStatus.COMPLETED);
            testAttemptRepository.save(attempt);
        } catch (Exception e) {
            log.error("Grading failed for attempt {}: {}", attemptId, e.getMessage(), e);
            attempt.setStatus(AttemptStatus.GRADING_FAILED);
            testAttemptRepository.save(attempt);
        }

        return SubmitResultResponse.from(attempt.getId(), attempt.getStatus());
    }

    // ─── private helpers ────────────────────────────────────────────────────────

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
            return exam.getSections().stream()
                    .flatMap(s -> s.getParts().stream())
                    .filter(p -> request.getTargetPartId().equals(p.getId()))
                    .findFirst()
                    .map(p -> p.getDurationMinutes())
                    .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND,
                            "Part not found: " + request.getTargetPartId()));
        }
        return exam.getDurationMinutes();
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
            for (SectionFixture section : cloned.getSections()) {
                for (PartFixture part : section.getParts()) {
                    if (request.getTargetPartId().equals(part.getId())) {
                        section.setParts(List.of(part));
                        section.setDurationMinutes(part.getDurationMinutes());
                        cloned.setSections(List.of(section));
                        cloned.setDurationMinutes(part.getDurationMinutes());
                        return objectMapper.convertValue(cloned, Map.class);
                    }
                }
            }
            throw new AppException(ErrorCode.RESOURCE_NOT_FOUND,
                    "Part not found: " + request.getTargetPartId());
        }

        return objectMapper.convertValue(exam, Map.class);
    }

    private WorkspaceResponse toWorkspaceResponse(TestAttempt attempt) {
        return WorkspaceResponse.builder()
                .attemptId(attempt.getId())
                .status(attempt.getStatus())
                .testScope(attempt.getTestScope())
                .testMode(attempt.getTestMode())
                .startTime(attempt.getStartTime())
                .deadline(attempt.getDeadline())
                .serverTime(Instant.now())
                .gracePeriodSeconds(15)
                .examSnapshot(attempt.getExamSnapshot())
                .build();
    }
}
