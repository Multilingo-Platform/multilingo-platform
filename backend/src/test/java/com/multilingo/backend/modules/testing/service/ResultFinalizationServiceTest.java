package com.multilingo.backend.modules.testing.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.FixtureAdaptersTestConfig;
import com.multilingo.backend.modules.testing.adapter.GradingAdapter;
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
import com.multilingo.backend.modules.testing.grading.GradingVerdict;
import com.multilingo.backend.modules.testing.grading.ObjectiveGradingService;
import com.multilingo.backend.modules.testing.grading.dto.GradingKey;
import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

@SpringBootTest(properties = "spring.main.allow-bean-definition-overriding=true")
@Import(FixtureAdaptersTestConfig.class)
@ActiveProfiles("test")
@Transactional
class ResultFinalizationServiceTest {

    @Autowired
    private TestAttemptService testAttemptService;

    @Autowired
    private TestAttemptRepository testAttemptRepository;

    @Autowired
    private AttemptAnswerRepository attemptAnswerRepository;

    @SpyBean
    private ObjectMapper objectMapper;

    @MockBean
    private GradingAdapter gradingAdapter;

    @Autowired
    private ObjectiveGradingService objectiveGradingService;

    private PartGradingKey createPartKey(int partId, String qId, String type, Object correct) {
        PartGradingKey pgk = new PartGradingKey();
        pgk.setPartId(partId);
        pgk.setSectionName("Section " + partId);
        GradingKey key = new GradingKey();
        key.setQuestionId(qId);
        key.setType(type);
        key.setCorrect(correct);
        pgk.setAnswers(new HashMap<>(Map.of(qId, key)));
        return pgk;
    }

