package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest;
import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.dto.response.SubmitResultResponse;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;

import com.multilingo.backend.modules.testing.dto.request.SubmitAttemptRequest;

public interface TestAttemptService {

    /**
     * Creates a new test attempt.
     * Validates exam exists, scope/mode constraints, calculates deadline, snapshots exam.
     * userId is resolved from IdentityAdapter — NOT from request.
     *
     * @throws AppException(RESOURCE_NOT_FOUND) if examId doesn't exist
     * @throws AppException(INVALID_REQUEST) if MOCK_TEST has zero/null duration
     * @throws AppException(INVALID_REQUEST) if SINGLE_SKILL missing targetSectionId or SINGLE_PART missing targetPartId
     */
    WorkspaceResponse createAttempt(CreateAttemptRequest request);

    /**
     * Returns the workspace for an existing attempt.
     * Ownership check: only the attempt's owner can read it.
     *
     * @throws AppException(FORBIDDEN) if attemptId exists but belongs to another user (or doesn't exist)
     */
    WorkspaceResponse getAttemptWorkspace(Integer attemptId);

    /**
     * Autosaves draft answers for an attempt.
     * Upserts answers into attempt_answers table per partId.
     */
    void autosaveAnswers(Integer attemptId, AutosaveAnswersRequest request);

    /**
     * Submits an attempt with full SubmitAttemptRequest (reason, version, final answers).
     */
    SubmitResultResponse submitAttempt(Integer attemptId, SubmitAttemptRequest request);

    /**
     * Submits an attempt (legacy backward-compatible overload).
     * Idempotent: if already completed, returns existing result.
     */
    SubmitResultResponse submitAttempt(Integer attemptId, AutosaveAnswersRequest request);

    /**
     * System-triggered expiration for attempts past deadline.
     * Uses TIMEOUT_SERVER reason and runs through grading pipeline.
     */
    void expireAttemptBySystem(Integer attemptId);
}

