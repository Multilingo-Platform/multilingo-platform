package com.multilingo.backend.modules.testing.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.entity.ExamPart;
import com.multilingo.backend.modules.exam.entity.ExamSection;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamSectionRepository;
import com.multilingo.backend.modules.testing.adapter.GradingAdapter;
import com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest;
import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.dto.request.SubmitAttemptRequest;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.SubmitReason;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.grading.dto.GradingKey;
import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.service.TestAttemptService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@WithMockUser(username = "1", roles = "USER")
class ExamReviewContractIT {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ExamRepository examRepository;

    @Autowired
    private ExamSectionRepository examSectionRepository;

    @Autowired
    private ExamPartRepository examPartRepository;

    @Autowired
    private TestAttemptRepository testAttemptRepository;

    @Autowired
    private AttemptAnswerRepository attemptAnswerRepository;

    @Autowired
    private TestAttemptService testAttemptService;

    @SpyBean
    private GradingAdapter gradingAdapter;

    private final List<Integer> createdAttemptIds = new ArrayList<>();
    private final List<Integer> createdExamIds = new ArrayList<>();

    @BeforeEach
    void setUp() {
    }

    @AfterEach
    void tearDown() {
        for (Integer attemptId : createdAttemptIds) {
            try {
                attemptAnswerRepository.deleteAll(attemptAnswerRepository.findByAttemptId(attemptId));
                testAttemptRepository.deleteById(attemptId);
            } catch (Exception ignored) {}
        }
        createdAttemptIds.clear();

        for (Integer examId : createdExamIds) {
            try {
                List<ExamSection> sections = examSectionRepository.findByExam_Id(examId);
                for (ExamSection s : sections) {
                    examPartRepository.deleteAll(examPartRepository.findBySection_Id(s.getId()));
                }
                examSectionRepository.deleteAll(sections);
                examRepository.deleteById(examId);
            } catch (Exception ignored) {}
        }
        createdExamIds.clear();
    }

    private Exam seedCanonicalReviewExam(String code) {
        Exam exam = Exam.builder()
                .code(code)
                .title("Canonical Review E2E Exam " + code)
                .type("IELTS")
                .durationMinutes(60)
                .isPublished(true)
                .build();
        exam = examRepository.save(exam);
        createdExamIds.add(exam.getId());

        // Section 1: Reading
        ExamSection readingSection = ExamSection.builder()
                .exam(exam)
                .skillType("READING")
                .title("Reading Section")
                .durationMinutes(30)
                .orderIndex(1)
                .build();
        readingSection = examSectionRepository.save(readingSection);

        // Reading Part 1: Passage with question group + options inheritance + correct_answer + explanation + secret context
        Map<String, Object> rPart1Data = new LinkedHashMap<>();
        rPart1Data.put("title", "Reading Passage 1");
        rPart1Data.put("passage", "Artificial intelligence in education offers personalized learning pathways.");
        rPart1Data.put("ai_prompt_context", "SECRET_INTERNAL_AI_PROMPT_DO_NOT_LEAK");

        Map<String, Object> group1 = new LinkedHashMap<>();
        group1.put("instruction", "Choose the correct option for questions 1-2");
        group1.put("options", List.of(
                Map.of("key", "A", "text", "Option A description"),
                Map.of("key", "B", "text", "Option B description"),
                Map.of("key", "C", "text", "Option C description")
        ));

        Map<String, Object> q1 = new LinkedHashMap<>();
        q1.put("question_id", "q1");
        q1.put("type", "SINGLE_CHOICE");
        q1.put("text", "What does AI offer?");
        q1.put("correct_answer", "A");
        q1.put("explanation", "AI provides personalized learning pathways according to the text.");

        Map<String, Object> q2 = new LinkedHashMap<>();
        q2.put("question_id", "q2");
        q2.put("type", "SINGLE_CHOICE");
        q2.put("text", "Is it adaptive?");
        q2.put("correct_answer", "B");
        q2.put("explanation", "The second paragraph explains adaptive learning.");

        group1.put("questions", List.of(q1, q2));
        rPart1Data.put("question_groups", List.of(group1));

        ExamPart rPart1 = ExamPart.builder()
                .section(readingSection)
                .partNumber(1)
                .contentData(rPart1Data)
                .build();
        examPartRepository.save(rPart1);

        // Section 2: Writing (1 essay task)
        ExamSection writingSection = ExamSection.builder()
                .exam(exam)
                .skillType("WRITING")
                .title("Writing Section")
                .durationMinutes(30)
                .orderIndex(2)
                .build();
        writingSection = examSectionRepository.save(writingSection);

        Map<String, Object> wPart1Data = new LinkedHashMap<>();
        wPart1Data.put("title", "Writing Task 1");
        wPart1Data.put("question_groups", List.of(
                Map.of(
                        "instruction", "Write an essay about AI",
                        "questions", List.of(
                                Map.of(
                                        "question_id", "essay_1",
                                        "type", "ESSAY",
                                        "text", "Discuss the impacts of AI on jobs."
                                )
                        )
                )
        ));

        ExamPart wPart1 = ExamPart.builder()
                .section(writingSection)
                .partNumber(1)
                .contentData(wPart1Data)
                .build();
        examPartRepository.save(wPart1);

        return exam;
    }

