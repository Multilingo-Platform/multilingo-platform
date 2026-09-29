package com.multilingo.backend.modules.testing.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.adapter.ExamAdapter;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.adapter.dto.ExamFixture;
import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.service.TestAttemptService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TestAttemptServiceImpl implements TestAttemptService {

    private final TestAttemptRepository testAttemptRepository;
    private final ExamAdapter examAdapter;
    private final IdentityAdapter identityAdapter;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public WorkspaceResponse createAttempt(CreateAttemptRequest request) {
        Integer userId = identityAdapter.getCurrentUserId();

        // 1. Validate exam exists
        ExamFixture exam = examAdapter.findById(request.getExamId())
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND,
                        "Exam not found: " + request.getExamId()));

        // 2. Validate mode/scope constraints
        Instant deadline = computeDeadline(exam, request);

        // 3. Build server-side exam snapshot (safe — no correct answers)
        Map<String, Object> snapshot = buildExamSnapshot(exam);

        // 4. Persist attempt
        Instant now = Instant.now();
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

    // ─── private helpers ────────────────────────────────────────────────────────

    /**
     * Computes deadline based on scope and mode.
     * PRACTICE mode → always null.
     * MOCK_TEST + FULL_EXAM → startTime + exam.durationMinutes (must not be null).
     * MOCK_TEST + SINGLE_SKILL/PART → startTime + relevant section/part duration.
     */
    private Instant computeDeadline(ExamFixture exam, CreateAttemptRequest request) {
        if (request.getTestMode() == TestMode.PRACTICE) {
            return null;
        }
        // MOCK_TEST — duration required
        Integer durationMinutes = resolveDuration(exam, request);
        if (durationMinutes == null || durationMinutes <= 0) {
            throw new AppException(ErrorCode.INVALID_REQUEST,
                    "Cannot create MOCK_TEST attempt: exam has no configured duration");
        }
        return Instant.now().plus(durationMinutes, ChronoUnit.MINUTES);
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
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> buildExamSnapshot(ExamFixture exam) {
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
                .examSnapshot(attempt.getExamSnapshot())
                .build();
    }
}