    @Test
    @DisplayName("Untouched part should receive BLANK verdicts for all objective questions, without creating synthetic DB answer rows")
    void finalize_withUntouchedPart_allQuestionsBlankAndNoSyntheticRowsPersisted() throws Exception {
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(1);
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();

        TestAttempt attempt = testAttemptRepository.findById(attemptId).orElseThrow();
        Instant startTime = Instant.now().minusSeconds(120);
        attempt.setStartTime(startTime);

        // Snapshot has Part 1 (q1) and Part 2 (q2)
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Reading",
                                "parts", List.of(
                                        Map.of("id", 1, "title", "Part 1", "questions", List.of(Map.of("id", "q1", "type", "SINGLE_CHOICE"))),
                                        Map.of("id", 2, "title", "Part 2", "questions", List.of(Map.of("id", "q2", "type", "SINGLE_CHOICE")))
                                )
                        )
                )
        );
        attempt.setExamSnapshot(snapshot);
        testAttemptRepository.save(attempt);

        // Only save answers for Part 1. Part 2 is untouched.
        AttemptAnswer ans1 = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(1)
                .userAnswers(Map.of("q1", "A"))
                .build();
        attemptAnswerRepository.save(ans1);

        // Mock grading keys for both parts
        when(gradingAdapter.loadPartKeys(1)).thenReturn(Map.of(
                1, createPartKey(1, "q1", "SINGLE_CHOICE", "A"),
                2, createPartKey(2, "q2", "SINGLE_CHOICE", "B")
        ));

        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();
        SubmitResultResponse submitResp = testAttemptService.submitAttempt(attemptId, submitReq);

        assertThat(submitResp.getStatus()).isEqualTo(AttemptStatus.COMPLETED);

        TestAttempt persistedAttempt = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(persistedAttempt.getTimeSpentSeconds()).isGreaterThanOrEqualTo(120);

        // Verify only 1 answer row in DB (no synthetic row created for Part 2)
        List<AttemptAnswer> answersInDb = attemptAnswerRepository.findByAttemptId(attemptId);
        assertThat(answersInDb).hasSize(1);
        assertThat(answersInDb.get(0).getPartId()).isEqualTo(1);

        // Parse result summary JSON
        @SuppressWarnings("unchecked")
        Map<String, Object> resultSummary = objectMapper.readValue(persistedAttempt.getResultSummary(), Map.class);
        assertThat(resultSummary.get("totalObjectiveCount")).isEqualTo(2);

        @SuppressWarnings("unchecked")
        Map<String, Object> partResults = (Map<String, Object>) resultSummary.get("partResults");
        assertThat(partResults).containsKey("1");
        assertThat(partResults).containsKey("2");

        @SuppressWarnings("unchecked")
        Map<String, Object> part2Result = (Map<String, Object>) partResults.get("2");
        @SuppressWarnings("unchecked")
        Map<String, Object> q2Result = (Map<String, Object>) part2Result.get("q2");
        assertThat(q2Result.get("verdict")).isEqualTo(GradingVerdict.BLANK.name());
    }

    @Test
    @DisplayName("Section named WRITING without ESSAY questions should not trigger AI_GRADING")
    void finalize_sectionNamedWritingWithoutEssay_doesNotTriggerAiGrading() {
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(1);
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();

        TestAttempt attempt = testAttemptRepository.findById(attemptId).orElseThrow();
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Writing Task Grammar",
                                "parts", List.of(
                                        Map.of("id", 1, "title", "Part 1", "questions", List.of(Map.of("id", "q1", "type", "SINGLE_CHOICE")))
                                )
                        )
                )
        );
        attempt.setExamSnapshot(snapshot);
        testAttemptRepository.save(attempt);

        when(gradingAdapter.loadPartKeys(1)).thenReturn(Map.of(
                1, createPartKey(1, "q1", "SINGLE_CHOICE", "A")
        ));

        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();
        SubmitResultResponse submitResp = testAttemptService.submitAttempt(attemptId, submitReq);

        assertThat(submitResp.getStatus()).isEqualTo(AttemptStatus.COMPLETED);
    }

    @Test
    @DisplayName("Section containing ESSAY questions should trigger AI_GRADING regardless of section name")
    void finalize_sectionWithEssay_triggersAiGrading() {
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(1);
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();

        TestAttempt attempt = testAttemptRepository.findById(attemptId).orElseThrow();
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Section Alpha",
                                "parts", List.of(
                                        Map.of("id", 1, "title", "Part 1", "questions", List.of(Map.of("id", "essay1", "type", "ESSAY")))
                                )
                        )
                )
        );
        attempt.setExamSnapshot(snapshot);
        testAttemptRepository.save(attempt);

        when(gradingAdapter.loadPartKeys(1)).thenReturn(Map.of());

        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();
        SubmitResultResponse submitResp = testAttemptService.submitAttempt(attemptId, submitReq);

        assertThat(submitResp.getStatus()).isEqualTo(AttemptStatus.AI_GRADING);
    }

    @Test
    @DisplayName("P2 Regression: When grading serialization fails, attempt status is GRADING_FAILED and answer derived fields are not updated/persisted")
    void finalize_serializationFailure_setsStatusFailedAndDoesNotMutateAnswers() throws Exception {
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(1);
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();

        TestAttempt attempt = testAttemptRepository.findById(attemptId).orElseThrow();
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Reading",
                                "parts", List.of(
                                        Map.of("id", 1, "title", "Part 1", "questions", List.of(Map.of("id", "q1", "type", "SINGLE_CHOICE")))
                                )
                        )
                )
        );
        attempt.setExamSnapshot(snapshot);
        testAttemptRepository.save(attempt);

        // Pre-saved answer without derived fields (earnedScore = null, isCorrectFlags = null)
        AttemptAnswer ans = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(1)
                .userAnswers(Map.of("q1", "A"))
                .build();
        attemptAnswerRepository.save(ans);

        when(gradingAdapter.loadPartKeys(1)).thenReturn(Map.of(
                1, createPartKey(1, "q1", "SINGLE_CHOICE", "A")
        ));

        // Inject serialization failure
        doThrow(new RuntimeException("Injected JSON serialization failure"))
                .when(objectMapper).writeValueAsString(any(com.multilingo.backend.modules.testing.grading.dto.GradingResult.class));

        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();
        SubmitResultResponse submitResp = testAttemptService.submitAttempt(attemptId, submitReq);

        assertThat(submitResp.getStatus()).isEqualTo(AttemptStatus.GRADING_FAILED);

        TestAttempt persistedAttempt = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(persistedAttempt.getStatus()).isEqualTo(AttemptStatus.GRADING_FAILED);
        assertThat(persistedAttempt.getResultSummary()).isNull();
        assertThat(persistedAttempt.getOverallScore()).isNull();

        // Verify answer derived fields were NOT mutated or persisted
        List<AttemptAnswer> answersInDb = attemptAnswerRepository.findByAttemptId(attemptId);
        assertThat(answersInDb).hasSize(1);
        assertThat(answersInDb.get(0).getEarnedScore()).isNull();
        assertThat(answersInDb.get(0).getIsCorrectFlags()).isNull();
    }
}

