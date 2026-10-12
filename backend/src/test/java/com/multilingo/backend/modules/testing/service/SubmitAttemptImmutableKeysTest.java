package com.multilingo.backend.modules.testing.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.adapter.ExamAdapter;
import com.multilingo.backend.modules.testing.adapter.GradingAdapter;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.dto.request.SubmitAttemptRequest;
import com.multilingo.backend.modules.testing.dto.response.SubmitResultResponse;
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

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SubmitAttemptImmutableKeysTest {

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
                summaryMapper
        );
        when(identityAdapter.getCurrentUserId()).thenReturn(100);
    }

    @Test
    void submitAttempt_manualSubmit_usesSnapshotKeys_andNeverCallsTv2GradingAdapter() {
        // Given: Snapshot with diverse objective question types captured at creation time
        Map<String, Object> qSingle = new LinkedHashMap<>();
        qSingle.put("question_id", "q_single");
        qSingle.put("type", "SINGLE_CHOICE");
        qSingle.put("correct_answer", "B");

        Map<String, Object> qMulti = new LinkedHashMap<>();
        qMulti.put("question_id", "q_multi");
        qMulti.put("type", "MULTIPLE_CHOICE");
        qMulti.put("correct_answer", List.of("A", "C"));

        Map<String, Object> qFill = new LinkedHashMap<>();
        qFill.put("question_id", "q_fill");
        qFill.put("type", "FILL_IN_THE_BLANK");
        qFill.put("correct_answer", "plasticity");
        qFill.put("alternates", List.of("neuroplasticity"));

        Map<String, Object> qHeading = new LinkedHashMap<>();
        qHeading.put("question_id", "q_head");
        qHeading.put("type", "MATCHING_HEADINGS");
        qHeading.put("correct_answer", "ii");
        qHeading.put("options", List.of(
                Map.of("id", "i", "text", "Wrong Heading"),
                Map.of("id", "ii", "text", "Effects on Memory")
        ));

        Map<String, Object> part = new LinkedHashMap<>();
        part.put("id", 101);
        part.put("title", "Reading Part 1");
        part.put("questions", List.of(qSingle, qMulti, qFill, qHeading));

        Map<String, Object> section = new LinkedHashMap<>();
        section.put("id", 1);
        section.put("name", "READING");
        section.put("parts", List.of(part));

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("id", 88);
        snapshot.put("title", "IELTS Academic Test 88");
        snapshot.put("sections", List.of(section));

        TestAttempt attempt = TestAttempt.builder()
                .userId(100)
                .examId(88)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.PRACTICE)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(Instant.now().minusSeconds(600))
                .examSnapshot(snapshot)
                .build();
        attempt.setId(10);

        // Student answers match snapshot keys:
        // q_single -> "B" (CORRECT, 1.0)
        // q_multi  -> ["A", "C"] (CORRECT, 1.0)
        // q_fill   -> "neuroplasticity" (CORRECT via alternate, 1.0)
        // q_head   -> "Effects on Memory" (CORRECT via option text, 1.0)
        Map<String, Object> studentAnswers = new LinkedHashMap<>();
        studentAnswers.put("q_single", "B");
        studentAnswers.put("q_multi", List.of("A", "C"));
        studentAnswers.put("q_fill", "neuroplasticity");
        studentAnswers.put("q_head", "Effects on Memory");

        AttemptAnswer answer = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(101)
                .userAnswers(studentAnswers)
                .build();
        answer.setId(500);

        when(testAttemptRepository.findByIdAndUserIdForUpdate(10, 100)).thenReturn(Optional.of(attempt));
        when(attemptAnswerRepository.findByAttemptId(10)).thenReturn(List.of(answer));

        // When: Student submits attempt
        SubmitAttemptRequest req = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();
        SubmitResultResponse resp = service.submitAttempt(10, req);

        // Then:
        // 1. GradingAdapter.loadPartKeys must NEVER be called because snapshot had keys!
        verify(gradingAdapter, never()).loadPartKeys(any());

        // 2. All 4 questions are CORRECT -> overall score is 4.00
        assertThat(resp.getStatus()).isEqualTo(AttemptStatus.COMPLETED);
        assertThat(attempt.getOverallScore()).isEqualByComparingTo("4.00");

        // 3. AttemptAnswer record has earnedScore 4.00 and isCorrectFlags for all questions
        assertThat(answer.getEarnedScore()).isEqualByComparingTo("4.00");
        assertThat(answer.getIsCorrectFlags())
                .containsEntry("q_single", "CORRECT")
                .containsEntry("q_multi", "CORRECT")
                .containsEntry("q_fill", "CORRECT")
                .containsEntry("q_head", "CORRECT");
    }

    @Test
    void submitAttempt_whenTv2ThrowsException_stillSucceedsUsingSnapshotKeys() {
        // Given: TV2 live database is broken or throws RuntimeException
        when(gradingAdapter.loadPartKeys(any())).thenThrow(new RuntimeException("TV2 connection failure!"));

        Map<String, Object> q1 = new LinkedHashMap<>();
        q1.put("question_id", "q_1");
        q1.put("type", "SINGLE_CHOICE");
        q1.put("correct_answer", "D");

        Map<String, Object> part = new LinkedHashMap<>();
        part.put("id", 201);
        part.put("questions", List.of(q1));

        Map<String, Object> section = new LinkedHashMap<>();
        section.put("name", "LISTENING");
        section.put("parts", List.of(part));

        Map<String, Object> snapshot = Map.of("sections", List.of(section));

        TestAttempt attempt = TestAttempt.builder()
                .userId(100)
                .examId(77)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.PRACTICE)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(Instant.now().minusSeconds(600))
                .examSnapshot(snapshot)
                .build();
        attempt.setId(20);

        AttemptAnswer answer = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(201)
                .userAnswers(Map.of("q_1", "D"))
                .build();

        when(testAttemptRepository.findByIdAndUserIdForUpdate(20, 100)).thenReturn(Optional.of(attempt));
        when(attemptAnswerRepository.findByAttemptId(20)).thenReturn(List.of(answer));

        // When: Submit attempt
        SubmitAttemptRequest req = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();
        SubmitResultResponse resp = service.submitAttempt(20, req);

        // Then: Successfully completed with 1.00 score, did not fail or throw
        assertThat(resp.getStatus()).isEqualTo(AttemptStatus.COMPLETED);
        assertThat(attempt.getOverallScore()).isEqualByComparingTo("1.00");
        verify(gradingAdapter, never()).loadPartKeys(any());
    }

    @Test
    void submitAttempt_withWritingSection_gradesObjectiveFromSnapshot_andSetsAiGradingStatus() {
        // Given: Part 1 Reading (objective) + Part 2 Writing (ESSAY)
        Map<String, Object> qReading = new LinkedHashMap<>();
        qReading.put("question_id", "q_read_1");
        qReading.put("type", "SINGLE_CHOICE");
        qReading.put("correct_answer", "A");

        Map<String, Object> part1 = new LinkedHashMap<>();
        part1.put("id", 301);
        part1.put("title", "Reading");
        part1.put("questions", List.of(qReading));

        Map<String, Object> qWriting = new LinkedHashMap<>();
        qWriting.put("question_id", "q_write_1");
        qWriting.put("type", "ESSAY");

        Map<String, Object> part2 = new LinkedHashMap<>();
        part2.put("id", 302);
        part2.put("title", "Writing Task 1");
        part2.put("questions", List.of(qWriting));

        Map<String, Object> secReading = Map.of("name", "READING", "parts", List.of(part1));
        Map<String, Object> secWriting = Map.of("name", "WRITING", "parts", List.of(part2));

        Map<String, Object> snapshot = Map.of("sections", List.of(secReading, secWriting));

        TestAttempt attempt = TestAttempt.builder()
                .userId(100)
                .examId(66)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.PRACTICE)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(Instant.now().minusSeconds(1200))
                .examSnapshot(snapshot)
                .build();
        attempt.setId(30);

        AttemptAnswer ansReading = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(301)
                .userAnswers(Map.of("q_read_1", "A"))
                .build();

        AttemptAnswer ansWriting = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(302)
                .userAnswers(Map.of("q_write_1", "The chart shows the consumption of energy..."))
                .build();

        when(testAttemptRepository.findByIdAndUserIdForUpdate(30, 100)).thenReturn(Optional.of(attempt));
        when(attemptAnswerRepository.findByAttemptId(30)).thenReturn(List.of(ansReading, ansWriting));

        // When
        SubmitAttemptRequest req = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();
        SubmitResultResponse resp = service.submitAttempt(30, req);

        // Then: Status is AI_GRADING because of ESSAY, Reading is graded 1.00
        assertThat(resp.getStatus()).isEqualTo(AttemptStatus.AI_GRADING);
        assertThat(attempt.getOverallScore()).isEqualByComparingTo("1.00");
        verify(gradingAdapter, never()).loadPartKeys(any());
    }

    @Test
    void submitAttempt_untouchedParts_gradedZero_usingSnapshotKeys() {
        // Given: Part 1 and Part 2 in snapshot
        Map<String, Object> q1 = Map.of("question_id", "q_1", "type", "SINGLE_CHOICE", "correct_answer", "A");
        Map<String, Object> part1 = Map.of("id", 401, "questions", List.of(q1));

        Map<String, Object> q2 = Map.of("question_id", "q_2", "type", "SINGLE_CHOICE", "correct_answer", "B");
        Map<String, Object> part2 = Map.of("id", 402, "questions", List.of(q2));

        Map<String, Object> section = Map.of("name", "READING", "parts", List.of(part1, part2));
        Map<String, Object> snapshot = Map.of("sections", List.of(section));

        TestAttempt attempt = TestAttempt.builder()
                .userId(100)
                .examId(55)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.PRACTICE)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(Instant.now().minusSeconds(1200))
                .examSnapshot(snapshot)
                .build();
        attempt.setId(40);

        // Student only attempted Part 1, untouched Part 2
        AttemptAnswer ansPart1 = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(401)
                .userAnswers(Map.of("q_1", "A"))
                .build();

        when(testAttemptRepository.findByIdAndUserIdForUpdate(40, 100)).thenReturn(Optional.of(attempt));
        when(attemptAnswerRepository.findByAttemptId(40)).thenReturn(List.of(ansPart1));

        // When
        SubmitAttemptRequest req = SubmitAttemptRequest.builder().reason(SubmitReason.MANUAL).build();
        SubmitResultResponse resp = service.submitAttempt(40, req);

        // Then: Total score is 1.00 (Part 1: 1.0, Part 2 untouched: 0.0)
        assertThat(resp.getStatus()).isEqualTo(AttemptStatus.COMPLETED);
        assertThat(attempt.getOverallScore()).isEqualByComparingTo("1.00");
        assertThat(attempt.getResultSummary()).contains("\"correctCount\":1");
        assertThat(attempt.getResultSummary()).contains("\"totalObjectiveCount\":2");
        verify(gradingAdapter, never()).loadPartKeys(any());
    }

    @Test
    void submitAttempt_legacySnapshotWithoutKeys_fallsBackToGradingAdapter() {
        // Given: Legacy snapshot without correct_answer
        Map<String, Object> q1 = Map.of("question_id", "q_1", "type", "SINGLE_CHOICE");
        Map<String, Object> part = Map.of("id", 501, "questions", List.of(q1));
        Map<String, Object> section = Map.of("name", "READING", "parts", List.of(part));
        Map<String, Object> snapshot = Map.of("sections", List.of(section));

        TestAttempt attempt = TestAttempt.builder()
                .userId(100)
                .examId(44)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.PRACTICE)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(Instant.now().minusSeconds(1200))
                .examSnapshot(snapshot)
                .build();
        attempt.setId(50);

        AttemptAnswer ans = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(501)
                .userAnswers(Map.of("q_1", "C"))
                .build();

        when(testAttemptRepository.findByIdAndUserIdForUpdate(50, 100)).thenReturn(Optional.of(attempt));
        when(attemptAnswerRepository.findByAttemptId(50)).thenReturn(List.of(ans));

        // Fallback provided by GradingAdapter
        PartGradingKey pgk = new PartGradingKey();
        pgk.setPartId(501);
        pgk.setSectionName("READING");
        GradingKey gk = new GradingKey();
        gk.setQuestionId("q_1");
        gk.setType("SINGLE_CHOICE");
        gk.setCorrect("C");
        pgk.setAnswers(Map.of("q_1", gk));
        when(gradingAdapter.loadPartKeys(44)).thenReturn(Map.of(501, pgk));

        // When
        SubmitAttemptRequest req = SubmitAttemptRequest.builder().reason(SubmitReason.MANUAL).build();
        SubmitResultResponse resp = service.submitAttempt(50, req);

        // Then: gradingAdapter IS called because snapshot had no keys
        verify(gradingAdapter, times(1)).loadPartKeys(44);
        assertThat(resp.getStatus()).isEqualTo(AttemptStatus.COMPLETED);
        assertThat(attempt.getOverallScore()).isEqualByComparingTo("1.00");
    }

    @Test
    void submitAttempt_writingOnlyScope_neverCallsTv2GradingAdapter_evenIfAdapterThrows() {
        // Given: Writing-only exam snapshot (only ESSAY question, e.g. SINGLE_SKILL Writing)
        Map<String, Object> qEssay = new LinkedHashMap<>();
        qEssay.put("question_id", "essay_task_1");
        qEssay.put("type", "ESSAY");

        Map<String, Object> part = new LinkedHashMap<>();
        part.put("id", 601);
        part.put("title", "Writing Task 1");
        part.put("questions", List.of(qEssay));

        Map<String, Object> section = Map.of("name", "WRITING", "parts", List.of(part));
        Map<String, Object> snapshot = Map.of("sections", List.of(section));

        TestAttempt attempt = TestAttempt.builder()
                .userId(100)
                .examId(99)
                .testScope(TestScope.SINGLE_SKILL)
                .testMode(TestMode.PRACTICE)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(Instant.now().minusSeconds(600))
                .examSnapshot(snapshot)
                .build();
        attempt.setId(60);

        AttemptAnswer ans = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(601)
                .userAnswers(Map.of("essay_task_1", "My IELTS Academic Writing response..."))
                .build();

        when(testAttemptRepository.findByIdAndUserIdForUpdate(60, 100)).thenReturn(Optional.of(attempt));
        when(attemptAnswerRepository.findByAttemptId(60)).thenReturn(List.of(ans));

        // When TV2 GradingAdapter is broken / throwing exception
        when(gradingAdapter.loadPartKeys(any())).thenThrow(new RuntimeException("TV2 grading service offline"));

        // When: candidate submits Writing attempt
        SubmitAttemptRequest req = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();
        SubmitResultResponse resp = service.submitAttempt(60, req);

        // Then: gradingAdapter must NEVER be called, and attempt status must be AI_GRADING (not GRADING_FAILED)
        verify(gradingAdapter, never()).loadPartKeys(any());
        assertThat(resp.getStatus()).isEqualTo(AttemptStatus.AI_GRADING);
        assertThat(attempt.getStatus()).isEqualTo(AttemptStatus.AI_GRADING);
    }

    @Test
    void expireAttemptBySystem_writingOnlyScope_neverCallsTv2GradingAdapter_evenIfAdapterThrows() {
        // Given: Writing-only exam snapshot expired on server
        Map<String, Object> qEssay = new LinkedHashMap<>();
        qEssay.put("question_id", "essay_task_2");
        qEssay.put("type", "ESSAY");

        Map<String, Object> part = new LinkedHashMap<>();
        part.put("id", 701);
        part.put("title", "Writing Task 2");
        part.put("questions", List.of(qEssay));

        Map<String, Object> section = Map.of("name", "WRITING", "parts", List.of(part));
        Map<String, Object> snapshot = Map.of("sections", List.of(section));

        TestAttempt attempt = TestAttempt.builder()
                .userId(100)
                .examId(99)
                .testScope(TestScope.SINGLE_PART)
                .testMode(TestMode.MOCK_TEST)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(Instant.now().minusSeconds(3600))
                .deadline(Instant.now().minusSeconds(100))
                .examSnapshot(snapshot)
                .build();
        attempt.setId(70);

        AttemptAnswer ans = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(701)
                .userAnswers(Map.of("essay_task_2", "Discussion essay body..."))
                .build();

        when(testAttemptRepository.findByIdForUpdate(70)).thenReturn(Optional.of(attempt));
        when(attemptAnswerRepository.findByAttemptId(70)).thenReturn(List.of(ans));

        // When TV2 GradingAdapter is throwing exception
        when(gradingAdapter.loadPartKeys(any())).thenThrow(new RuntimeException("TV2 grading service offline"));

        // When: system expires the attempt
        service.expireAttemptBySystem(70);

        // Then: gradingAdapter must NEVER be called, and attempt transitions to AI_GRADING
        verify(gradingAdapter, never()).loadPartKeys(any());
        assertThat(attempt.getStatus()).isEqualTo(AttemptStatus.AI_GRADING);
    }
}
