package com.multilingo.backend.modules.testing.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.entity.ExamPart;
import com.multilingo.backend.modules.exam.entity.ExamSection;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamSectionRepository;
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
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@WithMockUser(username = "1", roles = "USER")
class ResultSummaryContractIT {

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

    private final List<Integer> createdAttemptIds = new ArrayList<>();
    private final List<Integer> createdExamIds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        // clean state
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

    private Exam seedCanonicalExam(String code, boolean includeWriting) {
        Exam exam = Exam.builder()
                .code(code)
                .title("Canonical E2E Exam " + code)
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

        // Reading Part 1: 2 questions (q1: SINGLE_CHOICE, q2: TRUE_FALSE_NOT_GIVEN)
        Map<String, Object> rPart1Data = Map.of(
                "title", "Reading Passage 1",
                "question_groups", List.of(
                        Map.of(
                                "instruction", "Answer questions 1-2",
                                "questions", List.of(
                                        Map.of("question_id", "q1", "type", "SINGLE_CHOICE", "correct_answer", "A"),
                                        Map.of("question_id", "q2", "type", "TRUE_FALSE_NOT_GIVEN", "correct_answer", "TRUE")
                                )
                        )
                )
        );
        ExamPart rPart1 = ExamPart.builder()
                .section(readingSection)
                .partNumber(1)
                .contentData(rPart1Data)
                .build();
        examPartRepository.save(rPart1);

        // Reading Part 2: 1 question (q3: FILL_IN_THE_BLANK)
        Map<String, Object> rPart2Data = Map.of(
                "title", "Reading Passage 2",
                "question_groups", List.of(
                        Map.of(
                                "instruction", "Fill in the blank",
                                "questions", List.of(
                                        Map.of("question_id", "q3", "type", "FILL_IN_THE_BLANK", "correct_answer", "cat")
                                )
                        )
                )
        );
        ExamPart rPart2 = ExamPart.builder()
                .section(readingSection)
                .partNumber(2)
                .contentData(rPart2Data)
                .build();
        examPartRepository.save(rPart2);

        // Section 2: Listening (Part 3: 2 questions q4, q5)
        ExamSection listeningSection = ExamSection.builder()
                .exam(exam)
                .skillType("LISTENING")
                .title("Listening Section")
                .durationMinutes(30)
                .orderIndex(2)
                .build();
        listeningSection = examSectionRepository.save(listeningSection);

        Map<String, Object> lPartData = Map.of(
                "title", "Listening Audio 1",
                "question_groups", List.of(
                        Map.of(
                                "instruction", "Listen and choose",
                                "questions", List.of(
                                        Map.of("question_id", "q4", "type", "SINGLE_CHOICE", "correct_answer", "B"),
                                        Map.of("question_id", "q5", "type", "MULTIPLE_CHOICE", "correct_answer", List.of("C", "D"))
                                )
                        )
                )
        );
        ExamPart lPart = ExamPart.builder()
                .section(listeningSection)
                .partNumber(1)
                .contentData(lPartData)
                .build();
        examPartRepository.save(lPart);

        // Optional Section 3: Writing (Part 4: ESSAY)
        if (includeWriting) {
            ExamSection writingSection = ExamSection.builder()
                    .exam(exam)
                    .skillType("WRITING")
                    .title("Writing Section")
                    .durationMinutes(40)
                    .orderIndex(3)
                    .build();
            writingSection = examSectionRepository.save(writingSection);

            Map<String, Object> wPartData = Map.of(
                    "title", "Writing Task 1",
                    "question_groups", List.of(
                            Map.of(
                                    "instruction", "Write an essay about climate change",
                                    "questions", List.of(
                                            Map.of("question_id", "essay_1", "type", "ESSAY")
                                    )
                            )
                    )
            );
            ExamPart wPart = ExamPart.builder()
                    .section(writingSection)
                    .partNumber(1)
                    .contentData(wPartData)
                    .build();
            examPartRepository.save(wPart);
        }

        return exam;
    }

