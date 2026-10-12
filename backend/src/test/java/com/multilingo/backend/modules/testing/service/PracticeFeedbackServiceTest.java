package com.multilingo.backend.modules.testing.service;

import com.fasterxml.jackson.databind.node.IntNode;
import com.fasterxml.jackson.databind.node.TextNode;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.dto.request.PracticeFeedbackRequest;
import com.multilingo.backend.modules.testing.dto.response.PracticeFeedbackResponse;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.grading.GradingVerdict;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.service.support.PracticeFeedbackEvaluator;
import com.multilingo.backend.modules.testing.service.support.PracticeFeedbackRequestValidator;
import com.multilingo.backend.modules.testing.service.support.PracticeFeedbackRequestValidator.ValidatedFeedbackInput;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PracticeFeedbackServiceTest {

    @Mock
    private TestAttemptRepository testAttemptRepository;

    @Mock
    private IdentityAdapter identityAdapter;

    @Mock
    private PracticeFeedbackRequestValidator requestValidator;

    @Mock
    private PracticeFeedbackEvaluator feedbackEvaluator;

    @InjectMocks
    private PracticeFeedbackService practiceFeedbackService;

    private PracticeFeedbackRequest createRequest() {
        PracticeFeedbackRequest req = new PracticeFeedbackRequest();
        req.setPartId(new IntNode(10));
        req.setQuestionId(new TextNode("q_1"));
        req.setAnswer(new TextNode("A"));
        return req;
    }

    private TestAttempt createValidPracticeAttempt() {
        return TestAttempt.builder()
                .userId(1)
                .testMode(TestMode.PRACTICE)
                .status(AttemptStatus.IN_PROGRESS)
                .version(3)
                .resultSummary("{\"old\":\"summary\"}")
                .examSnapshot(Map.of("sections", "mock-sections"))
                .build();
    }

    @Test
    @DisplayName("Valid Practice IN_PROGRESS attempt returns evaluated feedback and does not persist")
    void getFeedback_validPracticeInProgress_success() {
        Integer attemptId = 42;
        Integer currentUserId = 1;
        TestAttempt attempt = createValidPracticeAttempt();
        attempt.setId(attemptId);

        Integer versionBefore = attempt.getVersion();
        String summaryBefore = attempt.getResultSummary();

        PracticeFeedbackRequest request = createRequest();
        ValidatedFeedbackInput validatedInput = new ValidatedFeedbackInput(10, "q_1", "A");

        PracticeFeedbackResponse expectedResponse = PracticeFeedbackResponse.builder()
                .attemptId(attemptId)
                .partId(10)
                .questionId("q_1")
                .type("SINGLE_CHOICE")
                .userAnswer("A")
                .verdict(GradingVerdict.CORRECT)
                .score(BigDecimal.ONE)
                .correctAnswer("A")
                .explanation("Good job")
                .build();

        when(identityAdapter.getCurrentUserId()).thenReturn(currentUserId);
        when(testAttemptRepository.findByIdAndUserId(attemptId, currentUserId)).thenReturn(Optional.of(attempt));
        when(requestValidator.validate(request)).thenReturn(validatedInput);
        when(feedbackEvaluator.evaluate(attemptId, attempt.getExamSnapshot(), validatedInput)).thenReturn(expectedResponse);

        PracticeFeedbackResponse actualResponse = practiceFeedbackService.getFeedback(attemptId, request);

        assertThat(actualResponse).isEqualTo(expectedResponse);

        // Required assertions
        verify(testAttemptRepository).findByIdAndUserId(attemptId, currentUserId);
        verify(testAttemptRepository, never()).save(any());
        verify(testAttemptRepository, never()).delete(any());
        assertThat(attempt.getVersion()).isEqualTo(versionBefore);
        assertThat(attempt.getResultSummary()).isEqualTo(summaryBefore);
    }

    @Test
    @DisplayName("Wrong owner or missing attempt throws FORBIDDEN and does not call evaluator")
    void getFeedback_wrongOwnerOrMissing_throwsForbidden() {
        Integer attemptId = 999;
        Integer currentUserId = 1;
        PracticeFeedbackRequest request = createRequest();

        when(identityAdapter.getCurrentUserId()).thenReturn(currentUserId);
        when(testAttemptRepository.findByIdAndUserId(attemptId, currentUserId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> practiceFeedbackService.getFeedback(attemptId, request))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN));

        verify(testAttemptRepository).findByIdAndUserId(attemptId, currentUserId);
        verify(testAttemptRepository, never()).save(any());
        verifyNoInteractions(requestValidator);
        verifyNoInteractions(feedbackEvaluator);
    }

    @ParameterizedTest
    @EnumSource(value = AttemptStatus.class)
    @DisplayName("MOCK_TEST in ANY status throws FORBIDDEN and does not call evaluator")
    void getFeedback_mockTestAnyStatus_throwsForbidden(AttemptStatus status) {
        Integer attemptId = 50;
        Integer currentUserId = 1;
        TestAttempt attempt = TestAttempt.builder()
                .userId(currentUserId)
                .testMode(TestMode.MOCK_TEST)
                .status(status)
                .build();
        attempt.setId(attemptId);

        PracticeFeedbackRequest request = createRequest();

        when(identityAdapter.getCurrentUserId()).thenReturn(currentUserId);
        when(testAttemptRepository.findByIdAndUserId(attemptId, currentUserId)).thenReturn(Optional.of(attempt));

        assertThatThrownBy(() -> practiceFeedbackService.getFeedback(attemptId, request))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN));

        verifyNoInteractions(requestValidator);
        verifyNoInteractions(feedbackEvaluator);
        verify(testAttemptRepository, never()).save(any());
    }

    @ParameterizedTest
    @EnumSource(value = AttemptStatus.class, mode = EnumSource.Mode.EXCLUDE, names = {"IN_PROGRESS"})
    @DisplayName("PRACTICE in non-IN_PROGRESS status throws ATTEMPT_ALREADY_SUBMITTED")
    void getFeedback_practiceFinalizedStatus_throwsAlreadySubmitted(AttemptStatus status) {
        Integer attemptId = 60;
        Integer currentUserId = 1;
        TestAttempt attempt = TestAttempt.builder()
                .userId(currentUserId)
                .testMode(TestMode.PRACTICE)
                .status(status)
                .build();
        attempt.setId(attemptId);

        PracticeFeedbackRequest request = createRequest();

        when(identityAdapter.getCurrentUserId()).thenReturn(currentUserId);
        when(testAttemptRepository.findByIdAndUserId(attemptId, currentUserId)).thenReturn(Optional.of(attempt));

        assertThatThrownBy(() -> practiceFeedbackService.getFeedback(attemptId, request))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode()).isEqualTo(ErrorCode.ATTEMPT_ALREADY_SUBMITTED));

        verifyNoInteractions(requestValidator);
        verifyNoInteractions(feedbackEvaluator);
        verify(testAttemptRepository, never()).save(any());
    }

    @Test
    @DisplayName("Current user ID is strictly taken from IdentityAdapter, ignoring request spoofing")
    void getFeedback_strictlyUsesIdentityAdapterUserId() {
        Integer attemptId = 70;
        Integer authenticatedUserId = 1;
        TestAttempt attempt = createValidPracticeAttempt();
        attempt.setId(attemptId);

        PracticeFeedbackRequest request = createRequest();
        ValidatedFeedbackInput validatedInput = new ValidatedFeedbackInput(10, "q_1", "A");

        when(identityAdapter.getCurrentUserId()).thenReturn(authenticatedUserId);
        when(testAttemptRepository.findByIdAndUserId(attemptId, authenticatedUserId)).thenReturn(Optional.of(attempt));
        when(requestValidator.validate(request)).thenReturn(validatedInput);
        when(feedbackEvaluator.evaluate(any(), any(), any())).thenReturn(PracticeFeedbackResponse.builder().build());

        practiceFeedbackService.getFeedback(attemptId, request);

        verify(identityAdapter).getCurrentUserId();
        verify(testAttemptRepository).findByIdAndUserId(attemptId, authenticatedUserId);
    }
}