    @Test
    @DisplayName("E2E-01: Full end-to-end review flow with real database entities returns typed contract")
    void testE2E_fullReviewFlow_immutableReviewData() throws Exception {
        Exam exam = seedCanonicalReviewExam("REVIEW_E2E_01");
        List<ExamPart> parts = examPartRepository.findAll();
        ExamPart readingPart1 = parts.stream()
                .filter(p -> "Reading Passage 1".equals(p.getContentData().get("title")))
                .findFirst().orElseThrow();

        // 1. Create Attempt -> real snapshot created with correct_answer and explanation
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);

        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        // Assert that client workspace DOES NOT receive correct_answer or explanation
        String workspaceJson = objectMapper.writeValueAsString(workspace);
        assertThat(workspaceJson).doesNotContain("personalized learning pathways according to the text");
        assertThat(workspaceJson).doesNotContain("SECRET_INTERNAL_AI_PROMPT_DO_NOT_LEAK");

        // 2. Candidate answers q1 = "A" (CORRECT), q2 = "C" (WRONG)
        AutosaveAnswersRequest autosave = new AutosaveAnswersRequest();
        autosave.setVersion(workspace.getVersion());
        AutosaveAnswersRequest.PartAnswerDto pAns = new AutosaveAnswersRequest.PartAnswerDto();
        pAns.setPartId(readingPart1.getId());
        pAns.setAnswers(List.of(
                new AutosaveAnswersRequest.QuestionAnswerDto("q1", "A"),
                new AutosaveAnswersRequest.QuestionAnswerDto("q2", "C")
        ));
        autosave.setAnswers(List.of(pAns));
        testAttemptService.autosaveAnswers(attemptId, autosave);

        // 3. Submit Attempt -> Finalized with grading from snapshot keys
        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();
        testAttemptService.submitAttempt(attemptId, submitReq);

