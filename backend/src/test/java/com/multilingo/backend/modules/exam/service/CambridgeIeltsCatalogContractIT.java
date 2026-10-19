package com.multilingo.backend.modules.exam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.multilingo.backend.modules.exam.dto.response.ExamDatasetBundle;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.service.impl.StudentExamServiceImpl;
import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.dto.request.SubmitAttemptRequest;
import com.multilingo.backend.modules.testing.dto.response.ExamReviewResponse;
import com.multilingo.backend.modules.testing.dto.response.ReviewQuestionDto;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.SubmitReason;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.service.TestAttemptService;
import com.multilingo.backend.modules.exam.entity.ExamPart;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiClient;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiGenerationRequest;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiGenerationResult;
import com.multilingo.backend.modules.testing.ai.grading.WritingGrade;
import com.multilingo.backend.modules.testing.ai.grading.WritingGradingContext;
import com.multilingo.backend.modules.testing.ai.grading.WritingGradingGenerator;
import com.multilingo.backend.modules.testing.ai.grading.WritingGradingImageLoader;
import com.multilingo.backend.modules.testing.ai.grading.WritingGradingPromptFactory;
import com.multilingo.backend.modules.testing.ai.media.FetchedImage;
import com.multilingo.backend.modules.testing.ai.media.ImageFetcher;
import com.multilingo.backend.modules.testing.config.WritingGradingProperties;
import com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.service.support.ContextDecision;
import com.multilingo.backend.modules.testing.service.support.WritingGradingContextReader;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(username = "1", roles = "USER")
@EnabledIfEnvironmentVariable(named = "OFFICIAL_EXAM_POSTGRES_TEST_URL",
        matches = "jdbc:postgresql://[^/]+/official_exams_test(\\?.*)?")
class CambridgeIeltsCatalogContractIT {
    private static final String SOURCE =
            "/datasets/official-source/cambridge-ielts-20-test-1-full.v2.xlsx";

    @Autowired private ExamParserService parser;
    @Autowired private DefaultExamDatasetService datasets;
    @Autowired private StudentExamServiceImpl studentExams;
    @Autowired private ExamRepository exams;
    @Autowired private ObjectMapper mapper;
    @Autowired private TestAttemptService testAttemptService;
    @Autowired private TestAttemptRepository testAttemptRepository;
    @Autowired private ExamPartRepository examPartRepository;
    @Autowired private AttemptAnswerRepository attemptAnswerRepository;
    @Autowired private WritingGradingProperties gradingProperties;
    @Autowired private WritingGradingContextReader contextReader;
    @Autowired private WritingGradingPromptFactory promptFactory;
    @Autowired private WritingGradingImageLoader imageLoader;
    @Autowired private WritingGradingGenerator generator;
    @Autowired private MockMvc mockMvc;

    @MockBean private GeminiClient geminiClient;
    @MockBean private ImageFetcher imageFetcher;

