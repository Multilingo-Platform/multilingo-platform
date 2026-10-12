package com.multilingo.backend.modules.testing.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.entity.ExamPart;
import com.multilingo.backend.modules.exam.entity.ExamSection;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamSectionRepository;
import com.multilingo.backend.modules.testing.adapter.ExamAdapter;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
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
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@WithMockUser(username = "1", roles = "USER")
class PracticeFeedbackContractIT {

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
    private IdentityAdapter identityAdapter;

    @SpyBean
    private ExamAdapter examAdapter;

    private final List<Integer> createdAttemptIds = new ArrayList<>();
    private final List<Integer> createdExamIds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        when(identityAdapter.getCurrentUserId()).thenReturn(1);
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

    private Exam seedCanonicalPracticeExam(String code) {
        Exam exam = Exam.builder()
                .code(code)
                .title("Canonical Practice Contract Exam " + code)
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

        // Reading Part 1: Passage with question group
        Map<String, Object> rPart1Data = new LinkedHashMap<>();
        rPart1Data.put("title", "Reading Passage 1");
        rPart1Data.put("passage", "Renewable energy transitions worldwide.");

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
        q1.put("text", "Question 1 prompt");
        q1.put("correct_answer", "A");
        q1.put("explanation", "Canonical explanation for q1");

        Map<String, Object> q2 = new LinkedHashMap<>();
        q2.put("question_id", "q2");
        q2.put("type", "SINGLE_CHOICE");
        q2.put("text", "Question 2 prompt");
        q2.put("correct_answer", "B");
        q2.put("explanation", "Canonical explanation for q2");

        group1.put("questions", List.of(q1, q2));
        rPart1Data.put("question_groups", List.of(group1));

        ExamPart rPart1 = ExamPart.builder()
                .section(readingSection)
                .partNumber(1)
                .contentData(rPart1Data)
                .build();
        examPartRepository.save(rPart1);

        // Reading Part 2: with question ID q1 (testing collision across parts!) and a MATCHING question
        Map<String, Object> rPart2Data = new LinkedHashMap<>();
        rPart2Data.put("title", "Reading Passage 2");

        Map<String, Object> group2 = new LinkedHashMap<>();
        group2.put("instruction", "Questions for Part 2");

        Map<String, Object> q1Part2 = new LinkedHashMap<>();
        q1Part2.put("question_id", "q1"); // same question ID as Part 1!
        q1Part2.put("type", "SINGLE_CHOICE");
        q1Part2.put("text", "Part 2 question 1 prompt");
        q1Part2.put("correct_answer", "C"); // different key!
        q1Part2.put("explanation", "Canonical explanation for Part 2 q1");

        Map<String, Object> qMatching = new LinkedHashMap<>();
        qMatching.put("question_id", "q_match");
        qMatching.put("type", "MATCHING");
        qMatching.put("text", "Matching prompt");
        qMatching.put("correct_answer", Map.of("1", "A", "2", "B"));
        qMatching.put("explanation", "Canonical explanation for matching");

        group2.put("questions", List.of(q1Part2, qMatching));
        rPart2Data.put("question_groups", List.of(group2));

        ExamPart rPart2 = ExamPart.builder()
                .section(readingSection)
                .partNumber(2)
                .contentData(rPart2Data)
                .build();
        examPartRepository.save(rPart2);

        return exam;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TC_15_13 & AC-05: Real Pipeline Persistence Invariants & Independent Evaluation
    // ─────────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("E2E-01: Feedback evaluates input independently of saved answers, preserving DB row, version, status, and answer rows")
    void testE2E_feedbackPreservesPersistenceInvariantsAndEvaluatesIndependently() throws Exception {
        Exam exam = seedCanonicalPracticeExam("E2E_PERSIST_01");
        List<ExamPart> parts = examPartRepository.findAll();
        ExamPart readingPart1 = parts.stream()
                .filter(p -> "Reading Passage 1".equals(p.getContentData().get("title")))
                .findFirst().orElseThrow();
        Integer rPart1Id = readingPart1.getId();

        // 1. Create Practice attempt
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);

        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        // 2. Autosave answer "B" (which is wrong for q1, correct key is "A")
        AutosaveAnswersRequest autosave = new AutosaveAnswersRequest();
        autosave.setVersion(workspace.getVersion());
        AutosaveAnswersRequest.PartAnswerDto pAns = new AutosaveAnswersRequest.PartAnswerDto();
        pAns.setPartId(rPart1Id);
        pAns.setAnswers(List.of(new AutosaveAnswersRequest.QuestionAnswerDto("q1", "B")));
        autosave.setAnswers(List.of(pAns));
        testAttemptService.autosaveAnswers(attemptId, autosave);

        // Capture DB attempt state before feedback
        TestAttempt attemptBefore = testAttemptRepository.findById(attemptId).orElseThrow();
        Integer versionBefore = attemptBefore.getVersion();
        assertThat(versionBefore).isEqualTo(2);
        assertThat(attemptBefore.getStatus()).isEqualTo(AttemptStatus.IN_PROGRESS);
        assertThat(attemptBefore.getResultSummary()).isNull();
        assertThat(attemptBefore.getOverallScore()).isNull();

        List<AttemptAnswer> answersBefore = attemptAnswerRepository.findByAttemptId(attemptId);
        assertThat(answersBefore).hasSize(1);
        assertThat(answersBefore.get(0).getUserAnswers()).containsEntry("q1", "B");

        // 3. Candidate requests practice feedback for input "C" (also wrong)
        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"partId\": " + rPart1Id + ", \"questionId\": \"q1\", \"answer\": \"C\"}"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.attemptId").value(attemptId))
                .andExpect(jsonPath("$.data.partId").value(rPart1Id))
                .andExpect(jsonPath("$.data.questionId").value("q1"))
                .andExpect(jsonPath("$.data.type").value("SINGLE_CHOICE"))
                .andExpect(jsonPath("$.data.userAnswer").value("C"))
                .andExpect(jsonPath("$.data.verdict").value("WRONG"))
                .andExpect(jsonPath("$.data.score").value(0))
                .andExpect(jsonPath("$.data.correctAnswer").value("A"))
                .andExpect(jsonPath("$.data.explanation").value("Canonical explanation for q1"))
                // Allowlist assertions: no persistence/scoring leakage
                .andExpect(jsonPath("$.data.version").doesNotExist())
                .andExpect(jsonPath("$.data.resultSummary").doesNotExist())
                .andExpect(jsonPath("$.data.examData").doesNotExist())
                .andExpect(jsonPath("$.data.gradingKeys").doesNotExist());

        // 4. Assert JPA database invariants: zero mutation after feedback call
        TestAttempt attemptAfter1 = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(attemptAfter1.getVersion()).isEqualTo(versionBefore);
        assertThat(attemptAfter1.getStatus()).isEqualTo(AttemptStatus.IN_PROGRESS);
        assertThat(attemptAfter1.getResultSummary()).isNull();
        assertThat(attemptAfter1.getOverallScore()).isNull();

        List<AttemptAnswer> answersAfter1 = attemptAnswerRepository.findByAttemptId(attemptId);
        assertThat(answersAfter1).hasSize(1);
        assertThat(answersAfter1.get(0).getUserAnswers()).containsEntry("q1", "B");

        // 5. Candidate requests practice feedback for input "A" (the correct key)
        // Evaluates input "A" independently of DB saved answer "B"
        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"partId\": " + rPart1Id + ", \"questionId\": \"q1\", \"answer\": \"A\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.verdict").value("CORRECT"))
                .andExpect(jsonPath("$.data.score").value(1))
                .andExpect(jsonPath("$.data.correctAnswer").value("A"))
                .andExpect(jsonPath("$.data.userAnswer").value("A"));

        // Assert DB saved answer is STILL "B" and version is STILL 2
        TestAttempt attemptAfter2 = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(attemptAfter2.getVersion()).isEqualTo(versionBefore);
        List<AttemptAnswer> answersAfter2 = attemptAnswerRepository.findByAttemptId(attemptId);
        assertThat(answersAfter2).hasSize(1);
        assertThat(answersAfter2.get(0).getUserAnswers()).containsEntry("q1", "B");
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TC_15_12 & AC-04: Historical Consistency Under Source Exam Mutation
    // ─────────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("E2E-02: Modifying source exam key and explanation after creation does not alter practice feedback (snapshot immutability)")
    void testE2E_sourceExamMutated_feedbackUsesHistoricalSnapshot() throws Exception {
        Exam exam = seedCanonicalPracticeExam("E2E_SNAPSHOT_02");
        List<ExamPart> parts = examPartRepository.findAll();
        ExamPart readingPart1 = parts.stream()
                .filter(p -> "Reading Passage 1".equals(p.getContentData().get("title")))
                .findFirst().orElseThrow();
        Integer rPart1Id = readingPart1.getId();

        // 1. Create attempt -> snapshot captured with q1 correct_answer = "A" and canonical explanation
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);

        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        // 2. Mutate source exam in database: change key to "Z" and explanation to "Mutated Z"
        Map<String, Object> mutatedContentData = new LinkedHashMap<>(readingPart1.getContentData());
        Map<String, Object> group1 = new LinkedHashMap<>();
        group1.put("instruction", "Modified instruction");
        Map<String, Object> mutatedQ1 = new LinkedHashMap<>();
        mutatedQ1.put("question_id", "q1");
        mutatedQ1.put("type", "SINGLE_CHOICE");
        mutatedQ1.put("correct_answer", "Z"); // Mutated key!
        mutatedQ1.put("explanation", "Mutated explanation Z"); // Mutated explanation!
        group1.put("questions", List.of(mutatedQ1));
        mutatedContentData.put("question_groups", List.of(group1));
        readingPart1.setContentData(mutatedContentData);
        examPartRepository.save(readingPart1);

        // 3. Feedback request for "A" (snapshot key) -> CORRECT
        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"partId\": " + rPart1Id + ", \"questionId\": \"q1\", \"answer\": \"A\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.verdict").value("CORRECT"))
                .andExpect(jsonPath("$.data.score").value(1))
                .andExpect(jsonPath("$.data.correctAnswer").value("A"))
                .andExpect(jsonPath("$.data.explanation").value("Canonical explanation for q1"));

        // 4. Feedback request for "Z" (mutated source key) -> WRONG
        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"partId\": " + rPart1Id + ", \"questionId\": \"q1\", \"answer\": \"Z\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.verdict").value("WRONG"))
                .andExpect(jsonPath("$.data.score").value(0))
                .andExpect(jsonPath("$.data.correctAnswer").value("A"))
                .andExpect(jsonPath("$.data.explanation").value("Canonical explanation for q1"));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Source Exam Deletion & No Fallback
    // ─────────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("E2E-03: Deleting source exam does not break feedback; feedback operates strictly on persisted snapshot without ExamAdapter lookup")
    void testE2E_sourceExamDeleted_feedbackSucceedsFromSnapshotWithoutExamLookup() throws Exception {
        Exam exam = seedCanonicalPracticeExam("E2E_DEL_03");
        List<ExamPart> parts = examPartRepository.findAll();
        ExamPart readingPart1 = parts.stream()
                .filter(p -> "Reading Passage 1".equals(p.getContentData().get("title")))
                .findFirst().orElseThrow();
        Integer rPart1Id = readingPart1.getId();

        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);

        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        // Delete all exam parts, sections, and the exam from DB
        List<ExamSection> sections = examSectionRepository.findByExam_Id(exam.getId());
        for (ExamSection s : sections) {
            examPartRepository.deleteAll(examPartRepository.findBySection_Id(s.getId()));
        }
        examSectionRepository.deleteAll(sections);
        examRepository.deleteById(exam.getId());
        createdExamIds.remove(exam.getId());

        // Reset spy invocations on examAdapter to monitor calls during feedback
        clearInvocations(examAdapter);

        // Feedback request succeeds purely from the attempt snapshot
        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"partId\": " + rPart1Id + ", \"questionId\": \"q1\", \"answer\": \"A\"}"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.data.verdict").value("CORRECT"))
                .andExpect(jsonPath("$.data.score").value(1))
                .andExpect(jsonPath("$.data.correctAnswer").value("A"))
                .andExpect(jsonPath("$.data.explanation").value("Canonical explanation for q1"));

        // Verify that examAdapter was NEVER called to load or fallback to current exam
        verifyNoInteractions(examAdapter);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // AC-07: Legacy Snapshot Missing Key Fails Closed (422) Without TV2 Fallback
    // ─────────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("E2E-04: Legacy snapshot without correct_answer returns HTTP 422 fail-closed, does not fallback to TV2")
    void testE2E_legacySnapshotMissingKey_returns422FailClosed() throws Exception {
        Map<String, Object> legacySnapshot = new LinkedHashMap<>();
        legacySnapshot.put("sections", List.of(
                Map.of(
                        "name", "READING",
                        "parts", List.of(
                                Map.of(
                                        "id", 101,
                                        "title", "Legacy Part",
                                        "questions", List.of(
                                                Map.of(
                                                        "question_id", "q_leg_1",
                                                        "type", "SINGLE_CHOICE",
                                                        "options", List.of(
                                                                Map.of("id", "A", "text", "Option A"),
                                                                Map.of("id", "B", "text", "Option B")
                                                        )
                                                        // NOTE: correct_answer is absent!
                                                )
                                        )
                                )
                        )
                )
        ));

        TestAttempt legacyAttempt = TestAttempt.builder()
                .userId(1)
                .examId(99999)
                .testMode(TestMode.PRACTICE)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(Instant.now())
                .examSnapshot(legacySnapshot)
                .version(1)
                .build();
        legacyAttempt = testAttemptRepository.save(legacyAttempt);
        createdAttemptIds.add(legacyAttempt.getId());

        clearInvocations(examAdapter);

        mockMvc.perform(post("/api/v1/attempts/" + legacyAttempt.getId() + "/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"partId\": 101, \"questionId\": \"q_leg_1\", \"answer\": \"A\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value(422))
                .andExpect(header().string("Cache-Control", "no-store"));

        verifyNoInteractions(examAdapter);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TC_15_04 & TC_15_16: Finalized Practice Returns 409, Post-Submit Review Remains Functional
    // ─────────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("E2E-05: Submitting practice attempt transitions it to COMPLETED, returning 409 for feedback while post-submit review works")
    void testE2E_submitPractice_returns409ForFeedback_andPostSubmitReviewWorks() throws Exception {
        Exam exam = seedCanonicalPracticeExam("E2E_SUBMIT_05");
        List<ExamPart> parts = examPartRepository.findAll();
        ExamPart readingPart1 = parts.stream()
                .filter(p -> "Reading Passage 1".equals(p.getContentData().get("title")))
                .findFirst().orElseThrow();
        Integer rPart1Id = readingPart1.getId();

        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);

        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        // Pre-submit feedback succeeds
        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"partId\": " + rPart1Id + ", \"questionId\": \"q1\", \"answer\": \"A\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.verdict").value("CORRECT"));

        // Submit the attempt
        testAttemptService.submitAttempt(attemptId, SubmitAttemptRequest.builder().reason(SubmitReason.MANUAL).build());

        TestAttempt submittedAttempt = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(submittedAttempt.getStatus()).isEqualTo(AttemptStatus.COMPLETED);

        // Post-submit feedback returns HTTP 409 Conflict
        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"partId\": " + rPart1Id + ", \"questionId\": \"q1\", \"answer\": \"A\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(409))
                .andExpect(header().string("Cache-Control", "no-store"));

        // Post-submit review endpoint GET /api/v1/attempts/{id}/review/{partId} works as expected
        mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/review/" + rPart1Id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.attemptId").value(attemptId))
                .andExpect(jsonPath("$.data.partId").value(rPart1Id));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TC_15_15 & AC-08: Workspace & Create Attempt Responses Never Leak Solutions
    // ─────────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("E2E-06: Create attempt and workspace responses never leak solutions, grading keys, or explanations")
    void testE2E_createAndWorkspaceResponses_neverLeakSolutions() throws Exception {
        Exam exam = seedCanonicalPracticeExam("E2E_LEAK_06");

        // 1. Create PRACTICE attempt
        CreateAttemptRequest practiceReq = new CreateAttemptRequest();
        practiceReq.setExamId(exam.getId());
        practiceReq.setTestScope(TestScope.FULL_EXAM);
        practiceReq.setTestMode(TestMode.PRACTICE);

        MvcResult practiceCreateResult = mockMvc.perform(post("/api/v1/attempts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(practiceReq)))
                .andExpect(status().isCreated())
                .andReturn();

        String practiceJson = practiceCreateResult.getResponse().getContentAsString();
        Integer practiceAttemptId = objectMapper.readTree(practiceJson).get("data").get("attemptId").asInt();
        createdAttemptIds.add(practiceAttemptId);

        assertThat(practiceJson).doesNotContain("Canonical explanation for q1");
        assertThat(practiceJson).doesNotContain("correct_answer");
        assertThat(practiceJson).doesNotContain("grading_keys");

        // 2. GET workspace for PRACTICE attempt
        MvcResult practiceWsResult = mockMvc.perform(get("/api/v1/attempts/" + practiceAttemptId + "/workspace"))
                .andExpect(status().isOk())
                .andReturn();
        String practiceWsJson = practiceWsResult.getResponse().getContentAsString();
        assertThat(practiceWsJson).doesNotContain("Canonical explanation for q1");
        assertThat(practiceWsJson).doesNotContain("correct_answer");
        assertThat(practiceWsJson).doesNotContain("grading_keys");

        // 3. Create MOCK_TEST attempt
        CreateAttemptRequest mockReq = new CreateAttemptRequest();
        mockReq.setExamId(exam.getId());
        mockReq.setTestScope(TestScope.FULL_EXAM);
        mockReq.setTestMode(TestMode.MOCK_TEST);

        MvcResult mockCreateResult = mockMvc.perform(post("/api/v1/attempts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(mockReq)))
                .andExpect(status().isCreated())
                .andReturn();

        String mockJson = mockCreateResult.getResponse().getContentAsString();
        Integer mockAttemptId = objectMapper.readTree(mockJson).get("data").get("attemptId").asInt();
        createdAttemptIds.add(mockAttemptId);

        assertThat(mockJson).doesNotContain("Canonical explanation for q1");
        assertThat(mockJson).doesNotContain("correct_answer");
        assertThat(mockJson).doesNotContain("grading_keys");

        // 4. GET workspace for MOCK_TEST attempt
        MvcResult mockWsResult = mockMvc.perform(get("/api/v1/attempts/" + mockAttemptId + "/workspace"))
                .andExpect(status().isOk())
                .andReturn();
        String mockWsJson = mockWsResult.getResponse().getContentAsString();
        assertThat(mockWsJson).doesNotContain("Canonical explanation for q1");
        assertThat(mockWsJson).doesNotContain("correct_answer");
        assertThat(mockWsJson).doesNotContain("grading_keys");
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Multiple Feedback Previews & Zero Answer Rows
    // ─────────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("E2E-07: Multiple independent feedback requests with varying inputs produce isolated results and create zero AttemptAnswer rows")
    void testE2E_multipleFeedbackRequests_independentResults_zeroAnswerRows() throws Exception {
        Exam exam = seedCanonicalPracticeExam("E2E_INDEP_07");
        List<ExamPart> parts = examPartRepository.findAll();
        ExamPart readingPart1 = parts.stream()
                .filter(p -> "Reading Passage 1".equals(p.getContentData().get("title")))
                .findFirst().orElseThrow();
        Integer rPart1Id = readingPart1.getId();

        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);

        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        // Before any feedback: 0 answer rows
        assertThat(attemptAnswerRepository.findByAttemptId(attemptId)).isEmpty();

        // Feedback request 1: "A" -> CORRECT
        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"partId\": " + rPart1Id + ", \"questionId\": \"q1\", \"answer\": \"A\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.verdict").value("CORRECT"))
                .andExpect(jsonPath("$.data.score").value(1));

        assertThat(attemptAnswerRepository.findByAttemptId(attemptId)).isEmpty();

        // Feedback request 2: "B" -> WRONG
        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"partId\": " + rPart1Id + ", \"questionId\": \"q1\", \"answer\": \"B\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.verdict").value("WRONG"))
                .andExpect(jsonPath("$.data.score").value(0));

        assertThat(attemptAnswerRepository.findByAttemptId(attemptId)).isEmpty();

        // Feedback request 3: null -> BLANK (score 0)
        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"partId\": " + rPart1Id + ", \"questionId\": \"q1\", \"answer\": null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.verdict").value("BLANK"))
                .andExpect(jsonPath("$.data.score").value(0));

        // AttemptAnswer rows remain 0
        assertThat(attemptAnswerRepository.findByAttemptId(attemptId)).isEmpty();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TC_15_07 & AC-02: Multi-Part Question ID Collision Integrity
    // ─────────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("E2E-08: Same question ID (q1) in different parts resolves keys strictly by (partId, questionId)")
    void testE2E_questionIdCollisionAcrossParts_scopedStrictly() throws Exception {
        Exam exam = seedCanonicalPracticeExam("E2E_COLLISION_08");
        List<ExamPart> parts = examPartRepository.findAll();
        ExamPart readingPart1 = parts.stream()
                .filter(p -> "Reading Passage 1".equals(p.getContentData().get("title")))
                .findFirst().orElseThrow();
        ExamPart readingPart2 = parts.stream()
                .filter(p -> "Reading Passage 2".equals(p.getContentData().get("title")))
                .findFirst().orElseThrow();

        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);

        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        // Part 1 has q1 with key "A"
        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"partId\": " + readingPart1.getId() + ", \"questionId\": \"q1\", \"answer\": \"A\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.partId").value(readingPart1.getId()))
                .andExpect(jsonPath("$.data.questionId").value("q1"))
                .andExpect(jsonPath("$.data.verdict").value("CORRECT"))
                .andExpect(jsonPath("$.data.correctAnswer").value("A"))
                .andExpect(jsonPath("$.data.explanation").value("Canonical explanation for q1"));

        // Part 2 has q1 with key "C" -> input "A" returns WRONG
        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"partId\": " + readingPart2.getId() + ", \"questionId\": \"q1\", \"answer\": \"A\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.partId").value(readingPart2.getId()))
                .andExpect(jsonPath("$.data.questionId").value("q1"))
                .andExpect(jsonPath("$.data.verdict").value("WRONG"))
                .andExpect(jsonPath("$.data.correctAnswer").value("C"))
                .andExpect(jsonPath("$.data.explanation").value("Canonical explanation for Part 2 q1"));

        // Part 2 with input "C" returns CORRECT
        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"partId\": " + readingPart2.getId() + ", \"questionId\": \"q1\", \"answer\": \"C\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.partId").value(readingPart2.getId()))
                .andExpect(jsonPath("$.data.questionId").value("q1"))
                .andExpect(jsonPath("$.data.verdict").value("CORRECT"))
                .andExpect(jsonPath("$.data.correctAnswer").value("C"));
    }
}