    @Test
    @DisplayName("TC-01, TC-02 / AC-02, AC-03: End-to-end multi-part submission with untouched parts produces full objective scope with BLANKs and no synthetic DB rows")
    void testE2E_multiSection_multiPart_withUntouchedParts() throws Exception {
        Exam exam = seedCanonicalExam("CANONICAL_E2E_01", false);
        List<ExamPart> parts = examPartRepository.findAll();
        // Identify parts
        ExamPart rP1 = parts.stream().filter(p -> "Reading Passage 1".equals(p.getContentData().get("title"))).findFirst().orElseThrow();
        ExamPart rP2 = parts.stream().filter(p -> "Reading Passage 2".equals(p.getContentData().get("title"))).findFirst().orElseThrow();
        ExamPart lP = parts.stream().filter(p -> "Listening Audio 1".equals(p.getContentData().get("title"))).findFirst().orElseThrow();

        // 1. Create attempt
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.MOCK_TEST);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        // 2. Submit with answers:
        // Part 1: q1 = "A" (CORRECT), q2 = "FALSE" (WRONG)
        // Part 2: q3 = "cat" (CORRECT)
        // Part 3 (Listening): untouched!
        AutosaveAnswersRequest.PartAnswerDto ansP1 = new AutosaveAnswersRequest.PartAnswerDto();
        ansP1.setPartId(rP1.getId());
        ansP1.setAnswers(List.of(
                new AutosaveAnswersRequest.QuestionAnswerDto("q1", "A"),
                new AutosaveAnswersRequest.QuestionAnswerDto("q2", "FALSE")
        ));

        AutosaveAnswersRequest.PartAnswerDto ansP2 = new AutosaveAnswersRequest.PartAnswerDto();
        ansP2.setPartId(rP2.getId());
        ansP2.setAnswers(List.of(
                new AutosaveAnswersRequest.QuestionAnswerDto("q3", "cat")
        ));

        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .finalAnswers(List.of(ansP1, ansP2))
                .build();

        testAttemptService.submitAttempt(attemptId, submitReq);

        // 3. Database verification
        TestAttempt dbAttempt = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(dbAttempt.getStatus()).isEqualTo(AttemptStatus.COMPLETED);
        assertThat(dbAttempt.getOverallScore()).isEqualByComparingTo(new BigDecimal("2.00"));

        List<AttemptAnswer> savedAnswers = attemptAnswerRepository.findByAttemptId(attemptId);
        // Untouched part must NOT create synthetic DB rows
        assertThat(savedAnswers).hasSize(2);
        assertThat(savedAnswers).extracting(AttemptAnswer::getPartId)
                .containsExactlyInAnyOrder(rP1.getId(), rP2.getId());

