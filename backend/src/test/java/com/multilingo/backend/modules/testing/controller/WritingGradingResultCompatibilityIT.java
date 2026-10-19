package com.multilingo.backend.modules.testing.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.entity.ExamPart;
import com.multilingo.backend.modules.exam.entity.ExamSection;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamSectionRepository;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiClient;
import com.multilingo.backend.modules.testing.ai.grading.WritingGrade;
import com.multilingo.backend.modules.testing.config.WritingGradingProperties;
import com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest;
import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.dto.request.SubmitAttemptRequest;
import com.multilingo.backend.modules.testing.dto.response.ExamResultResponse;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.WritingGradingJob;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.SubmitReason;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.repository.WritingGradingJobRepository;
import com.multilingo.backend.modules.testing.service.TestAttemptService;
import com.multilingo.backend.modules.testing.service.support.Claim;
import com.multilingo.backend.modules.testing.service.support.ClaimDecision;
import com.multilingo.backend.modules.testing.service.support.WritingGradingTransactionCoordinator;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@WithMockUser(username = "1", roles = "USER")
public class WritingGradingResultCompatibilityIT {

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
    private WritingGradingJobRepository jobRepository;

    @Autowired
    private TestAttemptService testAttemptService;

    @Autowired
    private WritingGradingTransactionCoordinator coordinator;

    @Autowired
    private WritingGradingProperties gradingProperties;

    @Autowired
    private com.multilingo.backend.modules.testing.ai.gemini.GeminiProperties geminiProperties;

    @Autowired
    private com.multilingo.backend.modules.analytics.repository.UserQuotaRepository userQuotaRepository;

    @SpyBean
    private IdentityAdapter identityAdapter;

    @MockBean
    private GeminiClient geminiClient;

    private final List<Integer> createdAttemptIds = new ArrayList<>();
    private final List<Integer> createdExamIds = new ArrayList<>();
    private final Integer ownerId = 1;

    @BeforeEach
    void setUp() {
        when(identityAdapter.getCurrentUserId()).thenReturn(ownerId);
        gradingProperties.setEnabled(true);
        gradingProperties.setImagesEnabled(false);
        if (geminiProperties != null) {
            geminiProperties.setEnabled(true);
            geminiProperties.setRequestTimeout(java.time.Duration.ofSeconds(30));
        }

        try {
            userQuotaRepository.deleteAll(userQuotaRepository.findAllByUserIdAndFeatureCode(ownerId, com.multilingo.backend.modules.analytics.service.UserQuotaReservationService.GRADING_FEATURE_CODE));
        } catch (Exception ignored) {}

        com.multilingo.backend.modules.analytics.entity.UserQuota quota = com.multilingo.backend.modules.analytics.entity.UserQuota.builder()
                .userId(ownerId)
                .featureCode(com.multilingo.backend.modules.analytics.service.UserQuotaReservationService.GRADING_FEATURE_CODE)
                .maxLimit(100)
                .usedCount(0)
                .resetDate(java.time.Instant.now().plusSeconds(86400).truncatedTo(java.time.temporal.ChronoUnit.SECONDS))
                .build();
        userQuotaRepository.save(quota);
    }

