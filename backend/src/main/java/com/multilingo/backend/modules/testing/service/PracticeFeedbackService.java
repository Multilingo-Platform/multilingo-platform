package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.dto.request.PracticeFeedbackRequest;
import com.multilingo.backend.modules.testing.dto.response.PracticeFeedbackResponse;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.service.support.PracticeFeedbackEvaluator;
import com.multilingo.backend.modules.testing.service.support.PracticeFeedbackRequestValidator;
import com.multilingo.backend.modules.testing.service.support.PracticeFeedbackRequestValidator.ValidatedFeedbackInput;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service providing instant feedback for objective practice questions.
 * Read-only: checks ownership, mode, status, and delegates evaluation without persistence.
 */
@Service
@RequiredArgsConstructor
public class PracticeFeedbackService {

    private final TestAttemptRepository testAttemptRepository;
    private final IdentityAdapter identityAdapter;
    private final PracticeFeedbackRequestValidator requestValidator;
    private final PracticeFeedbackEvaluator feedbackEvaluator;

    /**
     * Evaluates learner's input answer against the exam snapshot and returns instant feedback.
     *
     * @param attemptId ID of the practice test attempt
     * @param request   Request payload with partId, questionId, answer
     * @return PracticeFeedbackResponse
     */
    @Transactional(readOnly = true)
    public PracticeFeedbackResponse getFeedback(Integer attemptId, PracticeFeedbackRequest request) {
        Integer currentUserId = identityAdapter.getCurrentUserId();

        TestAttempt attempt = testAttemptRepository.findByIdAndUserId(attemptId, currentUserId)
                .orElseThrow(() -> new AppException(ErrorCode.FORBIDDEN, "Attempt not found or access denied"));

        if (attempt.getTestMode() != TestMode.PRACTICE) {
            throw new AppException(ErrorCode.FORBIDDEN, "Phản hồi tức thì chỉ hỗ trợ cho chế độ PRACTICE");
        }

        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            throw new AppException(ErrorCode.ATTEMPT_ALREADY_SUBMITTED, "Bài thi đã kết thúc, không thể yêu cầu phản hồi tức thì");
        }

        ValidatedFeedbackInput validatedInput = requestValidator.validate(request);

        return feedbackEvaluator.evaluate(
                attempt.getId(),
                attempt.getExamSnapshot(),
                validatedInput
        );
    }
}
