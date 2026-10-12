package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.common.FixtureAdaptersTestConfig;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest;
import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.dto.request.SubmitAttemptRequest;
import com.multilingo.backend.modules.testing.dto.response.SubmitResultResponse;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.SubmitReason;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = "spring.main.allow-bean-definition-overriding=true")
@Import(FixtureAdaptersTestConfig.class)
@ActiveProfiles("test")
@Transactional
public class TestAttemptGracePeriodTest {

    @Autowired
    private TestAttemptService testAttemptService;

    @Autowired
    private TestAttemptRepository testAttemptRepository;

    @Autowired
    private AttemptAnswerRepository attemptAnswerRepository;

    private Integer createMockAttempt(Instant deadline) {
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(1);
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.MOCK_TEST);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);

        TestAttempt attempt = testAttemptRepository.findById(workspace.getAttemptId()).orElseThrow();
        attempt.setDeadline(deadline);
        testAttemptRepository.save(attempt);

        return attempt.getId();
    }

    @Test
    void submitAttempt_manualAfterDeadline_throwsAttemptExpired() {
        // Arrange: deadline was 5 seconds ago
        Instant deadline = Instant.now().minusSeconds(5);
        Integer attemptId = createMockAttempt(deadline);

        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();

        // Act & Assert
        assertThatThrownBy(() -> testAttemptService.submitAttempt(attemptId, submitReq))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.ATTEMPT_EXPIRED);
    }

    @Test
    void autosaveAnswers_afterDeadline_throwsAttemptExpired() {
        // Arrange: deadline was 2 seconds ago
        Instant deadline = Instant.now().minusSeconds(2);
        Integer attemptId = createMockAttempt(deadline);

        AutosaveAnswersRequest autosaveReq = new AutosaveAnswersRequest();
        autosaveReq.setVersion(1);
        autosaveReq.setAnswers(Collections.emptyList());

        // Act & Assert
        assertThatThrownBy(() -> testAttemptService.autosaveAnswers(attemptId, autosaveReq))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.ATTEMPT_EXPIRED);
    }

    @Test
    void submitAttempt_timeoutClient_within15sGrace_acceptsFinalAnswers_andCapsEndTimeAtDeadline() {
        // Arrange: deadline was 5 seconds ago (within 15s grace)
        Instant deadline = Instant.now().minusSeconds(5);
        Integer attemptId = createMockAttempt(deadline);

        AutosaveAnswersRequest.QuestionAnswerDto qAnswer = AutosaveAnswersRequest.QuestionAnswerDto.builder()
                .questionId("q1")
                .answer("C")
                .build();
        AutosaveAnswersRequest.PartAnswerDto partAnswer = AutosaveAnswersRequest.PartAnswerDto.builder()
                .partId(10)
                .answers(List.of(qAnswer))
                .build();

        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.TIMEOUT_CLIENT)
                .baseVersion(1)
                .finalAnswers(List.of(partAnswer))
                .build();

        // Act
        SubmitResultResponse response = testAttemptService.submitAttempt(attemptId, submitReq);

        // Assert
        assertThat(response.getStatus()).isIn(AttemptStatus.SUBMITTED, AttemptStatus.COMPLETED, AttemptStatus.AI_GRADING);

        TestAttempt finalizedAttempt = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(finalizedAttempt.getEndTime()).isEqualTo(deadline);
        assertThat(finalizedAttempt.getStatus()).isIn(AttemptStatus.SUBMITTED, AttemptStatus.COMPLETED, AttemptStatus.AI_GRADING);

        List<AttemptAnswer> answers = attemptAnswerRepository.findByAttemptId(attemptId);
        assertThat(answers).isNotEmpty();
        AttemptAnswer p10 = answers.stream().filter(a -> a.getPartId().equals(10)).findFirst().orElseThrow();
        assertThat(p10.getUserAnswers()).containsEntry("q1", "C");
    }

    @Test
    void submitAttempt_timeoutClient_past15sGrace_discardsFinalAnswers_andFinalizesWithSavedAnswers() {
        // Arrange: pre-save answer "A", then set deadline 20 seconds ago (past 15s grace)
        Instant futureDeadline = Instant.now().plusSeconds(60);
        Integer attemptId = createMockAttempt(futureDeadline);

        AutosaveAnswersRequest.QuestionAnswerDto qInitial = AutosaveAnswersRequest.QuestionAnswerDto.builder()
                .questionId("q1")
                .answer("A")
                .build();
        AutosaveAnswersRequest.PartAnswerDto initialAnswer = AutosaveAnswersRequest.PartAnswerDto.builder()
                .partId(10)
                .answers(List.of(qInitial))
                .build();
        testAttemptService.autosaveAnswers(attemptId, new AutosaveAnswersRequest(1, List.of(initialAnswer)));

        // Now shift deadline into the past beyond grace
        Instant pastGraceDeadline = Instant.now().minusSeconds(20);
        TestAttempt attempt = testAttemptRepository.findById(attemptId).orElseThrow();
        attempt.setDeadline(pastGraceDeadline);
        testAttemptRepository.save(attempt);

        // Attempt submits late with answer "B"
        AutosaveAnswersRequest.QuestionAnswerDto qLate = AutosaveAnswersRequest.QuestionAnswerDto.builder()
                .questionId("q1")
                .answer("B")
                .build();
        AutosaveAnswersRequest.PartAnswerDto lateAnswer = AutosaveAnswersRequest.PartAnswerDto.builder()
                .partId(10)
                .answers(List.of(qLate))
                .build();

        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.TIMEOUT_CLIENT)
                .baseVersion(2)
                .finalAnswers(List.of(lateAnswer))
                .build();

        // Act
        SubmitResultResponse response = testAttemptService.submitAttempt(attemptId, submitReq);

        // Assert
        assertThat(response.getStatus()).isIn(AttemptStatus.SUBMITTED, AttemptStatus.COMPLETED, AttemptStatus.AI_GRADING);

        TestAttempt finalizedAttempt = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(finalizedAttempt.getEndTime()).isEqualTo(pastGraceDeadline);
        assertThat(finalizedAttempt.getStatus()).isIn(AttemptStatus.SUBMITTED, AttemptStatus.COMPLETED, AttemptStatus.AI_GRADING);

        // The late answer "B" was discarded; existing saved answer "A" remains
        List<AttemptAnswer> answers = attemptAnswerRepository.findByAttemptId(attemptId);
        AttemptAnswer p10 = answers.stream().filter(a -> a.getPartId().equals(10)).findFirst().orElseThrow();
        assertThat(p10.getUserAnswers()).containsEntry("q1", "A");
    }

    @Test
    void submitAttempt_repeatedCall_isIdempotent() {
        // Arrange
        Instant futureDeadline = Instant.now().plusSeconds(3600);
        Integer attemptId = createMockAttempt(futureDeadline);

        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();

        // Act: first submit
        SubmitResultResponse firstResult = testAttemptService.submitAttempt(attemptId, submitReq);
        // Second submit
        SubmitResultResponse secondResult = testAttemptService.submitAttempt(attemptId, submitReq);

        // Assert
        assertThat(firstResult.getAttemptId()).isEqualTo(attemptId);
        assertThat(secondResult.getAttemptId()).isEqualTo(attemptId);
        assertThat(firstResult.getStatus()).isEqualTo(secondResult.getStatus());
    }
}