    @AfterEach
    void tearDown() {
        gradingProperties.setEnabled(false);
        gradingProperties.setImagesEnabled(false);
        if (geminiProperties != null) {
            geminiProperties.setEnabled(false);
        }

        try {
            userQuotaRepository.deleteAll(userQuotaRepository.findAllByUserIdAndFeatureCode(ownerId, com.multilingo.backend.modules.analytics.service.UserQuotaReservationService.GRADING_FEATURE_CODE));
        } catch (Exception ignored) {}

        for (Integer attemptId : createdAttemptIds) {
            try {
                jobRepository.deleteAll(jobRepository.findAllByAttemptId(attemptId));
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

    private Exam seedCanonicalExam(String code) {
        Exam exam = Exam.builder()
                .code(code)
                .title("Result Compatibility Canonical Exam " + code)
                .type("IELTS")
                .examLanguage("en")
                .durationMinutes(60)
                .isPublished(true)
                .build();
        exam = examRepository.save(exam);
        createdExamIds.add(exam.getId());

        // 1. Reading section with 1 objective question
        ExamSection readingSection = ExamSection.builder()
                .exam(exam)
                .skillType("READING")
                .title("Reading Section")
                .durationMinutes(30)
                .orderIndex(1)
                .build();
        readingSection = examSectionRepository.save(readingSection);

        Map<String, Object> rPartData = Map.of(
                "title", "Reading Passage 1",
                "question_groups", List.of(
                        Map.of(
                                "instruction", "Answer question 1",
                                "questions", List.of(
                                        Map.of("question_id", "q_obj_1", "type", "SINGLE_CHOICE", "correct_answer", "A")
                                )
                        )
                )
        );
        ExamPart rPart = ExamPart.builder()
                .section(readingSection)
                .partNumber(1)
                .contentData(rPartData)
                .build();
        examPartRepository.save(rPart);

        // 2. Writing section with 1 ESSAY question
        ExamSection writingSection = ExamSection.builder()
                .exam(exam)
                .skillType("WRITING")
                .title("Writing Section")
                .durationMinutes(30)
                .orderIndex(2)
                .build();
        writingSection = examSectionRepository.save(writingSection);

        Map<String, Object> wPartData = Map.of(
                "title", "Writing Task 1",
                "question_groups", List.of(
                        Map.of(
                                "instruction", "Write an essay about technological progress.",
                                "questions", List.of(
                                        Map.of(
                                                "question_id", "essay_task_1",
                                                "type", "ESSAY",
                                                "prompt", "Discuss both views on artificial intelligence in modern education."
                                        )
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

        return exam;
    }

    @Test
    @DisplayName("AC-08, AC-09: Objective summary remains strictly invariant across AI grading lifecycle without internal leaks")
    void resultSummary_objectiveInvariance_and_noInternalLeaksAcrossGradingStages() throws Exception {
        Exam exam = seedCanonicalExam("COMPAT_INV_01");
        List<ExamPart> parts = examPartRepository.findAll();
        ExamPart readingPart = parts.stream().filter(p -> "Reading Passage 1".equals(p.getContentData().get("title"))).findFirst().orElseThrow();
        ExamPart writingPart = parts.stream().filter(p -> "Writing Task 1".equals(p.getContentData().get("title"))).findFirst().orElseThrow();

        // 1. Create Attempt
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        // 2. Autosave reading (correct) and writing (>10 words)
        AutosaveAnswersRequest readAnswer = AutosaveAnswersRequest.builder()
                .version(1)
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(readingPart.getId())
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                .questionId("q_obj_1")
                                                .answer("A")
                                                .build()
                                ))
                                .build()
                ))
                .build();
        testAttemptService.autosaveAnswers(attemptId, readAnswer);

        String essayText = "Artificial intelligence offers vast potential to revolutionize personalized learning for students globally.";
        AutosaveAnswersRequest writeAnswer = AutosaveAnswersRequest.builder()
                .version(2)
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(writingPart.getId())
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                .questionId("essay_task_1")
                                                .answer(essayText)
                                                .build()
                                ))
                                .build()
                ))
                .build();
        testAttemptService.autosaveAnswers(attemptId, writeAnswer);

        // 3. Submit Attempt
        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();
        testAttemptService.submitAttempt(attemptId, submitReq);