        // 4. GET /api/v1/attempts/{id}/review/{partId}
        mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/review/" + readingPart1.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.attemptId").value(attemptId))
                .andExpect(jsonPath("$.data.partId").value(readingPart1.getId()))
                // partStats
                .andExpect(jsonPath("$.data.partStats.totalQuestions").value(2))
                .andExpect(jsonPath("$.data.partStats.correctCount").value(1))
                .andExpect(jsonPath("$.data.partStats.incorrectCount").value(1))
                .andExpect(jsonPath("$.data.partStats.unansweredCount").value(0))
                .andExpect(jsonPath("$.data.partStats.score").value(1.0))
                .andExpect(jsonPath("$.data.partStats.accuracy").value(50.0))
                .andExpect(jsonPath("$.data.partStats.isCorrectFlags.q1").value(true))
                .andExpect(jsonPath("$.data.partStats.isCorrectFlags.q2").value(false))
                // questions
                .andExpect(jsonPath("$.data.questions").isArray())
                .andExpect(jsonPath("$.data.questions.length()").value(2))
                .andExpect(jsonPath("$.data.questions[0].questionId").value("q1"))
                .andExpect(jsonPath("$.data.questions[0].correctAnswer").value("A"))
                .andExpect(jsonPath("$.data.questions[0].userAnswer").value("A"))
                .andExpect(jsonPath("$.data.questions[0].isCorrect").value(true))
                .andExpect(jsonPath("$.data.questions[0].explanation").value("AI provides personalized learning pathways according to the text."))
                .andExpect(jsonPath("$.data.questions[0].options[0].id").value("A"))
                .andExpect(jsonPath("$.data.questions[0].options[0].isCorrect").value(true))
                .andExpect(jsonPath("$.data.questions[0].options[1].id").value("B"))
                .andExpect(jsonPath("$.data.questions[0].options[1].isCorrect").value(false))
                .andExpect(jsonPath("$.data.questions[1].questionId").value("q2"))
                .andExpect(jsonPath("$.data.questions[1].correctAnswer").value("B"))
                .andExpect(jsonPath("$.data.questions[1].userAnswer").value("C"))
                .andExpect(jsonPath("$.data.questions[1].isCorrect").value(false))
                .andExpect(jsonPath("$.data.questions[1].explanation").value("The second paragraph explains adaptive learning."))
                // legacy aliases
                .andExpect(jsonPath("$.data.partResult.q1.verdict").value("CORRECT"))
                .andExpect(jsonPath("$.data.partResult.q2.verdict").value("WRONG"))
                .andExpect(jsonPath("$.data.userAnswers.q1").value("A"))
                .andExpect(jsonPath("$.data.userAnswers.q2").value("C"))
                .andExpect(jsonPath("$.data.isCorrectFlags.q1").value(true))
                .andExpect(jsonPath("$.data.isCorrectFlags.q2").value(false));
    }

    @Test
    @DisplayName("E2E-02: Modifying or deleting source exam after finalization does not affect review data (P0 Gap #7 Immutability)")
    void testE2E_examSourceMutatedOrDeleted_reviewRemainsImmutable() throws Exception {
        Exam exam = seedCanonicalReviewExam("REVIEW_E2E_02");
        List<ExamPart> parts = examPartRepository.findAll();
        ExamPart readingPart1 = parts.stream()
                .filter(p -> "Reading Passage 1".equals(p.getContentData().get("title")))
                .findFirst().orElseThrow();
        Integer readingPartId = readingPart1.getId();

        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);

        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        // Submit attempt
        testAttemptService.submitAttempt(attemptId, SubmitAttemptRequest.builder().reason(SubmitReason.MANUAL).build());

        // Now mutate and delete all exam parts and sections from database
        List<ExamSection> sections = examSectionRepository.findByExam_Id(exam.getId());
        for (ExamSection s : sections) {
            examPartRepository.deleteAll(examPartRepository.findBySection_Id(s.getId()));
        }
        examSectionRepository.deleteAll(sections);
        examRepository.deleteById(exam.getId());
        createdExamIds.remove(exam.getId());

        // GET review still succeeds and returns the complete immutable review data from snapshot!
        mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/review/" + readingPartId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.partStats.totalQuestions").value(2))
                .andExpect(jsonPath("$.data.questions[0].correctAnswer").value("A"))
                .andExpect(jsonPath("$.data.questions[0].explanation").value("AI provides personalized learning pathways according to the text."))
                .andExpect(jsonPath("$.data.questions[1].correctAnswer").value("B"))
                .andExpect(jsonPath("$.data.questions[1].explanation").value("The second paragraph explains adaptive learning."));
    }

    @Test
    @DisplayName("E2E-03: Historical legacy attempt without snapshot keys gracefully falls back to GradingAdapter without 500 error")
    void testE2E_historicalAttemptWithoutSnapshotKeys_gracefulFallback() throws Exception {
        Exam exam = seedCanonicalReviewExam("REVIEW_E2E_03");

        // Simulate a legacy attempt: snapshot does NOT contain correct_answer or explanation
        Map<String, Object> legacySnapshot = new LinkedHashMap<>();
        legacySnapshot.put("examId", exam.getId());
        legacySnapshot.put("title", "Legacy IELTS Exam");
        legacySnapshot.put("sections", List.of(
                Map.of(
                        "id", 101,
                        "skillType", "READING",
                        "title", "Reading Section",
                        "parts", List.of(
                                Map.of(
                                        "id", 1001,
                                        "partNumber", 1,
                                        "title", "Reading Legacy Part 1",
                                        "question_groups", List.of(
                                                Map.of(
                                                        "questions", List.of(
                                                                Map.of(
                                                                        "question_id", "q_leg_1",
                                                                        "type", "SINGLE_CHOICE",
                                                                        "options", List.of(
                                                                                Map.of("key", "A", "text", "Apple"),
                                                                                Map.of("key", "B", "text", "Banana")
                                                                        )
                                                                        // NOTE: correct_answer and explanation are ABSENT
                                                                )
                                                        )
                                                )
                                        )
                                )
                        )
                )
        ));

        TestAttempt legacyAttempt = TestAttempt.builder()
                .examId(exam.getId())
                .userId(1)
                .status(AttemptStatus.COMPLETED)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.PRACTICE)
                .startTime(Instant.now().minus(30, ChronoUnit.MINUTES))
                .endTime(Instant.now().minus(5, ChronoUnit.MINUTES))
                .examSnapshot(legacySnapshot)
                .build();
        legacyAttempt = testAttemptRepository.save(legacyAttempt);
        createdAttemptIds.add(legacyAttempt.getId());

        // Answer q_leg_1 = "A"
        AttemptAnswer ans = AttemptAnswer.builder()
                .attempt(legacyAttempt)
                .partId(1001)
                .userAnswers(Map.of("q_leg_1", "A"))
                .isCorrectFlags(Map.of("q_leg_1", true))
                .earnedScore(new java.math.BigDecimal("1.00"))
                .build();
        attemptAnswerRepository.save(ans);

        // Stub gradingAdapter fallback key
        GradingKey gk = new GradingKey();
        gk.setQuestionId("q_leg_1");
        gk.setType("SINGLE_CHOICE");
        gk.setCorrect("A");

        PartGradingKey fallbackPartKey = new PartGradingKey();
        fallbackPartKey.setPartId(1001);
        fallbackPartKey.setSectionName("READING");
        fallbackPartKey.setAnswers(Map.of("q_leg_1", gk));
        doReturn(Map.of(1001, fallbackPartKey)).when(gradingAdapter).loadPartKeys(exam.getId());

        // Request review: should fallback to adapter and return 200 OK
        mockMvc.perform(get("/api/v1/attempts/" + legacyAttempt.getId() + "/review/1001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.questions[0].questionId").value("q_leg_1"))
                .andExpect(jsonPath("$.data.questions[0].correctAnswer").value("A"))
                .andExpect(jsonPath("$.data.questions[0].userAnswer").value("A"))
                .andExpect(jsonPath("$.data.questions[0].isCorrect").value(true))
                .andExpect(jsonPath("$.data.questions[0].explanation").doesNotExist()) // null/missing
                .andExpect(jsonPath("$.data.questions[0].options[0].isCorrect").value(true))
                .andExpect(jsonPath("$.data.questions[0].options[1].isCorrect").value(false));

        verify(gradingAdapter, times(1)).loadPartKeys(exam.getId());
    }

    @Test
    @DisplayName("E2E-03b: Historical attempt with string verdict isCorrectFlags (\"CORRECT\") correctly computes stats and verdicts")
    void testE2E_historicalAttemptWithPersistedStringVerdicts_returnsCorrectStatsAndVerdict() throws Exception {
        Exam exam = seedCanonicalReviewExam("REVIEW_E2E_03B");

        Map<String, Object> legacySnapshot = new LinkedHashMap<>();
        legacySnapshot.put("examId", exam.getId());
        legacySnapshot.put("title", "Legacy IELTS Exam with String Flags");
        legacySnapshot.put("sections", List.of(
                Map.of(
                        "id", 102,
                        "skillType", "READING",
                        "title", "Reading Section",
                        "parts", List.of(
                                Map.of(
                                        "id", 1002,
                                        "partNumber", 1,
                                        "title", "Reading Part With String Verdicts",
                                        "question_groups", List.of(
                                                Map.of(
                                                        "questions", List.of(
                                                                Map.of(
                                                                        "question_id", "q_str_1",
                                                                        "type", "SINGLE_CHOICE",
                                                                        "options", List.of(
                                                                                Map.of("key", "A", "text", "Apple"),
                                                                                Map.of("key", "B", "text", "Banana")
                                                                        )
                                                                )
                                                        )
                                                )
                                        )
                                )
                        )
                )
        ));

        TestAttempt legacyAttempt = TestAttempt.builder()
                .examId(exam.getId())
                .userId(1)
                .status(AttemptStatus.COMPLETED)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.PRACTICE)
                .startTime(Instant.now().minus(30, ChronoUnit.MINUTES))
                .endTime(Instant.now().minus(5, ChronoUnit.MINUTES))
                .examSnapshot(legacySnapshot)
                .resultSummary(null) // No resultSummary
                .build();
        legacyAttempt = testAttemptRepository.save(legacyAttempt);
        createdAttemptIds.add(legacyAttempt.getId());

        // String verdict "CORRECT" saved in isCorrectFlags
        AttemptAnswer ans = AttemptAnswer.builder()
                .attempt(legacyAttempt)
                .partId(1002)
                .userAnswers(Map.of("q_str_1", "A"))
                .isCorrectFlags(Map.of("q_str_1", "CORRECT"))
                .earnedScore(new java.math.BigDecimal("1.00"))
                .build();
        attemptAnswerRepository.save(ans);

        GradingKey gk = new GradingKey();
        gk.setQuestionId("q_str_1");
        gk.setType("SINGLE_CHOICE");
        gk.setCorrect("A");

        PartGradingKey fallbackPartKey = new PartGradingKey();
        fallbackPartKey.setPartId(1002);
        fallbackPartKey.setSectionName("READING");
        fallbackPartKey.setAnswers(Map.of("q_str_1", gk));
        doReturn(Map.of(1002, fallbackPartKey)).when(gradingAdapter).loadPartKeys(exam.getId());

        mockMvc.perform(get("/api/v1/attempts/" + legacyAttempt.getId() + "/review/1002"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.partStats.totalQuestions").value(1))
                .andExpect(jsonPath("$.data.partStats.correctCount").value(1))
                .andExpect(jsonPath("$.data.partStats.incorrectCount").value(0))
                .andExpect(jsonPath("$.data.partStats.score").value(1.00))
                .andExpect(jsonPath("$.data.partStats.accuracy").value(100.00))
                .andExpect(jsonPath("$.data.partStats.isCorrectFlags.q_str_1").value(true))
                .andExpect(jsonPath("$.data.questions[0].questionId").value("q_str_1"))
                .andExpect(jsonPath("$.data.questions[0].verdict").value("CORRECT"))
                .andExpect(jsonPath("$.data.questions[0].score").value(1.00));
    }

    @Test
    @DisplayName("E2E-03c: Historical attempt with MATCHING full-credit (2.00) and partial-credit (1.00 WRONG) preserves earnedScore without fabricated unit score")
    void testE2E_historicalAttemptWithMatching_preservesEarnedScoreWithoutFabricatedUnitScore() throws Exception {
        Exam exam = seedCanonicalReviewExam("REVIEW_E2E_03C");

        // Part 1003 has 1 MATCHING question: full-credit (earnedScore = 2.00, verdict = CORRECT)
        // Part 1004 has 1 MATCHING question: partial-credit (earnedScore = 1.00, verdict = WRONG)
        Map<String, Object> legacySnapshot = new LinkedHashMap<>();
        legacySnapshot.put("examId", exam.getId());
        legacySnapshot.put("title", "Legacy MATCHING Exam");
        legacySnapshot.put("sections", List.of(
                Map.of(
                        "id", 103,
                        "skillType", "READING",
                        "title", "Reading Section",
                        "parts", List.of(
                                Map.of(
                                        "id", 1003,
                                        "partNumber", 1,
                                        "title", "Matching Part Full Credit",
                                        "questions", List.of(
                                                Map.of(
                                                        "question_id", "q_match_full",
                                                        "type", "MATCHING"
                                                )
                                        )
                                ),
                                Map.of(
                                        "id", 1004,
                                        "partNumber", 2,
                                        "title", "Matching Part Partial Credit",
                                        "questions", List.of(
                                                Map.of(
                                                        "question_id", "q_match_partial",
                                                        "type", "MATCHING"
                                                )
                                        )
                                )
                        )
                )
        ));

        TestAttempt legacyAttempt = TestAttempt.builder()
                .examId(exam.getId())
                .userId(1)
                .status(AttemptStatus.COMPLETED)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.PRACTICE)
                .startTime(Instant.now().minus(30, ChronoUnit.MINUTES))
                .endTime(Instant.now().minus(5, ChronoUnit.MINUTES))
                .examSnapshot(legacySnapshot)
                .resultSummary(null) // No resultSummary
                .build();
        legacyAttempt = testAttemptRepository.save(legacyAttempt);
        createdAttemptIds.add(legacyAttempt.getId());

        // Part 1003: MATCHING full credit (earnedScore = 2.00, verdict = CORRECT)
        AttemptAnswer ansFull = AttemptAnswer.builder()
                .attempt(legacyAttempt)
                .partId(1003)
                .userAnswers(Map.of("q_match_full", Map.of("1", "A", "2", "B")))
                .isCorrectFlags(Map.of("q_match_full", "CORRECT"))
                .earnedScore(new java.math.BigDecimal("2.00"))
                .build();
        attemptAnswerRepository.save(ansFull);

        // Part 1004: MATCHING partial credit (earnedScore = 1.00, verdict = WRONG)
        AttemptAnswer ansPartial = AttemptAnswer.builder()
                .attempt(legacyAttempt)
                .partId(1004)
                .userAnswers(Map.of("q_match_partial", Map.of("1", "A", "2", "WRONG")))
                .isCorrectFlags(Map.of("q_match_partial", "WRONG"))
                .earnedScore(new java.math.BigDecimal("1.00"))
                .build();
        attemptAnswerRepository.save(ansPartial);

        // Verify Part 1003 (Full credit MATCHING: score is 2.00, not fabricated 1.00)
        mockMvc.perform(get("/api/v1/attempts/" + legacyAttempt.getId() + "/review/1003"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.partStats.totalQuestions").value(1))
                .andExpect(jsonPath("$.data.partStats.correctCount").value(1))
                .andExpect(jsonPath("$.data.partStats.score").value(2.00))
                .andExpect(jsonPath("$.data.questions[0].questionId").value("q_match_full"))
                .andExpect(jsonPath("$.data.questions[0].verdict").value("CORRECT"))
                .andExpect(jsonPath("$.data.questions[0].score").value(2.00));

        // Verify Part 1004 (Partial credit MATCHING: score is 1.00, verdict is WRONG, not fabricated 0.00)
        mockMvc.perform(get("/api/v1/attempts/" + legacyAttempt.getId() + "/review/1004"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.partStats.totalQuestions").value(1))
                .andExpect(jsonPath("$.data.partStats.correctCount").value(0))
                .andExpect(jsonPath("$.data.partStats.incorrectCount").value(1))
                .andExpect(jsonPath("$.data.partStats.score").value(1.00))
                .andExpect(jsonPath("$.data.questions[0].questionId").value("q_match_partial"))
                .andExpect(jsonPath("$.data.questions[0].verdict").value("WRONG"))
                .andExpect(jsonPath("$.data.questions[0].score").value(1.00));
    }

    @Test
    @DisplayName("E2E-04: Review part not in scope returns 404 RESOURCE_NOT_FOUND (fail-closed)")
    void testE2E_reviewPartNotInScope_returns404() throws Exception {
        Exam exam = seedCanonicalReviewExam("REVIEW_E2E_04");

        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);

        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        testAttemptService.submitAttempt(attemptId, SubmitAttemptRequest.builder().reason(SubmitReason.MANUAL).build());

        // Query non-existent partId = 99999
        mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/review/99999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404));
    }

    @Test
    @DisplayName("E2E-05: Review in-progress attempt returns 400 INVALID_REQUEST")
    void testE2E_inProgressAttempt_returns400() throws Exception {
        Exam exam = seedCanonicalReviewExam("REVIEW_E2E_05");
        List<ExamPart> parts = examPartRepository.findAll();
        ExamPart readingPart1 = parts.stream()
                .filter(p -> "Reading Passage 1".equals(p.getContentData().get("title")))
                .findFirst().orElseThrow();

        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);

        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        // Attempt is still IN_PROGRESS (not submitted) -> Review must be rejected
        mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/review/" + readingPart1.getId()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    @DisplayName("E2E-06: Zero secret leakage regression - payload never exposes system/AI secrets")
    void testE2E_neverLeaksInternalSecrets() throws Exception {
        Exam exam = seedCanonicalReviewExam("REVIEW_E2E_06");
        List<ExamPart> parts = examPartRepository.findAll();
        ExamPart readingPart1 = parts.stream()
                .filter(p -> "Reading Passage 1".equals(p.getContentData().get("title")))
                .findFirst().orElseThrow();

        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);

        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        testAttemptService.submitAttempt(attemptId, SubmitAttemptRequest.builder().reason(SubmitReason.MANUAL).build());

        MvcResult result = mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/review/" + readingPart1.getId()))
                .andExpect(status().isOk())
                .andReturn();

        String json = result.getResponse().getContentAsString();

        // Assert that NONE of the internal system secrets appear anywhere in the HTTP response
        assertThat(json).doesNotContain("SECRET_INTERNAL_AI_PROMPT_DO_NOT_LEAK");
        assertThat(json).doesNotContain("ai_prompt_context");
        assertThat(json).doesNotContain("ai_feedback");
        assertThat(json).doesNotContain("grading_key");
        assertThat(json).doesNotContain("grading_keys");
    }
}