    @DynamicPropertySource
    static void configureDisposablePostgres(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> System.getenv("OFFICIAL_EXAM_POSTGRES_TEST_URL"));
        registry.add("spring.datasource.username", () -> System.getenv("OFFICIAL_EXAM_POSTGRES_TEST_USERNAME"));
        registry.add("spring.datasource.password", () -> System.getenv("OFFICIAL_EXAM_POSTGRES_TEST_PASSWORD"));
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        registry.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "update");
        registry.add("spring.flyway.enabled", () -> "false");
    }

    @Test
    void draftIsHiddenAndExplicitPublishExposesOnlyCambridgeV2CatalogEntry() throws Exception {
        ExamDatasetBundle bundle = parseBundle();
        var existing = exams.findByCode(bundle.examCode());
        if (existing.isEmpty()) datasets.seed(List.of(bundle), false);

        // Verify over HTTP: draft exam is hidden from student catalog
        mockMvc.perform(get("/api/v1/student/exams")
                        .param("search", "Cambridge")
                        .param("types", "IELTS_ACADEMIC"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[?(@.code == 'IELTS-CAMBRIDGE-20-T1-V2')]").doesNotExist());

        // Publish exam and verify over HTTP: exactly one published entry exists with correct metadata
        datasets.seed(List.of(bundle), true);
        mockMvc.perform(get("/api/v1/student/exams")
                        .param("search", "Cambridge")
                        .param("types", "IELTS_ACADEMIC"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[?(@.code == 'IELTS-CAMBRIDGE-20-T1-V2')]").exists())
                .andExpect(jsonPath("$.data.items[?(@.code == 'IELTS-CAMBRIDGE-20-T1-V2')].durationMinutes").value(150))
                .andExpect(jsonPath("$.data.items[?(@.code == 'IELTS-CAMBRIDGE-20-T1-V2')].title").value("Cambridge Ielts 20 Test 1"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void cambridgeV2AttemptLifecycle_sanitizesWorkspace_preservesAll82ExplanationsInReview_andRetainsImmutableSnapshotOnExamMutation() throws Exception {
        ExamDatasetBundle bundle = parseBundle();
        datasets.seed(List.of(bundle), true);
        Exam exam = exams.findByCode(bundle.examCode()).orElseThrow();

        // 1. Create full attempt
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);

        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        assertThat(attemptId).isNotNull();

        // 2. Client workspace sanitized payload verification
        String workspaceJson = mapper.writeValueAsString(workspace);
        assertThat(workspaceJson)
                .doesNotContain("\"correct_answer\"")
                .doesNotContain("\"correctAnswer\"")
                .doesNotContain("\"explanation\"");

        Map<String, Object> snapshot = workspace.getExamSnapshot();
        assertThat(snapshot).isNotNull();
        List<Map<String, Object>> sections = (List<Map<String, Object>>) snapshot.get("sections");
        assertThat(sections).hasSize(3);

        List<String> workspaceQuestionIds = new ArrayList<>();
        List<Integer> partIds = new ArrayList<>();
        for (Map<String, Object> section : sections) {
            List<Map<String, Object>> parts = (List<Map<String, Object>>) section.get("parts");
            for (Map<String, Object> part : parts) {
                Integer pId = ((Number) part.get("id")).intValue();
                partIds.add(pId);
                List<Map<String, Object>> groups = (List<Map<String, Object>>) part.get("question_groups");
                if (groups == null) {
                    groups = (List<Map<String, Object>>) part.get("questionGroups");
                }
                if (groups != null) {
                    for (Map<String, Object> group : groups) {
                        List<Map<String, Object>> questions = (List<Map<String, Object>>) group.get("questions");
                        if (questions != null) {
                            for (Map<String, Object> q : questions) {
                                workspaceQuestionIds.add((String) q.get("question_id"));
                            }
                        }
                    }
                }
            }
        }
        assertThat(partIds).hasSize(9);
        assertThat(workspaceQuestionIds).hasSize(82);
        assertThat(workspaceQuestionIds.subList(0, 40)).allMatch(id -> id.startsWith("l_"));
        assertThat(workspaceQuestionIds.subList(40, 80)).allMatch(id -> id.startsWith("r_"));
        assertThat(workspaceQuestionIds.subList(80, 82)).containsExactly("w_001", "w_002");

        // 3. Submit attempt
        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();
        testAttemptService.submitAttempt(attemptId, submitReq);

        // 4. Verify review for all 9 parts: all 82 explanations present, Writing tasks are ESSAY without objective verdict/score
        List<ReviewQuestionDto> allReviewQuestions = new ArrayList<>();
        for (Integer pId : partIds) {
            ExamReviewResponse review = testAttemptService.getAttemptReview(attemptId, pId);
            assertThat(review).isNotNull();
            assertThat(review.getAttemptId()).isEqualTo(attemptId);
            assertThat(review.getPartId()).isEqualTo(pId);
            assertThat(review.getQuestions()).isNotEmpty();
            allReviewQuestions.addAll(review.getQuestions());
        }

        assertThat(allReviewQuestions).hasSize(82);
        for (ReviewQuestionDto rq : allReviewQuestions) {
            assertThat(rq.getQuestionId()).isNotBlank();
            assertThat(rq.getExplanation())
                    .as("Explanation must exist for question %s", rq.getQuestionId())
                    .isNotBlank();
        }

        List<ReviewQuestionDto> writingQuestions = allReviewQuestions.stream()
                .filter(q -> "w_001".equals(q.getQuestionId()) || "w_002".equals(q.getQuestionId()))
                .toList();
        assertThat(writingQuestions).hasSize(2);
        for (ReviewQuestionDto wq : writingQuestions) {
            assertThat(wq.getType()).isEqualTo("ESSAY");
            assertThat(wq.getVerdict()).isEqualTo("PENDING");
            assertThat(wq.getScore()).isNull();
            assertThat(wq.getExplanation()).isNotBlank();
        }

        // 5. Mutate / unpublish source exam and assert snapshot immutability
        exam.setIsPublished(false);
        exam.setTitle("MUTATED CAMBRIDGE EXAM");
        exams.save(exam);

        TestAttempt persistedAttempt = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(persistedAttempt.getExamSnapshot()).isNotNull();
        Map<String, Object> persistedSnapshot = persistedAttempt.getExamSnapshot();
        assertThat(persistedSnapshot.get("title")).isNotEqualTo("MUTATED CAMBRIDGE EXAM");

        // Review continues to return all 82 explanations from snapshot without error
        List<ReviewQuestionDto> reviewAfterMutationQuestions = new ArrayList<>();
        for (Integer pId : partIds) {
            ExamReviewResponse reviewAfter = testAttemptService.getAttemptReview(attemptId, pId);
            assertThat(reviewAfter).isNotNull();
            reviewAfterMutationQuestions.addAll(reviewAfter.getQuestions());
        }
        assertThat(reviewAfterMutationQuestions).hasSize(82);
        for (ReviewQuestionDto rq : reviewAfterMutationQuestions) {
            assertThat(rq.getExplanation()).isNotBlank();
        }
    }

    @Test
    void cambridgeV2HttpLifecycle_discoversViaCatalog_autosavesPairAnswers_submitsAndReviewsAcrossAll9Parts() throws Exception {
        ExamDatasetBundle bundle = parseBundle();
        datasets.seed(List.of(bundle), true);

        // 1. Discover published exam via Student Catalog HTTP API
        MvcResult catalogResult = mockMvc.perform(get("/api/v1/student/exams")
                        .param("search", "Cambridge")
                        .param("types", "IELTS_ACADEMIC"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[?(@.code == 'IELTS-CAMBRIDGE-20-T1-V2')]").exists())
                .andReturn();

        JsonNode catalogItems = mapper.readTree(catalogResult.getResponse().getContentAsString())
                .path("data").path("items");
        int publishedExamId = -1;
        for (JsonNode item : catalogItems) {
            if ("IELTS-CAMBRIDGE-20-T1-V2".equals(item.path("code").asText())) {
                publishedExamId = item.path("id").asInt();
                break;
            }
        }
        assertThat(publishedExamId).isPositive();

        // 2. Start attempt via HTTP API
        String createJson = mapper.createObjectNode()
                .put("examId", publishedExamId)
                .put("testScope", "FULL_EXAM")
                .put("testMode", "PRACTICE")
                .toString();
        MvcResult created = mockMvc.perform(post("/api/v1/attempts")
                        .contentType("application/json")
                        .content(createJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.examSnapshot").exists())
                .andExpect(jsonPath("$.data.examSnapshot.sections").isArray())
                .andReturn();

        JsonNode createdData = mapper.readTree(created.getResponse().getContentAsString()).path("data");
        int attemptId = createdData.path("attemptId").asInt();
        int version = createdData.path("version").asInt();
        int listeningPartId = findPartIdForQuestion(createdData.path("examSnapshot"), "l_017");

        // 3. Verify workspace sanitized payload via HTTP GET /api/v1/attempts/{id}/workspace
        MvcResult workspaceResult = mockMvc.perform(get("/api/v1/attempts/{id}/workspace", attemptId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.attemptId").value(attemptId))
                .andExpect(jsonPath("$.data.examSnapshot").exists())
                .andReturn();
        String workspaceJson = workspaceResult.getResponse().getContentAsString();
        assertThat(workspaceJson)
                .doesNotContain("\"correct_answer\"")
                .doesNotContain("\"correctAnswer\"")
                .doesNotContain("\"explanation\"");

        // 4. Autosave answers for pair questions l_017 and l_018
        String answersJson = mapper.createObjectNode()
                .put("version", version)
                .set("answers", mapper.createArrayNode()
                        .add(mapper.createObjectNode()
                                .put("part_id", listeningPartId)
                                .set("answers", mapper.createArrayNode()
                                        .add(mapper.createObjectNode()
                                                .put("question_id", "l_017")
                                                .put("answer", "A"))
                                        .add(mapper.createObjectNode()
                                                .put("question_id", "l_018")
                                                .put("answer", "E")))))
                .toString();

        mockMvc.perform(put("/api/v1/attempts/{id}/answers", attemptId)
                        .contentType("application/json")
                        .content(answersJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value(version + 1));

        // 5. Submit attempt via HTTP API
        String submitJson = mapper.createObjectNode()
                .put("reason", "MANUAL")
                .put("baseVersion", version + 1)
                .set("finalAnswers", mapper.readTree(answersJson).path("answers"))
                .toString();
        mockMvc.perform(post("/api/v1/attempts/{id}/submit", attemptId)
                        .contentType("application/json")
                        .content(submitJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));

        // 6. Verify result via HTTP GET /api/v1/attempts/{id}/result
        mockMvc.perform(get("/api/v1/attempts/{id}/result", attemptId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.resultSummary").exists())
                .andExpect(jsonPath("$.data.resultSummary.totalObjectiveCount").value(80))
                .andExpect(jsonPath("$.data.resultSummary.correctCount").value(2))
                .andExpect(jsonPath("$.data.resultSummary.totalScore").value(2.0))
                .andExpect(jsonPath("$.data.resultSummary.objective.correct").value(2))
                .andExpect(jsonPath("$.data.resultSummary.objective.unanswered").value(78))
                .andExpect(jsonPath("$.data.resultSummary.writing.status").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.data.resultSummary.writing.tasks").isArray())
                .andExpect(jsonPath("$.data.resultSummary.writing.tasks.length()").value(2));

        // 7. Extract all 9 part IDs and review all 9 parts over HTTP API
        List<Integer> partIds = new ArrayList<>();
        for (JsonNode section : createdData.path("examSnapshot").path("sections")) {
            for (JsonNode part : section.path("parts")) {
                partIds.add(part.path("id").asInt());
            }
        }
        assertThat(partIds).hasSize(9);

        int totalReviewedQuestions = 0;
        for (Integer pId : partIds) {
            MvcResult reviewResult = mockMvc.perform(get("/api/v1/attempts/{id}/review/{partId}", attemptId, pId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.attemptId").value(attemptId))
                    .andExpect(jsonPath("$.data.partId").value(pId))
                    .andExpect(jsonPath("$.data.questions").isArray())
                    .andReturn();

            JsonNode reviewData = mapper.readTree(reviewResult.getResponse().getContentAsString()).path("data");
            JsonNode questions = reviewData.path("questions");
            assertThat(questions.size()).isPositive();
            for (JsonNode q : questions) {
                totalReviewedQuestions++;
                String qId = q.path("questionId").asText();
                assertThat(q.path("explanation").asText())
                        .as("Explanation must be present for question %s", qId)
                        .isNotBlank();

                if ("w_001".equals(qId) || "w_002".equals(qId)) {
                    assertThat(q.path("type").asText()).isEqualTo("ESSAY");
                    assertThat(q.path("verdict").asText()).isEqualTo("PENDING");
                    assertThat(q.path("score").isNull() || q.path("score").isMissingNode())
                            .as("Writing score in review must be null or absent")
                            .isTrue();
                } else if ("l_017".equals(qId) || "l_018".equals(qId)) {
                    assertThat(q.path("verdict").asText()).isEqualTo("CORRECT");
                    assertThat(q.path("score").asDouble()).isEqualTo(1.0);
                } else {
                    assertThat(q.path("verdict").asText()).isEqualTo("BLANK");
                    assertThat(q.path("score").asDouble()).isEqualTo(0.0);
                }
            }
        }
        assertThat(totalReviewedQuestions).isEqualTo(82);
    }

    @Test
    void testPairGradingVariationsOverHttp() throws Exception {
        ExamDatasetBundle bundle = parseBundle();
        datasets.seed(List.of(bundle), true);
        Exam exam = exams.findByCode(bundle.examCode()).orElseThrow();

        // 1. Reversed order: l_017=E, l_018=A -> both CORRECT, score 1.0 each
        verifyPairGradingScenario(exam.getId(), "E", "A", "CORRECT", 1.0, "CORRECT", 1.0);

        // 2. Partial correct: l_017=A, l_018=B -> l_017 CORRECT (1.0), l_018 WRONG (0.0)
        verifyPairGradingScenario(exam.getId(), "A", "B", "CORRECT", 1.0, "WRONG", 0.0);

        // 3. Duplicate choice: l_017=A, l_018=A -> l_017 CORRECT (1.0), duplicate l_018 WRONG (0.0)
        verifyPairGradingScenario(exam.getId(), "A", "A", "CORRECT", 1.0, "WRONG", 0.0);

        // 4. Unanswered (blank/null): neither answered -> both BLANK, score 0.0 each
        verifyPairGradingScenario(exam.getId(), null, null, "BLANK", 0.0, "BLANK", 0.0);
    }

    private void verifyPairGradingScenario(int examId, String ans17, String ans18,
                                           String expectedVerdict17, double expectedScore17,
                                           String expectedVerdict18, double expectedScore18) throws Exception {
        String createJson = mapper.createObjectNode()
                .put("examId", examId)
                .put("testScope", "FULL_EXAM")
                .put("testMode", "PRACTICE")
                .toString();
        MvcResult created = mockMvc.perform(post("/api/v1/attempts")
                        .contentType("application/json")
                        .content(createJson))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode createdData = mapper.readTree(created.getResponse().getContentAsString()).path("data");
        int attemptId = createdData.path("attemptId").asInt();
        int version = createdData.path("version").asInt();
        int listeningPartId = findPartIdForQuestion(createdData.path("examSnapshot"), "l_017");

        var answersArray = mapper.createArrayNode();
        if (ans17 != null) {
            answersArray.add(mapper.createObjectNode().put("question_id", "l_017").put("answer", ans17));
        }
        if (ans18 != null) {
            answersArray.add(mapper.createObjectNode().put("question_id", "l_018").put("answer", ans18));
        }

        String answersJson = mapper.createObjectNode()
                .put("version", version)
                .set("answers", mapper.createArrayNode()
                        .add(mapper.createObjectNode()
                                .put("part_id", listeningPartId)
                                .set("answers", answersArray)))
                .toString();

        mockMvc.perform(put("/api/v1/attempts/{id}/answers", attemptId)
                        .contentType("application/json")
                        .content(answersJson))
                .andExpect(status().isOk());

        String submitJson = mapper.createObjectNode()
                .put("reason", "MANUAL")
                .put("baseVersion", version + 1)
                .set("finalAnswers", mapper.readTree(answersJson).path("answers"))
                .toString();
        mockMvc.perform(post("/api/v1/attempts/{id}/submit", attemptId)
                        .contentType("application/json")
                        .content(submitJson))
                .andExpect(status().isOk());

        MvcResult reviewResult = mockMvc.perform(get("/api/v1/attempts/{id}/review/{partId}", attemptId, listeningPartId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.questions[?(@.questionId == 'l_017')].verdict").value(expectedVerdict17))
                .andExpect(jsonPath("$.data.questions[?(@.questionId == 'l_017')].score").value(expectedScore17))
                .andExpect(jsonPath("$.data.questions[?(@.questionId == 'l_018')].verdict").value(expectedVerdict18))
                .andExpect(jsonPath("$.data.questions[?(@.questionId == 'l_018')].score").value(expectedScore18))
                .andReturn();
    }

    @Test
    void cambridgeV2WritingTasks_sendImageForTask1Only_andExcludeExplanationsFromGeminiPrompt() throws Exception {
        ExamDatasetBundle bundle = parseBundle();
        datasets.seed(List.of(bundle), true);
        Exam exam = exams.findByCode(bundle.examCode()).orElseThrow();

        // 1. Create attempt for Cambridge V2
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        TestAttempt attempt = testAttemptRepository.findById(attemptId).orElseThrow();

        JsonNode snapshotNode = mapper.valueToTree(workspace.getExamSnapshot());
        int part8Id = findPartIdForQuestion(snapshotNode, "w_001");
        int part9Id = findPartIdForQuestion(snapshotNode, "w_002");

        // 2. Autosave realistic essays (> 10 words) for both Writing tasks
        String essayTask1 = "The chart illustrates the changes in renewable energy consumption across different countries over a twenty year period between 1990 and 2010.";
        String essayTask2 = "Some people believe that university education should be free for all students regardless of their socioeconomic background and academic performance.";

        testAttemptService.autosaveAnswers(attemptId, AutosaveAnswersRequest.builder()
                .version(1)
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(part8Id)
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                .questionId("w_001")
                                                .answer(essayTask1)
                                                .build()
                                ))
                                .build(),
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(part9Id)
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                .questionId("w_002")
                                                .answer(essayTask2)
                                                .build()
                                ))
                                .build()
                ))
                .build());

        // 3. Obtain authoritative Cambridge V2 explanation strings from frozen attempt snapshot
        String explanation1 = findExplanationInSnapshot(attempt.getExamSnapshot(), "w_001");
        assertThat(explanation1).isNotBlank().hasSizeGreaterThan(20);

        String explanation2 = findExplanationInSnapshot(attempt.getExamSnapshot(), "w_002");
        assertThat(explanation2).isNotBlank().hasSizeGreaterThan(20);

        // 4. Configure fake provider stubs
        byte[] fakeImageData = new byte[]{0x12, 0x34, 0x56, 0x78};
        when(imageFetcher.fetch(any())).thenAnswer(invocation -> {
            String url = invocation.getArgument(0);
            assertThat(url).contains("wp6bfysbo8ulybsgl8i4.png");
            return new FetchedImage("image/png", fakeImageData);
        });

        List<GeminiGenerationRequest> capturedRequests = new ArrayList<>();
        when(geminiClient.generate(any(GeminiGenerationRequest.class))).thenAnswer(invocation -> {
            GeminiGenerationRequest req = invocation.getArgument(0);
            capturedRequests.add(req);
            boolean hasImages = req.images() != null && !req.images().isEmpty();
            String essay = req.userText().contains("renewable energy") ? essayTask1 : essayTask2;
            String visualObs = hasImages ? "\"visualObservations\": \"Chart trends observed.\", " : "";
            return new GeminiGenerationResult(
                    """
                    {
                      %s"feedbackLanguage": "vi",
                      "criteria": [
                        {"code": "TR", "score": 7.5, "feedback": "Ý tưởng phản hồi tốt."},
                        {"code": "CC", "score": 7.0, "feedback": "Bố cục rõ ràng."},
                        {"code": "LR", "score": 7.5, "feedback": "Từ vựng phù hợp."},
                        {"code": "GRA", "score": 7.0, "feedback": "Ngữ pháp chuẩn xác."}
                      ],
                      "overallFeedback": "Bài viết phát triển tốt.",
                      "correctedEssay": "%s",
                      "corrections": []
                    }
                    """.formatted(visualObs, essay),
                    new GeminiGenerationResult.Usage(100, 200, 300)
            );
        });

        List<AttemptAnswer> answers = attemptAnswerRepository.findByAttemptId(attemptId);

        // 5. Run Task 1 (w_001): must extract structured image and exclude explanation from prompt
        ContextDecision decision1 = contextReader.read(attempt, part8Id, "w_001", answers, true);
        assertThat(decision1).isInstanceOf(ContextDecision.Eligible.class);
        WritingGradingContext context1 = ((ContextDecision.Eligible) decision1).context();
        assertThat(context1.hasVisualContext()).isTrue();
        assertThat(context1.imageCount()).isEqualTo(1);
        assertThat(context1.images().getFirst().url()).contains("wp6bfysbo8ulybsgl8i4.png");

        WritingGradingImageLoader.LoadedImages loaded1 = imageLoader.load(context1.images(), Instant.now().plusSeconds(60));
        assertThat(loaded1.parts()).hasSize(1);
        assertThat(loaded1.parts().getFirst().data()).containsExactly(fakeImageData);

        WritingGrade grade1 = generator.generate(context1, loaded1.parts(), loaded1.sha256HexDigests());
        assertThat(grade1).isNotNull();
        assertThat(grade1.overallScore()).isEqualByComparingTo("7.5");

        assertThat(capturedRequests).hasSize(1);
        GeminiGenerationRequest req1 = capturedRequests.get(0);
        assertThat(req1.images()).hasSize(1);
        assertThat(req1.images().getFirst().data()).containsExactly(fakeImageData);
        assertThat(req1.userText()).doesNotContain(explanation1);
        assertThat(req1.systemInstruction()).doesNotContain(explanation1);
        assertThat(req1.userText()).contains(essayTask1);

        // 6. Run Task 2 (w_002): must NOT extract image and exclude explanation from prompt
        ContextDecision decision2 = contextReader.read(attempt, part9Id, "w_002", answers, true);
        assertThat(decision2).isInstanceOf(ContextDecision.Eligible.class);
        WritingGradingContext context2 = ((ContextDecision.Eligible) decision2).context();
        assertThat(context2.hasVisualContext()).isFalse();
        assertThat(context2.imageCount()).isZero();
        assertThat(context2.images()).isEmpty();

        WritingGradingImageLoader.LoadedImages loaded2 = imageLoader.load(context2.images(), Instant.now().plusSeconds(60));
        assertThat(loaded2.parts()).isEmpty();

        WritingGrade grade2 = generator.generate(context2, loaded2.parts(), loaded2.sha256HexDigests());
        assertThat(grade2).isNotNull();
        assertThat(grade2.overallScore()).isEqualByComparingTo("7.5");

        assertThat(capturedRequests).hasSize(2);
        GeminiGenerationRequest req2 = capturedRequests.get(1);
        assertThat(req2.images()).isEmpty();
        assertThat(req2.userText()).doesNotContain(explanation2);
        assertThat(req2.systemInstruction()).doesNotContain(explanation2);
        assertThat(req2.userText()).contains(essayTask2);

        // 7. Verify fake provider interactions
        verify(imageFetcher, times(1)).fetch(argThat(url -> url.contains("wp6bfysbo8ulybsgl8i4.png")));
        verify(geminiClient, times(2)).generate(any());

        // 8. Submit attempt and verify review returns explanations
        testAttemptService.submitAttempt(attemptId, SubmitAttemptRequest.builder().reason(SubmitReason.MANUAL).build());
        ExamReviewResponse reviewPart8 = testAttemptService.getAttemptReview(attemptId, part8Id);
        ExamReviewResponse reviewPart9 = testAttemptService.getAttemptReview(attemptId, part9Id);
        assertThat(reviewPart8.getQuestions().getFirst().getExplanation()).isEqualTo(explanation1);
        assertThat(reviewPart9.getQuestions().getFirst().getExplanation()).isEqualTo(explanation2);
    }

    @Test
    void sourceExamAnswerKeyMutation_doesNotAffectExistingAttemptGradingAndReview() throws Exception {
        ExamDatasetBundle bundle = parseBundle();
        datasets.seed(List.of(bundle), true);
        Exam exam = exams.findByCode(bundle.examCode()).orElseThrow();

        // 1. Create attempt 1 before mutation
        String createJson = mapper.createObjectNode()
                .put("examId", exam.getId())
                .put("testScope", "FULL_EXAM")
                .put("testMode", "PRACTICE")
                .toString();
        MvcResult created1 = mockMvc.perform(post("/api/v1/attempts")
                        .contentType("application/json")
                        .content(createJson))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode created1Data = mapper.readTree(created1.getResponse().getContentAsString()).path("data");
        int attempt1Id = created1Data.path("attemptId").asInt();
        int version1 = created1Data.path("version").asInt();
        int listeningPartId = findPartIdForQuestion(created1Data.path("examSnapshot"), "l_017");

        // 2. Autosave answers for pair questions l_017 and l_018 with known correct choices A and E
        String answers1Json = mapper.createObjectNode()
                .put("version", version1)
                .set("answers", mapper.createArrayNode()
                        .add(mapper.createObjectNode()
                                .put("part_id", listeningPartId)
                                .set("answers", mapper.createArrayNode()
                                        .add(mapper.createObjectNode().put("question_id", "l_017").put("answer", "A"))
                                        .add(mapper.createObjectNode().put("question_id", "l_018").put("answer", "E")))))
                .toString();

        mockMvc.perform(put("/api/v1/attempts/{id}/answers", attempt1Id)
                        .contentType("application/json")
                        .content(answers1Json))
                .andExpect(status().isOk());

        // 3. Mutate source authoring data in database table exam_parts
        // Change pair answer key from ["A", "E"] to ["B", "C"]
        ExamPart listeningPart = examPartRepository.findById(listeningPartId).orElseThrow();
        Map<String, Object> contentData = mapper.convertValue(
                listeningPart.getContentData(),
                new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
        mutateCorrectAnswerInContentData(contentData, "l_017", List.of("B", "C"));
        mutateCorrectAnswerInContentData(contentData, "l_018", List.of("B", "C"));
        listeningPart.setContentData(contentData);
        examPartRepository.saveAndFlush(listeningPart);

        ExamPart reloadedPart = examPartRepository.findById(listeningPartId).orElseThrow();
        assertThat(reloadedPart.getContentData().toString())
                .contains("correct_answer=[B, C]");

        // 4. Submit attempt 1 via HTTP API
        String submit1Json = mapper.createObjectNode()
                .put("reason", "MANUAL")
                .put("baseVersion", version1 + 1)
                .set("finalAnswers", mapper.readTree(answers1Json).path("answers"))
                .toString();
        mockMvc.perform(post("/api/v1/attempts/{id}/submit", attempt1Id)
                        .contentType("application/json")
                        .content(submit1Json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));

        // 5. Verify result of attempt 1: score based on frozen snapshot (both correct)
        mockMvc.perform(get("/api/v1/attempts/{id}/result", attempt1Id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.resultSummary.correctCount").value(2))
                .andExpect(jsonPath("$.data.resultSummary.totalScore").value(2.0));

        // 6. Verify review of attempt 1: both verdict CORRECT (1.0 each)
        mockMvc.perform(get("/api/v1/attempts/{id}/review/{partId}", attempt1Id, listeningPartId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.questions[?(@.questionId == 'l_017')].verdict").value("CORRECT"))
                .andExpect(jsonPath("$.data.questions[?(@.questionId == 'l_017')].score").value(1.0))
                .andExpect(jsonPath("$.data.questions[?(@.questionId == 'l_018')].verdict").value("CORRECT"))
                .andExpect(jsonPath("$.data.questions[?(@.questionId == 'l_018')].score").value(1.0));

        // 7. Create attempt 2 AFTER the mutation and confirm it receives mutated key ["B", "C"]
        MvcResult created2 = mockMvc.perform(post("/api/v1/attempts")
                        .contentType("application/json")
                        .content(createJson))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode created2Data = mapper.readTree(created2.getResponse().getContentAsString()).path("data");
        int attempt2Id = created2Data.path("attemptId").asInt();
        int version2 = created2Data.path("version").asInt();

        String answers2Json = mapper.createObjectNode()
                .put("version", version2)
                .set("answers", mapper.createArrayNode()
                        .add(mapper.createObjectNode()
                                .put("part_id", listeningPartId)
                                .set("answers", mapper.createArrayNode()
                                        .add(mapper.createObjectNode().put("question_id", "l_017").put("answer", "A"))
                                        .add(mapper.createObjectNode().put("question_id", "l_018").put("answer", "E")))))
                .toString();

        mockMvc.perform(put("/api/v1/attempts/{id}/answers", attempt2Id)
                        .contentType("application/json")
                        .content(answers2Json))
                .andExpect(status().isOk());

        String submit2Json = mapper.createObjectNode()
                .put("reason", "MANUAL")
                .put("baseVersion", version2 + 1)
                .set("finalAnswers", mapper.readTree(answers2Json).path("answers"))
                .toString();
        mockMvc.perform(post("/api/v1/attempts/{id}/submit", attempt2Id)
                        .contentType("application/json")
                        .content(submit2Json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));

        // Attempt 2 judged WRONG against mutated answer key ["B", "C"]
        mockMvc.perform(get("/api/v1/attempts/{id}/result", attempt2Id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.resultSummary.correctCount").value(0))
                .andExpect(jsonPath("$.data.resultSummary.totalScore").value(0.0));

        mockMvc.perform(get("/api/v1/attempts/{id}/review/{partId}", attempt2Id, listeningPartId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.questions[?(@.questionId == 'l_017')].verdict").value("WRONG"))
                .andExpect(jsonPath("$.data.questions[?(@.questionId == 'l_017')].score").value(0.0))
                .andExpect(jsonPath("$.data.questions[?(@.questionId == 'l_018')].verdict").value("WRONG"))
                .andExpect(jsonPath("$.data.questions[?(@.questionId == 'l_018')].score").value(0.0));
    }

    @SuppressWarnings("unchecked")
    private void mutateCorrectAnswerInContentData(Map<String, Object> contentData, String targetQuestionId, Object newAnswer) {
        List<Map<String, Object>> groups = (List<Map<String, Object>>) contentData.get("question_groups");
        if (groups == null) {
            groups = (List<Map<String, Object>>) contentData.get("questionGroups");
        }
        if (groups != null) {
            for (Map<String, Object> group : groups) {
                List<Map<String, Object>> questions = (List<Map<String, Object>>) group.get("questions");
                if (questions != null) {
                    for (Map<String, Object> q : questions) {
                        if (targetQuestionId.equals(q.get("question_id")) || targetQuestionId.equals(q.get("questionId"))) {
                            q.put("correct_answer", newAnswer);
                            q.put("correctAnswer", newAnswer);
                        }
                    }
                }
            }
        }
    }

    @SuppressWarnings("unchecked")
    private String findExplanationInSnapshot(Map<String, Object> snapshot, String questionId) {
        List<Map<String, Object>> sections = (List<Map<String, Object>>) snapshot.get("sections");
        if (sections != null) {
            for (Map<String, Object> section : sections) {
                List<Map<String, Object>> parts = (List<Map<String, Object>>) section.get("parts");
                if (parts != null) {
                    for (Map<String, Object> part : parts) {
                        List<Map<String, Object>> groups = (List<Map<String, Object>>) part.get("question_groups");
                        if (groups == null) {
                            groups = (List<Map<String, Object>>) part.get("questionGroups");
                        }
                        if (groups != null) {
                            for (Map<String, Object> group : groups) {
                                List<Map<String, Object>> questions = (List<Map<String, Object>>) group.get("questions");
                                if (questions != null) {
                                    for (Map<String, Object> q : questions) {
                                        if (questionId.equals(q.get("question_id")) || questionId.equals(q.get("questionId"))) {
                                            Object expl = q.get("explanation");
                                            return expl != null ? expl.toString() : null;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        return null;
    }

    private int findPartIdForQuestion(JsonNode snapshot, String questionId) {
        for (JsonNode section : snapshot.path("sections")) {
            for (JsonNode part : section.path("parts")) {
                JsonNode groups = part.has("question_groups")
                        ? part.path("question_groups")
                        : part.path("questionGroups");
                for (JsonNode group : groups) {
                    for (JsonNode question : group.path("questions")) {
                        if (questionId.equals(question.path("question_id").asText())) {
                            return part.path("id").asInt();
                        }
                    }
                }
            }
        }
        throw new AssertionError("Question not found: " + questionId);
    }

    private ExamDatasetBundle parseBundle() throws Exception {
        try (InputStream input = getClass().getResourceAsStream(SOURCE)) {
            assertThat(input).as("Cambridge IELTS V2 source fixture").isNotNull();
            var request = parser.parseExamFile(new MockMultipartFile("file",
                    "Cambridge_Ielts_20_Test_1_(Full_giai_thich).xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    input.readAllBytes()));
            return ExamDatasetBundle.exportForCode(request, "IELTS-CAMBRIDGE-20-T1-V2");
        }
    }
}
