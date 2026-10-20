package com.multilingo.backend.modules.testing.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.adapter.ExamAdapter;
import com.multilingo.backend.modules.testing.adapter.GradingAdapter;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.dto.request.SubmitAttemptRequest;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.SubmitReason;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.grading.ObjectiveGradingService;
import com.multilingo.backend.modules.testing.grading.dto.GradingKey;
import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;
import com.multilingo.backend.modules.testing.grading.impl.ObjectiveGradingServiceImpl;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.service.impl.TestAttemptServiceImpl;
import com.multilingo.backend.modules.testing.service.support.AttemptGradingInputFactory;
import com.multilingo.backend.modules.testing.service.support.AttemptResultSummaryMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

class AttemptGradingSameVersionTest {

    private final TestAttemptRepository testAttemptRepository = mock(TestAttemptRepository.class);
    private final AttemptAnswerRepository attemptAnswerRepository = mock(AttemptAnswerRepository.class);
    private final ExamAdapter examAdapter = mock(ExamAdapter.class);
    private final IdentityAdapter identityAdapter = mock(IdentityAdapter.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final GradingAdapter gradingAdapter = mock(GradingAdapter.class);
    private final ObjectiveGradingService gradingService = new ObjectiveGradingServiceImpl();
    private final PlatformTransactionManager transactionManager = mock(PlatformTransactionManager.class);
    private final EntityManager entityManager = mock(EntityManager.class);
    private final AttemptGradingInputFactory gradingInputFactory = new AttemptGradingInputFactory();
    private final AttemptResultSummaryMapper summaryMapper = new AttemptResultSummaryMapper(objectMapper);

    private TestAttemptServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new TestAttemptServiceImpl(
                testAttemptRepository,
                attemptAnswerRepository,
                examAdapter,
                identityAdapter,
                objectMapper,
                gradingAdapter,
                gradingService,
                transactionManager,
                entityManager,
                gradingInputFactory,
                summaryMapper,
                mock(com.multilingo.backend.modules.testing.service.support.WritingGradingEnqueuer.class),
                new com.multilingo.backend.modules.testing.service.support.WritingGradingAttemptStateResolver()
        );
        when(identityAdapter.getCurrentUserId()).thenReturn(100);
    }

    @Test
    void submitAttempt_usesGradingKeysCapturedInSnapshot_evenIfTv2GradingAdapterHasChanged() {
        // Given: An attempt created from TV2 Version 1
        // In Version 1: Question q_1 had correct answer "A"
        Map<String, Object> q1 = new LinkedHashMap<>();
        q1.put("question_id", "q_1");
        q1.put("type", "SINGLE_CHOICE");
        q1.put("correct_answer", "A");
        q1.put("explanation", "V1 explanation: A is right.");

        Map<String, Object> part = new LinkedHashMap<>();
        part.put("id", 10);
        part.put("title", "Part 1");
        part.put("questions", List.of(q1));

        Map<String, Object> section = new LinkedHashMap<>();
        section.put("id", 1);
        section.put("name", "READING");
        section.put("parts", List.of(part));

        Map<String, Object> snapshotV1 = new LinkedHashMap<>();
        snapshotV1.put("id", 99);
        snapshotV1.put("title", "Exam 99");
        snapshotV1.put("sections", List.of(section));

        TestAttempt attempt = TestAttempt.builder()
                .userId(100)
                .examId(99)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.PRACTICE)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(Instant.now().minusSeconds(300))
                .examSnapshot(snapshotV1)
                .build();
        attempt.setId(1);

        // Student answered "A" (which matches Version 1)
        AttemptAnswer answer = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(10)
                .userAnswers(Map.of("q_1", "A"))
                .build();
        answer.setId(50);

        when(testAttemptRepository.findByIdAndUserIdForUpdate(1, 100)).thenReturn(Optional.of(attempt));
        when(attemptAnswerRepository.findByAttemptId(1)).thenReturn(List.of(answer));

        // SIMULATE: Later, teacher modified TV2 to Version 2 where q_1 correct answer changed to "B"
        // If system loaded keys from TV2 live via gradingAdapter, student's "A" would be graded as WRONG.
        PartGradingKey tv2LiveKeys = new PartGradingKey();
        tv2LiveKeys.setPartId(10);
        tv2LiveKeys.setSectionName("READING");
        GradingKey liveKey = new GradingKey();
        liveKey.setQuestionId("q_1");
        liveKey.setType("SINGLE_CHOICE");
        liveKey.setCorrect("B"); // Changed in TV2!
        tv2LiveKeys.setAnswers(Map.of("q_1", liveKey));
        when(gradingAdapter.loadPartKeys(99)).thenReturn(Map.of(10, tv2LiveKeys));

        // When: Student submits attempt
        SubmitAttemptRequest req = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();
        service.submitAttempt(1, req);

        // Then: Grading must use the snapshot keys (Version 1: "A"), NOT TV2 live keys ("B")!
        // Student score must be 1.0 (CORRECT)
        assertThat(attempt.getOverallScore()).isEqualByComparingTo("1.00");
        assertThat(attempt.getResultSummary()).contains("\"verdict\":\"CORRECT\"");
        assertThat(attempt.getResultSummary()).contains("\"correctCount\":1");
    }

    @Test
    void submitAttempt_fallsBackToGradingAdapterWhenSnapshotHasNoKeys() {
        // Given: Legacy attempt without correct_answer in snapshot
        Map<String, Object> q1 = new LinkedHashMap<>();
        q1.put("question_id", "q_1");
        q1.put("type", "SINGLE_CHOICE");
        // No correct_answer

        Map<String, Object> part = new LinkedHashMap<>();
        part.put("id", 10);
        part.put("questions", List.of(q1));

        Map<String, Object> section = new LinkedHashMap<>();
        section.put("name", "READING");
        section.put("parts", List.of(part));

        Map<String, Object> legacySnapshot = Map.of("sections", List.of(section));

        TestAttempt attempt = TestAttempt.builder()
                .userId(100)
                .examId(99)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.PRACTICE)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(Instant.now().minusSeconds(300))
                .examSnapshot(legacySnapshot)
                .build();
        attempt.setId(2);

        AttemptAnswer answer = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(10)
                .userAnswers(Map.of("q_1", "A"))
                .build();

        when(testAttemptRepository.findByIdAndUserIdForUpdate(2, 100)).thenReturn(Optional.of(attempt));
        when(attemptAnswerRepository.findByAttemptId(2)).thenReturn(List.of(answer));

        // TV2 grading adapter provides the key for legacy fallback
        PartGradingKey legacyKeys = new PartGradingKey();
        legacyKeys.setPartId(10);
        legacyKeys.setSectionName("READING");
        GradingKey key = new GradingKey();
        key.setQuestionId("q_1");
        key.setType("SINGLE_CHOICE");
        key.setCorrect("A");
        legacyKeys.setAnswers(Map.of("q_1", key));
        when(gradingAdapter.loadPartKeys(99)).thenReturn(Map.of(10, legacyKeys));

        SubmitAttemptRequest req = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();
        service.submitAttempt(2, req);

        // Fallback should be triggered and grading succeeds
        assertThat(attempt.getOverallScore()).isEqualByComparingTo("1.00");
        assertThat(attempt.getResultSummary()).contains("\"verdict\":\"CORRECT\"");
    }
}