        // 4. Verify /result immediately after submit (Stage: Queued / AI_GRADING)
        MvcResult resultBefore = mockMvc.perform(get("/api/v1/attempts/{id}/result", attemptId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.status").value("AI_GRADING"))
                .andExpect(jsonPath("$.data.resultSummary.objective.total").value(1))
                .andExpect(jsonPath("$.data.resultSummary.objective.correct").value(1))
                .andExpect(jsonPath("$.data.resultSummary.writing.status").value("PENDING"))
                .andExpect(jsonPath("$.data.resultSummary.writing.tasks[0].questionId").value("essay_task_1"))
                .andExpect(jsonPath("$.data.resultSummary.writing.tasks[0].score").doesNotExist())
                .andReturn();

        String rawResultBeforeJson = resultBefore.getResponse().getContentAsString();
        // Strict leak check: No internal tokens, runIds, quotaIds, jobIds
        assertThat(rawResultBeforeJson)
                .doesNotContain("runId")
                .doesNotContain("quotaId")
                .doesNotContain("inputHash")
                .doesNotContain("quotaResetDate");

        ExamResultResponse parsedResultBefore = objectMapper.readValue(
                objectMapper.readTree(rawResultBeforeJson).get("data").toString(),
                ExamResultResponse.class
        );

        // 5. Complete AI Grading via Coordinator
        List<WritingGradingJob> jobs = jobRepository.findAllByAttemptId(attemptId);
        assertThat(jobs).hasSize(1);
        WritingGradingJob job = jobs.get(0);

        ClaimDecision claimDec = coordinator.claim(job.getId());
        assertThat(claimDec).isInstanceOf(ClaimDecision.Granted.class);
        Claim claim = ((ClaimDecision.Granted) claimDec).claim();

        WritingGrade grade = new WritingGrade(
                WritingGrade.DEFAULT_RUBRIC,
                WritingGrade.DEFAULT_LANGUAGE,
                BigDecimal.valueOf(7.5),
                List.of("TR", "CC", "LR", "GRA").stream()
                        .map(code -> new WritingGrade.CriterionGrade(code, BigDecimal.valueOf(7.5), "Mạch lạc và rõ ràng.")).toList(),
                "Bài viết xuất sắc, lập luận thuyết phục.",
                essayText,
                List.of(),
                List.of(new WritingGrade.DiffSegment(WritingGrade.DiffType.EQUAL, essayText))
        );
        coordinator.complete(claim, grade);
        mockMvc.perform(get("/api/v1/attempts/{id}/writing-feedback", attemptId)
                        .param("partId", writingPart.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tasks[0].status").value("DONE"))
                .andExpect(jsonPath("$.data.tasks[0].overall").value(grade.overallScore().doubleValue()))
                .andExpect(jsonPath("$.data.tasks[0].overallFeedback").value(grade.overallFeedback()));

        // Verify Attempt transitioned to COMPLETED
        TestAttempt updatedAttempt = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(updatedAttempt.getStatus()).isEqualTo(AttemptStatus.COMPLETED);

        // 6. Verify /result after AI grading completes
        MvcResult resultAfter = mockMvc.perform(get("/api/v1/attempts/{id}/result", attemptId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andReturn();

        String rawResultAfterJson = resultAfter.getResponse().getContentAsString();
        assertThat(rawResultAfterJson)
                .doesNotContain("runId")
                .doesNotContain("quotaId")
                .doesNotContain("inputHash")
                .doesNotContain("quotaResetDate");

        ExamResultResponse parsedResultAfter = objectMapper.readValue(
                objectMapper.readTree(rawResultAfterJson).get("data").toString(),
                ExamResultResponse.class
        );

        // Objective summary invariance guarantee:
        assertThat(parsedResultAfter.getResultSummary().getObjective())
                .usingRecursiveComparison()
                .isEqualTo(parsedResultBefore.getResultSummary().getObjective());

        // In /result summary, writing task score remains separate (null) - full score is in feedback endpoint
        assertThat(parsedResultAfter.getResultSummary().getWriting().getTasks().get(0).getScore())
                .isNull();
    }

    @Test
    @DisplayName("AC-08: Review and Workspace endpoints strictly preserve candidate answer and never leak AI feedback or rubric")
    void reviewAndWorkspace_neverLeakAiFeedbackOrRubric() throws Exception {
        Exam exam = seedCanonicalExam("COMPAT_REV_01");
        List<ExamPart> parts = examPartRepository.findAll();
        ExamPart writingPart = parts.stream().filter(p -> "Writing Task 1".equals(p.getContentData().get("title"))).findFirst().orElseThrow();

        // 1. Create Attempt
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        String secretEssay = "Technology integration in classrooms enables personalized pacing for diverse cohorts of students.";
        AutosaveAnswersRequest writeAnswer = AutosaveAnswersRequest.builder()
                .version(1)
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(writingPart.getId())
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                .questionId("essay_task_1")
                                                .answer(secretEssay)
                                                .build()
                                ))
                                .build()
                ))
                .build();
        testAttemptService.autosaveAnswers(attemptId, writeAnswer);

        // 2. Submit Attempt
        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();
        testAttemptService.submitAttempt(attemptId, submitReq);

        // 3. Complete Grading
        WritingGradingJob job = jobRepository.findAllByAttemptId(attemptId).get(0);
        ClaimDecision claimDec = coordinator.claim(job.getId());
        Claim claim = ((ClaimDecision.Granted) claimDec).claim();

        String secretFeedbackText = "PRIVATE_TEACHER_AI_FEEDBACK_SECRET";
        WritingGrade grade = new WritingGrade(
                WritingGrade.DEFAULT_RUBRIC,
                WritingGrade.DEFAULT_LANGUAGE,
                BigDecimal.valueOf(8.0),
                List.of("TR", "CC", "LR", "GRA").stream()
                        .map(code -> new WritingGrade.CriterionGrade(code, BigDecimal.valueOf(8.0), secretFeedbackText)).toList(),
                secretFeedbackText,
                secretEssay,
                List.of(),
                List.of(new WritingGrade.DiffSegment(WritingGrade.DiffType.EQUAL, secretEssay))
        );
        coordinator.complete(claim, grade);
        mockMvc.perform(get("/api/v1/attempts/{id}/writing-feedback", attemptId)
                        .param("partId", writingPart.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tasks[0].status").value("DONE"))
                .andExpect(jsonPath("$.data.tasks[0].overall").value(grade.overallScore().doubleValue()))
                .andExpect(jsonPath("$.data.tasks[0].overallFeedback").value(grade.overallFeedback()));

        // 4. Verify /review/{partId} for writing part
        MvcResult reviewResult = mockMvc.perform(get("/api/v1/attempts/{id}/review/{partId}", attemptId, writingPart.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.userAnswers.essay_task_1").value(secretEssay))
                .andReturn();

        String rawReviewJson = reviewResult.getResponse().getContentAsString();
        // Candidate text is preserved
        assertThat(rawReviewJson).contains(secretEssay);
        // AI feedback, rubric, diff, corrections, and criteria are strictly NEVER in review endpoint
        assertThat(rawReviewJson)
                .doesNotContain(secretFeedbackText)
                .doesNotContain("rubricCode")
                .doesNotContain("criteria")
                .doesNotContain("corrections")
                .doesNotContain("diffSegments")
                .doesNotContain("overallFeedback");

        // 5. Verify /workspace
        MvcResult workspaceResult = mockMvc.perform(get("/api/v1/attempts/{id}/workspace", attemptId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andReturn();

        String rawWorkspaceJson = workspaceResult.getResponse().getContentAsString();
        assertThat(rawWorkspaceJson)
                .doesNotContain(secretFeedbackText)
                .doesNotContain("writing_grading_jobs")
                .doesNotContain("runId")
                .doesNotContain("quotaId");
    }

    @Test
    @DisplayName("AC-08, AC-10: Non-owner access is strictly forbidden for Result, Review, and Workspace")
    void nonOwner_forbiddenAccess_resultReviewWorkspace() throws Exception {
        Exam exam = seedCanonicalExam("COMPAT_SEC_01");
        List<ExamPart> parts = examPartRepository.findAll();
        ExamPart writingPart = parts.stream().filter(p -> "Writing Task 1".equals(p.getContentData().get("title"))).findFirst().orElseThrow();

        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        testAttemptService.submitAttempt(attemptId, SubmitAttemptRequest.builder().reason(SubmitReason.MANUAL).build());

        // Switch identity to unauthorized non-owner (user 999)
        when(identityAdapter.getCurrentUserId()).thenReturn(999);

        mockMvc.perform(get("/api/v1/attempts/{id}/result", attemptId))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/attempts/{id}/review/{partId}", attemptId, writingPart.getId()))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/attempts/{id}/workspace", attemptId))
                .andExpect(status().isForbidden());
    }
}
