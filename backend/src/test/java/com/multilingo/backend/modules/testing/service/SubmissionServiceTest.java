package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.dto.request.SubmitAttemptRequest;
import com.multilingo.backend.modules.testing.dto.response.SubmitResultResponse;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.SubmitReason;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.grading.ObjectiveGradingService;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SubmissionServiceTest {

    @Autowired
    private TestAttemptService testAttemptService;

    @Autowired
    private TestAttemptRepository testAttemptRepository;

    @MockBean
    private ObjectiveGradingService objectiveGradingService;

    @Test
    void submitAttempt_gradingFails_statusIsGradingFailed() {
        // Arrange
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(1);
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);

        when(objectiveGradingService.gradeAttempt(any(), any()))
                .thenThrow(new RuntimeException("Grading engine failure"));

        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();

        // Act
        SubmitResultResponse response = testAttemptService.submitAttempt(workspace.getAttemptId(), submitReq);

        // Assert
        assertThat(response.getStatus()).isEqualTo(AttemptStatus.GRADING_FAILED);

        TestAttempt attempt = testAttemptRepository.findById(workspace.getAttemptId()).orElseThrow();
        assertThat(attempt.getStatus()).isEqualTo(AttemptStatus.GRADING_FAILED);
        assertThat(attempt.getEndTime()).isNotNull();
    }

    @Test
    void submitAttempt_concurrentRequests_idempotent() throws Exception {
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(1);
        createReq.setTestScope(TestScope.SINGLE_SKILL);
        createReq.setTargetSectionId(1);
        createReq.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);

        org.mockito.Mockito.reset(objectiveGradingService);
        when(objectiveGradingService.gradeAttempt(any(), any())).thenReturn(
                com.multilingo.backend.modules.testing.grading.dto.GradingResult.builder()
                        .totalScore(java.math.BigDecimal.TEN)
                        .partResults(java.util.Map.of())
                        .sectionScores(java.util.Map.of())
                        .build()
        );

        // Verify findByIdForUpdate exists
        java.util.Optional<TestAttempt> locked = testAttemptRepository.findByIdForUpdate(workspace.getAttemptId());
        assertThat(locked).isPresent();

        SubmitAttemptRequest submitReq1 = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();
        SubmitAttemptRequest submitReq2 = SubmitAttemptRequest.builder()
                .reason(SubmitReason.TIMEOUT_CLIENT)
                .build();

        SubmitResultResponse r1 = testAttemptService.submitAttempt(workspace.getAttemptId(), submitReq1);
        SubmitResultResponse r2 = testAttemptService.submitAttempt(workspace.getAttemptId(), submitReq2);

        assertThat(r1.getStatus()).isEqualTo(AttemptStatus.COMPLETED);
        assertThat(r2.getStatus()).isEqualTo(AttemptStatus.COMPLETED);

        TestAttempt attempt = testAttemptRepository.findById(workspace.getAttemptId()).orElseThrow();
        assertThat(attempt.getEndTime()).isNotNull();
    }

    @Test
    void autosave_afterDeadline_throwsExpired() {
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(1);
        createReq.setTestScope(TestScope.SINGLE_SKILL);
        createReq.setTargetSectionId(1);
        createReq.setTestMode(TestMode.MOCK_TEST);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);

        TestAttempt attempt = testAttemptRepository.findById(workspace.getAttemptId()).orElseThrow();
        attempt.setDeadline(java.time.Instant.now().minusSeconds(10));
        testAttemptRepository.save(attempt);

        com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest saveReq =
                com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest.builder()
                        .version(1)
                        .answers(java.util.Collections.emptyList())
                        .build();

        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
                testAttemptService.autosaveAnswers(workspace.getAttemptId(), saveReq))
                .isInstanceOf(com.multilingo.backend.common.exception.AppException.class)
                .satisfies(e -> {
                    com.multilingo.backend.common.exception.AppException appEx = (com.multilingo.backend.common.exception.AppException) e;
                    assertThat(appEx.getErrorCode()).isEqualTo(com.multilingo.backend.common.exception.ErrorCode.ATTEMPT_EXPIRED);
                });
    }

    @Test
    void submit_manualAfterDeadline_throwsExpired() {
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(1);
        createReq.setTestScope(TestScope.SINGLE_SKILL);
        createReq.setTargetSectionId(1);
        createReq.setTestMode(TestMode.MOCK_TEST);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);

        TestAttempt attempt = testAttemptRepository.findById(workspace.getAttemptId()).orElseThrow();
        attempt.setDeadline(java.time.Instant.now().minusSeconds(5));
        testAttemptRepository.save(attempt);

        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();

        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
                testAttemptService.submitAttempt(workspace.getAttemptId(), submitReq))
                .isInstanceOf(com.multilingo.backend.common.exception.AppException.class)
                .satisfies(e -> {
                    com.multilingo.backend.common.exception.AppException appEx = (com.multilingo.backend.common.exception.AppException) e;
                    assertThat(appEx.getErrorCode()).isEqualTo(com.multilingo.backend.common.exception.ErrorCode.ATTEMPT_EXPIRED);
                });
    }

    @Test
    void submit_timeoutClientInGraceWindow_success() {
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(1);
        createReq.setTestScope(TestScope.SINGLE_SKILL);
        createReq.setTargetSectionId(1);
        createReq.setTestMode(TestMode.MOCK_TEST);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);

        TestAttempt attempt = testAttemptRepository.findById(workspace.getAttemptId()).orElseThrow();
        attempt.setDeadline(java.time.Instant.now().minusSeconds(5)); // 5s past deadline, <= 15s grace window
        testAttemptRepository.save(attempt);

        org.mockito.Mockito.reset(objectiveGradingService);
        when(objectiveGradingService.gradeAttempt(any(), any())).thenReturn(
                com.multilingo.backend.modules.testing.grading.dto.GradingResult.builder()
                        .totalScore(java.math.BigDecimal.TEN)
                        .partResults(java.util.Map.of())
                        .sectionScores(java.util.Map.of())
                        .build()
        );

        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.TIMEOUT_CLIENT)
                .build();

        SubmitResultResponse response = testAttemptService.submitAttempt(workspace.getAttemptId(), submitReq);
        assertThat(response.getStatus()).isEqualTo(AttemptStatus.COMPLETED);
    }

    @Test
    void gradeAttempt_withWriting_statusAiGrading() {
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(1);
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);

        // Inject writing section into examSnapshot of attempt
        TestAttempt attempt = testAttemptRepository.findById(workspace.getAttemptId()).orElseThrow();
        java.util.Map<String, Object> snapshot = new java.util.HashMap<>(attempt.getExamSnapshot());
        snapshot.put("sections", java.util.List.of(
                java.util.Map.of("name", "Reading"),
                java.util.Map.of("name", "Writing Task 1")
        ));
        attempt.setExamSnapshot(snapshot);
        testAttemptRepository.save(attempt);

        org.mockito.Mockito.reset(objectiveGradingService);
        when(objectiveGradingService.gradeAttempt(any(), any())).thenReturn(
                com.multilingo.backend.modules.testing.grading.dto.GradingResult.builder()
                        .totalScore(java.math.BigDecimal.TEN)
                        .partResults(java.util.Map.of())
                        .sectionScores(java.util.Map.of())
                        .build()
        );

        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();

        SubmitResultResponse response = testAttemptService.submitAttempt(workspace.getAttemptId(), submitReq);
        assertThat(response.getStatus()).isEqualTo(AttemptStatus.AI_GRADING);

        TestAttempt submittedAttempt = testAttemptRepository.findById(workspace.getAttemptId()).orElseThrow();
        assertThat(submittedAttempt.getStatus()).isEqualTo(AttemptStatus.AI_GRADING);
    }

    @Test
    void getWorkspace_pastDeadline_triggersLazyFinalize() {
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(1);
        createReq.setTestScope(TestScope.SINGLE_SKILL);
        createReq.setTargetSectionId(1);
        createReq.setTestMode(TestMode.MOCK_TEST);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);

        // Set deadline to 20 seconds ago (accounts for 15s grace period)
        TestAttempt attempt = testAttemptRepository.findById(workspace.getAttemptId()).orElseThrow();
        Instant pastDeadline = Instant.now().minusSeconds(20).truncatedTo(java.time.temporal.ChronoUnit.MILLIS);
        attempt.setDeadline(pastDeadline);
        testAttemptRepository.saveAndFlush(attempt);
        
        org.springframework.test.context.transaction.TestTransaction.flagForCommit();
        org.springframework.test.context.transaction.TestTransaction.end();
        org.springframework.test.context.transaction.TestTransaction.start();

        when(objectiveGradingService.gradeAttempt(any(), any())).thenReturn(
                com.multilingo.backend.modules.testing.grading.dto.GradingResult.builder()
                        .totalScore(java.math.BigDecimal.TEN)
                        .partResults(java.util.Map.of())
                        .sectionScores(java.util.Map.of())
                        .build()
        );

        WorkspaceResponse response = testAttemptService.getAttemptWorkspace(workspace.getAttemptId());

        assertThat(response.getStatus()).isNotEqualTo(AttemptStatus.IN_PROGRESS);
        assertThat(response.getStatus()).isEqualTo(AttemptStatus.COMPLETED);
        
        org.springframework.test.context.transaction.TestTransaction.flagForCommit();
        org.springframework.test.context.transaction.TestTransaction.end();
        org.springframework.test.context.transaction.TestTransaction.start();

        TestAttempt updatedAttempt = testAttemptRepository.findById(workspace.getAttemptId()).orElseThrow();
        assertThat(updatedAttempt.getStatus()).isEqualTo(AttemptStatus.COMPLETED);
        assertThat(updatedAttempt.getEndTime()).isBeforeOrEqualTo(pastDeadline);
    }

    @Test
    void expireAttemptBySystem_finalizesExpiredAttempt() {
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(1);
        createReq.setTestScope(TestScope.SINGLE_SKILL);
        createReq.setTargetSectionId(1);
        createReq.setTestMode(TestMode.MOCK_TEST);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);

        // Set deadline to 30 seconds ago
        TestAttempt attempt = testAttemptRepository.findById(workspace.getAttemptId()).orElseThrow();
        Instant pastDeadline = Instant.now().minusSeconds(30);
        attempt.setDeadline(pastDeadline);
        testAttemptRepository.save(attempt);

        when(objectiveGradingService.gradeAttempt(any(), any())).thenReturn(
                com.multilingo.backend.modules.testing.grading.dto.GradingResult.builder()
                        .totalScore(java.math.BigDecimal.TEN)
                        .partResults(java.util.Map.of())
                        .sectionScores(java.util.Map.of())
                        .build()
        );

        testAttemptService.expireAttemptBySystem(workspace.getAttemptId());

        TestAttempt updatedAttempt = testAttemptRepository.findById(workspace.getAttemptId()).orElseThrow();
        assertThat(updatedAttempt.getStatus()).isEqualTo(AttemptStatus.COMPLETED);
        assertThat(updatedAttempt.getEndTime()).isBeforeOrEqualTo(pastDeadline);
    }
}


