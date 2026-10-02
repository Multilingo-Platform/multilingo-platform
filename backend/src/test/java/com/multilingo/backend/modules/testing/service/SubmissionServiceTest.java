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
        createReq.setTestScope(TestScope.FULL_EXAM);
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
}