        // 4. HTTP GET Result verification
        mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/result"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.summaryAvailable").value(true))
                .andExpect(jsonPath("$.data.overallScore").value(2.0))
                // Legacy fields
                .andExpect(jsonPath("$.data.resultSummary.totalObjectiveCount").value(5))
                .andExpect(jsonPath("$.data.resultSummary.correctCount").value(2))
                .andExpect(jsonPath("$.data.resultSummary.totalScore").value(2.0))
                .andExpect(jsonPath("$.data.resultSummary.sectionScores.READING").value(2.0))
                .andExpect(jsonPath("$.data.resultSummary.sectionScores.LISTENING").value(0.0))
                // Untouched listening questions received BLANK
                .andExpect(jsonPath("$.data.resultSummary.partResults['" + lP.getId() + "']['q4'].verdict").value("BLANK"))
                .andExpect(jsonPath("$.data.resultSummary.partResults['" + lP.getId() + "']['q5'].verdict").value("BLANK"))
                // Structured summary
                .andExpect(jsonPath("$.data.resultSummary.objective.total").value(5))
                .andExpect(jsonPath("$.data.resultSummary.objective.correct").value(2))
                .andExpect(jsonPath("$.data.resultSummary.objective.incorrect").value(1))
                .andExpect(jsonPath("$.data.resultSummary.objective.unanswered").value(2))
                .andExpect(jsonPath("$.data.resultSummary.objective.accuracy").value(40.00))
                // bySkill
                .andExpect(jsonPath("$.data.resultSummary.objective.bySkill[0].skill").value("READING"))
                .andExpect(jsonPath("$.data.resultSummary.objective.bySkill[0].total").value(3))
                .andExpect(jsonPath("$.data.resultSummary.objective.bySkill[0].correct").value(2))
                .andExpect(jsonPath("$.data.resultSummary.objective.bySkill[1].skill").value("LISTENING"))
                .andExpect(jsonPath("$.data.resultSummary.objective.bySkill[1].total").value(2))
                .andExpect(jsonPath("$.data.resultSummary.objective.bySkill[1].correct").value(0))
                .andExpect(jsonPath("$.data.resultSummary.objective.bySkill[1].unanswered").value(2))
                // byPart
                .andExpect(jsonPath("$.data.resultSummary.objective.byPart").isArray())
                .andExpect(jsonPath("$.data.resultSummary.objective.byPart.length()").value(3));
    }

    @Test
    @DisplayName("TC-03 / AC-02: SINGLE_SKILL scope counts only questions in the selected section")
    void testE2E_scopedAttempt_singleSkill() throws Exception {
        Exam exam = seedCanonicalExam("CANONICAL_E2E_02", false);
        ExamSection readingSection = examSectionRepository.findByExam_Id(exam.getId()).stream()
                .filter(s -> "READING".equals(s.getSkillType())).findFirst().orElseThrow();

        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.SINGLE_SKILL);
        createReq.setTestMode(TestMode.PRACTICE);
        createReq.setTargetSectionId(readingSection.getId());

        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        // Submit with no answers (all 3 reading questions will be BLANK)
        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();
        testAttemptService.submitAttempt(attemptId, submitReq);

        mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/result"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.summaryAvailable").value(true))
                .andExpect(jsonPath("$.data.resultSummary.totalObjectiveCount").value(3)) // only 3 reading questions
                .andExpect(jsonPath("$.data.resultSummary.correctCount").value(0))
                .andExpect(jsonPath("$.data.resultSummary.objective.total").value(3))
                .andExpect(jsonPath("$.data.resultSummary.objective.unanswered").value(3))
                .andExpect(jsonPath("$.data.resultSummary.objective.bySkill.length()").value(1))
                .andExpect(jsonPath("$.data.resultSummary.objective.bySkill[0].skill").value("READING"));
    }

    @Test
    @DisplayName("TC-15 / AC-07: Deleting or modifying exam source after finalization does not affect result GET (reads from persisted snapshot)")
    void testE2E_examSourceDeletedAfterFinalize_summaryRemainsIntact() throws Exception {
        Exam exam = seedCanonicalExam("CANONICAL_E2E_03", false);

        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);

        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        // Submit attempt
        testAttemptService.submitAttempt(attemptId, SubmitAttemptRequest.builder().reason(SubmitReason.MANUAL).build());

        // Now mutate / delete all exam parts and sections from database
        List<ExamSection> sections = examSectionRepository.findByExam_Id(exam.getId());
        for (ExamSection s : sections) {
            examPartRepository.deleteAll(examPartRepository.findBySection_Id(s.getId()));
        }
        examSectionRepository.deleteAll(sections);

        // GET result still succeeds and returns the complete summary from snapshot!
        mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/result"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.summaryAvailable").value(true))
                .andExpect(jsonPath("$.data.resultSummary.totalObjectiveCount").value(5));
    }

    @Test
    @DisplayName("TC-08, TC-09 / AC-05: Objective score visible during AI_GRADING with pending Writing task, word count, and null scores")
    void testE2E_writingAndObjective_writingStatusAndNullScores() throws Exception {
        Exam exam = seedCanonicalExam("CANONICAL_E2E_04", true);
        List<ExamPart> parts = examPartRepository.findAll();
        ExamPart rP1 = parts.stream().filter(p -> "Reading Passage 1".equals(p.getContentData().get("title"))).findFirst().orElseThrow();
        ExamPart wP = parts.stream().filter(p -> "Writing Task 1".equals(p.getContentData().get("title"))).findFirst().orElseThrow();

        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);

        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        // Candidate answers q1 = "A" (CORRECT) and writes essay
        AutosaveAnswersRequest.PartAnswerDto ansP1 = new AutosaveAnswersRequest.PartAnswerDto();
        ansP1.setPartId(rP1.getId());
        ansP1.setAnswers(List.of(new AutosaveAnswersRequest.QuestionAnswerDto("q1", "A")));

        AutosaveAnswersRequest.PartAnswerDto ansWP = new AutosaveAnswersRequest.PartAnswerDto();
        ansWP.setPartId(wP.getId());
        ansWP.setAnswers(List.of(new AutosaveAnswersRequest.QuestionAnswerDto("essay_1", "I believe climate change requires immediate global collective action."))); // 9 words

        testAttemptService.submitAttempt(attemptId, SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .finalAnswers(List.of(ansP1, ansWP))
                .build());

        TestAttempt dbAttempt = testAttemptRepository.findById(attemptId).orElseThrow();
        // Has essay -> should be AI_GRADING
        assertThat(dbAttempt.getStatus()).isEqualTo(AttemptStatus.AI_GRADING);

        mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/result"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("AI_GRADING"))
                .andExpect(jsonPath("$.data.summaryAvailable").value(true))
                .andExpect(jsonPath("$.data.overallScore").value(1.0))
                .andExpect(jsonPath("$.data.resultSummary.totalObjectiveCount").value(5))
                .andExpect(jsonPath("$.data.resultSummary.correctCount").value(1))
                .andExpect(jsonPath("$.data.resultSummary.writing.status").value("PENDING"))
                .andExpect(jsonPath("$.data.resultSummary.writing.tasks[0].questionId").value("essay_1"))
                .andExpect(jsonPath("$.data.resultSummary.writing.tasks[0].wordCount").value(9))
                .andExpect(jsonPath("$.data.resultSummary.writing.tasks[0].score").isEmpty())
                .andExpect(jsonPath("$.data.resultSummary.writing.tasks[0].maxScore").isEmpty());
    }

    @Test
    @DisplayName("TC-07 / AC-08: Raw score 200 is graded, persisted and retrieved across the entire pipeline without clamping or DB overrides")
    void testE2E_rawScore200_pipelineConsistency() throws Exception {
        Exam exam = Exam.builder()
                .code("RAW_200_REAL_EXAM")
                .title("200 Questions Exam")
                .type("IELTS")
                .durationMinutes(120)
                .isPublished(true)
                .build();
        exam = examRepository.save(exam);
        createdExamIds.add(exam.getId());

        ExamSection section = ExamSection.builder()
                .exam(exam)
                .skillType("READING")
                .title("200 Questions Section")
                .durationMinutes(120)
                .orderIndex(1)
                .build();
        section = examSectionRepository.save(section);

        List<Map<String, Object>> qList = new ArrayList<>(200);
        List<AutosaveAnswersRequest.QuestionAnswerDto> candidateAnswers = new ArrayList<>(200);
        for (int i = 1; i <= 200; i++) {
            String qId = "q" + i;
            qList.add(Map.of("question_id", qId, "type", "SINGLE_CHOICE", "correct_answer", "A"));
            candidateAnswers.add(new AutosaveAnswersRequest.QuestionAnswerDto(qId, "A"));
        }

        Map<String, Object> partData = Map.of(
                "title", "Massive Part 200",
                "question_groups", List.of(
                        Map.of(
                                "instruction", "Answer all 200 questions",
                                "questions", qList
                        )
                )
        );

        ExamPart part = ExamPart.builder()
                .section(section)
                .partNumber(1)
                .contentData(partData)
                .build();
        part = examPartRepository.save(part);

        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);

        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        AutosaveAnswersRequest.PartAnswerDto partAnswer = new AutosaveAnswersRequest.PartAnswerDto();
        partAnswer.setPartId(part.getId());
        partAnswer.setAnswers(candidateAnswers);

        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .finalAnswers(List.of(partAnswer))
                .build();

        testAttemptService.submitAttempt(attemptId, submitReq);

        // Verify from database directly (without ANY manual setters!)
        TestAttempt dbAttempt = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(dbAttempt.getStatus()).isEqualTo(AttemptStatus.COMPLETED);
        assertThat(dbAttempt.getOverallScore()).isEqualByComparingTo(new BigDecimal("200.00"));

        List<AttemptAnswer> savedAnswers = attemptAnswerRepository.findByAttemptId(attemptId);
        assertThat(savedAnswers).hasSize(1);
        assertThat(savedAnswers.get(0).getEarnedScore()).isEqualByComparingTo(new BigDecimal("200.00"));

        // Verify GET endpoint returns 200.00 without truncation or clamping
        mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/result"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.summaryAvailable").value(true))
                .andExpect(jsonPath("$.data.overallScore").value(200.0))
                .andExpect(jsonPath("$.data.resultSummary.totalObjectiveCount").value(200))
                .andExpect(jsonPath("$.data.resultSummary.correctCount").value(200))
                .andExpect(jsonPath("$.data.resultSummary.totalScore").value(200.0))
                .andExpect(jsonPath("$.data.resultSummary.objective.total").value(200))
                .andExpect(jsonPath("$.data.resultSummary.objective.correct").value(200))
                .andExpect(jsonPath("$.data.resultSummary.objective.rawScore").value(200.0))
                .andExpect(jsonPath("$.data.resultSummary.objective.accuracy").value(100.00));
    }

    @Test
    @DisplayName("TC-04 / AC-02: SINGLE_PART scope counts only questions in the selected part")
    void testE2E_scopedAttempt_singlePart() throws Exception {
        Exam exam = seedCanonicalExam("CANONICAL_E2E_06", false);
        List<ExamPart> parts = examPartRepository.findAll();
        ExamPart rP1 = parts.stream().filter(p -> "Reading Passage 1".equals(p.getContentData().get("title"))).findFirst().orElseThrow();

        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.SINGLE_PART);
        createReq.setTestMode(TestMode.PRACTICE);
        createReq.setTargetPartId(rP1.getId());

        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        AutosaveAnswersRequest.PartAnswerDto ansP1 = new AutosaveAnswersRequest.PartAnswerDto();
        ansP1.setPartId(rP1.getId());
        ansP1.setAnswers(List.of(
                new AutosaveAnswersRequest.QuestionAnswerDto("q1", "A"),
                new AutosaveAnswersRequest.QuestionAnswerDto("q2", "TRUE")
        ));

        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .finalAnswers(List.of(ansP1))
                .build();
        testAttemptService.submitAttempt(attemptId, submitReq);

        mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/result"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.summaryAvailable").value(true))
                .andExpect(jsonPath("$.data.overallScore").value(2.0))
                .andExpect(jsonPath("$.data.resultSummary.totalObjectiveCount").value(2))
                .andExpect(jsonPath("$.data.resultSummary.correctCount").value(2))
                .andExpect(jsonPath("$.data.resultSummary.objective.total").value(2))
                .andExpect(jsonPath("$.data.resultSummary.objective.byPart.length()").value(1))
                .andExpect(jsonPath("$.data.resultSummary.objective.byPart[0].partId").value(rP1.getId()));
    }
}
