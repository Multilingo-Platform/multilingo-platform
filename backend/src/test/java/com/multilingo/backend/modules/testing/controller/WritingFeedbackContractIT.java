package com.multilingo.backend.modules.testing.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiClient;
import com.multilingo.backend.modules.testing.ai.grading.WritingGrade;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.WritingGradingJob;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.entity.enums.WritingGradingJobStatus;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.repository.WritingGradingJobRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.HttpHeaders;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@WithMockUser(username = "1", roles = "USER")
class WritingFeedbackContractIT {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TestAttemptRepository testAttemptRepository;

    @Autowired
    private AttemptAnswerRepository attemptAnswerRepository;

    @Autowired
    private WritingGradingJobRepository jobRepository;

    @SpyBean
    private IdentityAdapter identityAdapter;

    @MockBean
    private GeminiClient geminiClient;

    private final List<Integer> createdAttemptIds = new ArrayList<>();
    private final Integer ownerId = 1;
    private final Integer writingPartId = 201;
    private final Integer nonEssayPartId = 202;

    @BeforeEach
    void setUp() {
        when(identityAdapter.getCurrentUserId()).thenReturn(ownerId);
    }

    @AfterEach
    void tearDown() {
        for (Integer attemptId : createdAttemptIds) {
            try {
                jobRepository.deleteAll(jobRepository.findAllByAttemptIdAndPartId(attemptId, writingPartId));
                jobRepository.deleteAll(jobRepository.findAllByAttemptIdAndPartId(attemptId, nonEssayPartId));
                attemptAnswerRepository.deleteAll(attemptAnswerRepository.findByAttemptId(attemptId));
                testAttemptRepository.deleteById(attemptId);
            } catch (Exception ignored) {
            }
        }
        createdAttemptIds.clear();
    }

    private TestAttempt createAndSaveAttempt(Integer userId, AttemptStatus status, Map<String, Object> snapshot) {
        TestAttempt attempt = TestAttempt.builder()
                .userId(userId)
                .examId(10)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.PRACTICE)
                .status(status)
                .startTime(Instant.now().minusSeconds(1800))
                .examSnapshot(snapshot)
                .build();
        attempt = testAttemptRepository.save(attempt);
        createdAttemptIds.add(attempt.getId());
        return attempt;
    }

    private Map<String, Object> createSnapshotWithWritingPart(Integer partId, String questionType, String questionId) {
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("question_id", questionId);
        question.put("type", questionType);
        question.put("label", "Task 1");

        Map<String, Object> group = new LinkedHashMap<>();
        group.put("questions", List.of(question));

        Map<String, Object> part = new LinkedHashMap<>();
        part.put("part_id", partId);
        part.put("title", "Writing Part 1");
        part.put("question_groups", List.of(group));

        Map<String, Object> section = new LinkedHashMap<>();
        section.put("name", "WRITING");
        section.put("parts", List.of(part));

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("examLanguage", "en");
        snapshot.put("sections", List.of(section));
        return snapshot;
    }

    private Map<String, Object> createSnapshotWithTwoTasks(Integer partId, String q1Id, String q2Id) {
        Map<String, Object> q1 = Map.of("question_id", q1Id, "type", "ESSAY", "label", "Task 1");
        Map<String, Object> q2 = Map.of("question_id", q2Id, "type", "ESSAY", "label", "Task 2");

        Map<String, Object> group = Map.of("questions", List.of(q1, q2));
        Map<String, Object> part = Map.of("part_id", partId, "title", "Writing Section Part", "question_groups", List.of(group));
        Map<String, Object> section = Map.of("name", "WRITING", "parts", List.of(part));
        return Map.of("examLanguage", "en", "sections", List.of(section));
    }

    @Test
    @DisplayName("GET feedback thành công trả 200, header Cache-Control: no-store, DTO an toàn không rò rỉ runId/quotaId/jobId/inputHash/token")
    void getWritingFeedback_owner_succeededAttempt_returns200WithNoStoreAndSafePayload() throws Exception {
        Map<String, Object> snapshot = createSnapshotWithWritingPart(writingPartId, "ESSAY", "q-essay-1");
        TestAttempt attempt = createAndSaveAttempt(ownerId, AttemptStatus.COMPLETED, snapshot);

        WritingGrade grade = new WritingGrade(
                WritingGrade.DEFAULT_RUBRIC,
                "vi",
                BigDecimal.valueOf(7.5),
                List.of(
                        new WritingGrade.CriterionGrade("TR", BigDecimal.valueOf(7.5), "Mô tả biểu đồ tốt."),
                        new WritingGrade.CriterionGrade("CC", BigDecimal.valueOf(7.0), "Mạch lạc và rõ ràng."),
                        new WritingGrade.CriterionGrade("LR", BigDecimal.valueOf(7.5), "Từ vựng phong phú."),
                        new WritingGrade.CriterionGrade("GRA", BigDecimal.valueOf(8.0), "Ngữ pháp chuẩn xác.")
                ),
                "Bài làm rất tốt.",
                "The chart illustrates the changes in renewable energy production over ten years.",
                List.of(),
                List.of(new WritingGrade.DiffSegment(WritingGrade.DiffType.EQUAL, "The chart illustrates the changes in renewable energy production over ten years."))
        );

        Map<String, Object> gradeMap = objectMapper.convertValue(grade, Map.class);
        Map<String, Object> aiFeedback = Map.of(
                "schemaVersion", 1,
                "tasks", Map.of("q-essay-1", gradeMap)
        );

        String learnerEssay = "The chart illustrates the changes in renewable energy production over ten years.";
        AttemptAnswer answer = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(writingPartId)
                .userAnswers(Map.of("q-essay-1", learnerEssay))
                .aiFeedback(aiFeedback)
                .build();
        attemptAnswerRepository.save(answer);

        MvcResult result = mockMvc.perform(get("/api/v1/attempts/{attemptId}/writing-feedback", attempt.getId())
                        .param("partId", String.valueOf(writingPartId)))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.attemptId").value(attempt.getId()))
                .andExpect(jsonPath("$.data.partId").value(writingPartId))
                .andExpect(jsonPath("$.data.attemptStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.data.partStatus").value("DONE"))
                .andExpect(jsonPath("$.data.tasks").isArray())
                .andExpect(jsonPath("$.data.tasks[0].questionId").value("q-essay-1"))
                .andExpect(jsonPath("$.data.tasks[0].status").value("DONE"))
                .andExpect(jsonPath("$.data.tasks[0].overall").value(7.5))
                .andExpect(jsonPath("$.data.tasks[0].maxScore").value(9.0))
                .andExpect(jsonPath("$.data.tasks[0].criteria").isArray())
                .andExpect(jsonPath("$.data.tasks[0].criteria.length()").value(4))
                .andExpect(jsonPath("$.data.tasks[0].originalText").value(learnerEssay))
                .andExpect(jsonPath("$.data.tasks[0].diff").isArray())
                .andReturn();

        String json = result.getResponse().getContentAsString();
        assertThat(json).doesNotContain("\"runId\"");
        assertThat(json).doesNotContain("\"quotaId\"");
        assertThat(json).doesNotContain("\"jobId\"");
        assertThat(json).doesNotContain("\"inputHash\"");
        assertThat(json).doesNotContain("\"token\"");

        verifyNoInteractions(geminiClient);
    }

    @Test
    @DisplayName("Non-owner truy cập ném FORBIDDEN (HTTP 403)")
    void getWritingFeedback_nonOwner_returns403Forbidden() throws Exception {
        Map<String, Object> snapshot = createSnapshotWithWritingPart(writingPartId, "ESSAY", "q1");
        TestAttempt attempt = createAndSaveAttempt(ownerId, AttemptStatus.COMPLETED, snapshot);

        when(identityAdapter.getCurrentUserId()).thenReturn(999);

        mockMvc.perform(get("/api/v1/attempts/{attemptId}/writing-feedback", attempt.getId())
                        .param("partId", String.valueOf(writingPartId)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(geminiClient);
    }

    @Test
    @DisplayName("Attempt không tồn tại trả về FORBIDDEN (HTTP 403 theo convention để tránh brute-force)")
    void getWritingFeedback_missingAttempt_returns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/attempts/{attemptId}/writing-feedback", 999999)
                        .param("partId", String.valueOf(writingPartId)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(geminiClient);
    }

    @Test
    @DisplayName("Attempt còn IN_PROGRESS trả về BAD_REQUEST (HTTP 400) và tuyệt đối không lazy-finalize")
    void getWritingFeedback_inProgressAttempt_returns400AndDoesNotLazyFinalize() throws Exception {
        Map<String, Object> snapshot = createSnapshotWithWritingPart(writingPartId, "ESSAY", "q1");
        TestAttempt attempt = createAndSaveAttempt(ownerId, AttemptStatus.IN_PROGRESS, snapshot);

        mockMvc.perform(get("/api/v1/attempts/{attemptId}/writing-feedback", attempt.getId())
                        .param("partId", String.valueOf(writingPartId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));

        TestAttempt reloaded = testAttemptRepository.findById(attempt.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(AttemptStatus.IN_PROGRESS);

        verifyNoInteractions(geminiClient);
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-1", "abc"})
    @DisplayName("Invalid attemptId ném INVALID_REQUEST (HTTP 400)")
    void getWritingFeedback_invalidAttemptId_returns400(String invalidAttemptId) throws Exception {
        mockMvc.perform(get("/api/v1/attempts/{attemptId}/writing-feedback", invalidAttemptId)
                        .param("partId", String.valueOf(writingPartId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));

        verifyNoInteractions(geminiClient);
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-1", "abc"})
    @DisplayName("Invalid partId ném INVALID_REQUEST (HTTP 400)")
    void getWritingFeedback_invalidPartId_returns400(String invalidPartId) throws Exception {
        mockMvc.perform(get("/api/v1/attempts/{attemptId}/writing-feedback", 1)
                        .param("partId", invalidPartId))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));

        verifyNoInteractions(geminiClient);
    }

    @Test
    @DisplayName("Missing partId param ném INVALID_REQUEST (HTTP 400)")
    void getWritingFeedback_missingPartIdParam_returns400() throws Exception {
        mockMvc.perform(get("/api/v1/attempts/{attemptId}/writing-feedback", 1))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));

        verifyNoInteractions(geminiClient);
    }

    @Test
    @DisplayName("partId không có trong exam snapshot ném RESOURCE_NOT_FOUND (HTTP 404)")
    void getWritingFeedback_partNotInSnapshot_returns404() throws Exception {
        Map<String, Object> snapshot = createSnapshotWithWritingPart(writingPartId, "ESSAY", "q1");
        TestAttempt attempt = createAndSaveAttempt(ownerId, AttemptStatus.COMPLETED, snapshot);

        mockMvc.perform(get("/api/v1/attempts/{attemptId}/writing-feedback", attempt.getId())
                        .param("partId", "9999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404));

        verifyNoInteractions(geminiClient);
    }

    @Test
    @DisplayName("partId trong snapshot nhưng không có câu hỏi ESSAY ném RESOURCE_NOT_FOUND (HTTP 404)")
    void getWritingFeedback_partWithoutEssayQuestions_returns404() throws Exception {
        Map<String, Object> snapshot = createSnapshotWithWritingPart(nonEssayPartId, "SINGLE_CHOICE", "q-mcq-1");
        TestAttempt attempt = createAndSaveAttempt(ownerId, AttemptStatus.COMPLETED, snapshot);

        mockMvc.perform(get("/api/v1/attempts/{attemptId}/writing-feedback", attempt.getId())
                        .param("partId", String.valueOf(nonEssayPartId)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404));

        verifyNoInteractions(geminiClient);
    }

    @Test
    @DisplayName("Bài viết quá ngắn (<= 10 từ) trả 200 DONE với overall 0.0 và reasonCode TOO_SHORT")
    void getWritingFeedback_tooShortEssay_returns200WithZeroScoreAndTooShortReason() throws Exception {
        Map<String, Object> snapshot = createSnapshotWithWritingPart(writingPartId, "ESSAY", "q-short");
        TestAttempt attempt = createAndSaveAttempt(ownerId, AttemptStatus.COMPLETED, snapshot);

        String shortText = "I do not know.";
        WritingGrade tooShortGrade = WritingGrade.tooShort(shortText);
        Map<String, Object> gradeMap = objectMapper.convertValue(tooShortGrade, Map.class);
        Map<String, Object> aiFeedback = Map.of(
                "schemaVersion", 1,
                "tasks", Map.of("q-short", gradeMap)
        );

        AttemptAnswer answer = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(writingPartId)
                .userAnswers(Map.of("q-short", shortText))
                .aiFeedback(aiFeedback)
                .build();
        attemptAnswerRepository.save(answer);

        mockMvc.perform(get("/api/v1/attempts/{attemptId}/writing-feedback", attempt.getId())
                        .param("partId", String.valueOf(writingPartId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.partStatus").value("DONE"))
                .andExpect(jsonPath("$.data.tasks[0].status").value("DONE"))
                .andExpect(jsonPath("$.data.tasks[0].overall").value(0))
                .andExpect(jsonPath("$.data.tasks[0].reasonCode").value("TOO_SHORT"))
                .andExpect(jsonPath("$.data.tasks[0].originalText").value(shortText));

        verifyNoInteractions(geminiClient);
    }

    @Test
    @DisplayName("Attempt cũ không có job trả UNAVAILABLE với LEGACY_NO_JOB")
    void getWritingFeedback_legacyAttemptWithoutJob_returns200WithUnavailable() throws Exception {
        Map<String, Object> snapshot = createSnapshotWithWritingPart(writingPartId, "ESSAY", "q1");
        TestAttempt attempt = createAndSaveAttempt(ownerId, AttemptStatus.COMPLETED, snapshot);

        mockMvc.perform(get("/api/v1/attempts/{attemptId}/writing-feedback", attempt.getId())
                        .param("partId", String.valueOf(writingPartId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.partStatus").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.data.tasks[0].status").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.data.tasks[0].reasonCode").value("LEGACY_NO_JOB"))
                .andExpect(jsonPath("$.data.tasks[0].overall").doesNotExist());

        verifyNoInteractions(geminiClient);
    }

    @Test
    @DisplayName("Job ở trạng thái WAITING trả về QUEUED với waitReason")
    void getWritingFeedback_queuedJob_returns200WithQueued() throws Exception {
        Map<String, Object> snapshot = createSnapshotWithWritingPart(writingPartId, "ESSAY", "q1");
        TestAttempt attempt = createAndSaveAttempt(ownerId, AttemptStatus.AI_GRADING_QUEUED, snapshot);

        WritingGradingJob job = WritingGradingJob.builder()
                .attemptId(attempt.getId())
                .partId(writingPartId)
                .questionId("q1")
                .inputHash("test-hash-queued")
                .status(WritingGradingJobStatus.WAITING)
                .waitReason("PROVIDER_DISABLED")
                .contextJson(Map.of("prompt", "dummy"))
                .build();
        jobRepository.save(job);

        mockMvc.perform(get("/api/v1/attempts/{attemptId}/writing-feedback", attempt.getId())
                        .param("partId", String.valueOf(writingPartId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.partStatus").value("QUEUED"))
                .andExpect(jsonPath("$.data.tasks[0].status").value("QUEUED"))
                .andExpect(jsonPath("$.data.tasks[0].reasonCode").value("PROVIDER_DISABLED"))
                .andExpect(jsonPath("$.data.tasks[0].overall").doesNotExist());

        verifyNoInteractions(geminiClient);
    }

    @Test
    @DisplayName("Nhiều task ESSAY trong part trả về đúng thứ tự snapshot")
    void getWritingFeedback_multipleEssayTasks_preservesOrderInSnapshot() throws Exception {
        Map<String, Object> snapshot = createSnapshotWithTwoTasks(writingPartId, "task-1", "task-2");
        TestAttempt attempt = createAndSaveAttempt(ownerId, AttemptStatus.AI_GRADING, snapshot);

        // Save jobs in reverse order
        WritingGradingJob j2 = WritingGradingJob.builder()
                .attemptId(attempt.getId())
                .partId(writingPartId)
                .questionId("task-2")
                .inputHash("hash-2")
                .status(WritingGradingJobStatus.READY)
                .contextJson(Map.of("prompt", "dummy"))
                .build();
        jobRepository.save(j2);

        WritingGradingJob j1 = WritingGradingJob.builder()
                .attemptId(attempt.getId())
                .partId(writingPartId)
                .questionId("task-1")
                .inputHash("hash-1")
                .status(WritingGradingJobStatus.RUNNING)
                .contextJson(Map.of("prompt", "dummy"))
                .build();
        jobRepository.save(j1);

        mockMvc.perform(get("/api/v1/attempts/{attemptId}/writing-feedback", attempt.getId())
                        .param("partId", String.valueOf(writingPartId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tasks[0].questionId").value("task-1"))
                .andExpect(jsonPath("$.data.tasks[1].questionId").value("task-2"));

        verifyNoInteractions(geminiClient);
    }

    private static final String REGRESSION_ESSAY = "One two three four five six seven eight nine ten eleven twelve.";

    private Map<String, Object> validRegressionGrade(boolean zero) {
        var score = zero ? BigDecimal.ZERO : new BigDecimal("6.5");
        var grade = new WritingGrade("WRITING_EN_V1", "vi", score,
                List.of(new WritingGrade.CriterionGrade("TR", score, "Nhận xét TR"),
                        new WritingGrade.CriterionGrade("CC", score, "Nhận xét CC"),
                        new WritingGrade.CriterionGrade("LR", score, "Nhận xét LR"),
                        new WritingGrade.CriterionGrade("GRA", score, "Nhận xét GRA")),
                "Nhận xét tổng quan", "The" + REGRESSION_ESSAY.substring(3),
                List.of(new WritingGrade.Correction(0, 3, "The", "Sửa từ")),
                List.of(new WritingGrade.DiffSegment(WritingGrade.DiffType.DELETE, "One"),
                        new WritingGrade.DiffSegment(WritingGrade.DiffType.INSERT, "The"),
                        new WritingGrade.DiffSegment(WritingGrade.DiffType.EQUAL, REGRESSION_ESSAY.substring(3))));
        return objectMapper.convertValue(grade, Map.class);
    }
    private AttemptAnswer answerWithGrade(TestAttempt attempt, String essay, Map<String, Object> grade, boolean fallback) {
        AttemptAnswer answer = attemptAnswerRepository.save(AttemptAnswer.builder().attempt(attempt).partId(writingPartId)
                .userAnswers(Map.of("q1", essay)).aiFeedback(fallback ? null : Map.of("schemaVersion", 1, "tasks", Map.of("q1", grade))).build());
        if (fallback) saveRegressionJob(attempt, WritingGradingJobStatus.SUCCEEDED, grade);
        return answer;
    }
    private void saveRegressionJob(TestAttempt attempt, WritingGradingJobStatus status, Map<String, Object> result) {
        jobRepository.save(WritingGradingJob.builder().attemptId(attempt.getId()).partId(writingPartId).questionId("q1")
                .inputHash("regression-hash").contextJson(Map.of("taskPrompt", "Prompt"))
                .status(status).resultJson(result).build());
    }
    private com.fasterxml.jackson.databind.JsonNode getRegressionTask(TestAttempt attempt) throws Exception {
        String response = mockMvc.perform(get("/api/v1/attempts/{attemptId}/writing-feedback", attempt.getId())
                        .param("partId", writingPartId.toString()))
                .andExpect(status().isOk()).andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        verifyNoInteractions(geminiClient);
        return objectMapper.readTree(response).path("data").path("tasks").get(0);
    }
    private String persistedRegressionState(TestAttempt attempt, AttemptAnswer answer) throws Exception {
        TestAttempt fresh = testAttemptRepository.findById(attempt.getId()).orElseThrow();
        AttemptAnswer freshAnswer = attemptAnswerRepository.findById(answer.getId()).orElseThrow();
        var state = objectMapper.createObjectNode();
        state.put("status", fresh.getStatus().name()); state.put("version", fresh.getVersion());
        state.set("snapshot", objectMapper.valueToTree(fresh.getExamSnapshot()));
        state.set("answers", objectMapper.valueToTree(freshAnswer.getUserAnswers()));
        state.set("feedback", objectMapper.valueToTree(freshAnswer.getAiFeedback()));
        state.set("jobResults", objectMapper.valueToTree(jobRepository.findAllByAttemptIdAndPartId(attempt.getId(), writingPartId)
                .stream().map(j -> Arrays.asList(j.getStatus(), j.getResultJson(), j.getAttemptCount(), j.getQuotaReserved())).toList()));
        return state.toString();
    }

    static java.util.stream.Stream<org.junit.jupiter.params.provider.Arguments> originalBoundaries() {
        return java.util.stream.Stream.of("legacy", "local", "pending", "failed", "queued", "succeeded").flatMap(path ->
                java.util.stream.Stream.of("a", "\uD83D\uDE00").flatMap(character ->
                        java.util.stream.Stream.of(8000, 8001).map(size -> org.junit.jupiter.params.provider.Arguments.of(path, character, size))));
    }
    @ParameterizedTest
    @org.junit.jupiter.params.provider.MethodSource("originalBoundaries")
    void originalTextCodePointBoundary_isBoundedAcrossAllProjectionPaths_withoutWrites(String path, String character, int size) throws Exception {
        String essay = character.repeat(size);
        TestAttempt attempt = createAndSaveAttempt(ownerId, AttemptStatus.COMPLETED, createSnapshotWithWritingPart(writingPartId, "ESSAY", "q1"));
        AttemptAnswer answer = attemptAnswerRepository.save(AttemptAnswer.builder().attempt(attempt).partId(writingPartId)
                .userAnswers(Map.of("q1", essay)).aiFeedback(path.equals("local") ? Map.of("tasks", Map.of("q1", Map.of(
                        "status", "UNAVAILABLE", "reasonCode", "ESSAY_TOO_LONG"))) : null).build());
        if (!path.equals("legacy") && !path.equals("local")) {
            var status = switch (path) {case "pending" -> WritingGradingJobStatus.READY; case "failed" -> WritingGradingJobStatus.FAILED;
                case "queued" -> WritingGradingJobStatus.WAITING; default -> WritingGradingJobStatus.SUCCEEDED;};
            saveRegressionJob(attempt, status, path.equals("succeeded") ? objectMapper.convertValue(WritingGrade.tooShort(essay), Map.class) : null);
        }
        String before = persistedRegressionState(attempt, answer);
        var task = getRegressionTask(attempt);
        if (size == 8000) assertThat(task.path("originalText").asText()).isEqualTo(essay);
        else {
            assertThat(task.hasNonNull("originalText")).isFalse();
            assertThat(task.path("status").asText()).isEqualTo("UNAVAILABLE");
            assertThat(task.path("reasonCode").asText()).isEqualTo("ESSAY_TOO_LONG");
            assertThat(task.hasNonNull("overall")).isFalse();
            assertThat(task.hasNonNull("correctedEssay")).isFalse();
            assertThat(task.path("diff").size()).isZero();
            assertThat(task.toString()).doesNotContain(essay);
        }
        assertThat(persistedRegressionState(attempt, answer)).isEqualTo(before);
    }

    static java.util.stream.Stream<org.junit.jupiter.params.provider.Arguments> malformedPersistedGrades() {
        return java.util.stream.Stream.of("rubric", "language", "criterion-step", "overall-step", "overall-mean", "missing-corrected",
                "missing-feedback", "criterion-feedback-cap", "overall-feedback-cap", "corrected-cap", "replacement-cap", "explanation-cap",
                "offset", "reconstruction", "diff", "missing-diff", "diff-type", "duplicate-criterion").flatMap(kind ->
                java.util.stream.Stream.of(false, true).map(fallback -> org.junit.jupiter.params.provider.Arguments.of(kind, fallback)));
    }
    @ParameterizedTest
    @org.junit.jupiter.params.provider.MethodSource("malformedPersistedGrades")
    void malformedPersistedGrade_canonicalAndJobFallback_failClosedWithoutWrites(String kind, boolean fallback) throws Exception {
        var grade = objectMapper.valueToTree(validRegressionGrade(false));
        var root = (com.fasterxml.jackson.databind.node.ObjectNode)grade;
        var criterion = (com.fasterxml.jackson.databind.node.ObjectNode)root.path("criteria").get(0);
        var correction = (com.fasterxml.jackson.databind.node.ObjectNode)root.path("corrections").get(0);
        switch (kind) {
            case "rubric" -> root.put("rubricCode", "INVALID_RUBRIC");
            case "language" -> root.put("feedbackLanguage", "en");
            case "criterion-step" -> criterion.put("score", new BigDecimal("7.25"));
            case "overall-step" -> root.put("overallScore", new BigDecimal("7.3"));
            case "overall-mean" -> root.put("overallScore", new BigDecimal("8.0"));
            case "missing-corrected" -> root.putNull("correctedEssay");
            case "missing-feedback" -> criterion.putNull("feedback");
            case "criterion-feedback-cap" -> criterion.put("feedback", "x".repeat(1001));
            case "overall-feedback-cap" -> root.put("overallFeedback", "x".repeat(2001));
            case "corrected-cap" -> root.put("correctedEssay", "x".repeat(16001));
            case "replacement-cap" -> correction.put("replacement", "x".repeat(2001));
            case "explanation-cap" -> correction.put("explanation", "x".repeat(501));
            case "offset" -> correction.put("end", 9999);
            case "reconstruction" -> root.put("correctedEssay", "Different essay");
            case "diff" -> ((com.fasterxml.jackson.databind.node.ObjectNode)root.path("diff").get(0)).put("text", "Mismatch");
            case "missing-diff" -> root.remove("diff");
            case "diff-type" -> ((com.fasterxml.jackson.databind.node.ObjectNode)root.path("diff").get(0)).put("type", "UNKNOWN");
            case "duplicate-criterion" -> criterion.put("code", "CC");
        }
        TestAttempt attempt = createAndSaveAttempt(ownerId, AttemptStatus.COMPLETED, createSnapshotWithWritingPart(writingPartId, "ESSAY", "q1"));
        AttemptAnswer answer = answerWithGrade(attempt, REGRESSION_ESSAY, objectMapper.convertValue(root, Map.class), fallback);
        String before = persistedRegressionState(attempt, answer);
        var task = getRegressionTask(attempt);
        assertThat(task.path("status").asText()).isEqualTo("FAILED");
        assertThat(task.path("reasonCode").asText()).isEqualTo("MALFORMED_FEEDBACK");
        assertThat(task.hasNonNull("overall")).isFalse();
        assertThat(task.hasNonNull("correctedEssay")).isFalse();
        assertThat(task.path("corrections").size()).isZero();
        assertThat(task.path("diff").size()).isZero();
        assertThat(persistedRegressionState(attempt, answer)).isEqualTo(before);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void longEssayZeroGrade_preservesAiCorrectionsAndDiff(boolean fallback) throws Exception {
        TestAttempt attempt = createAndSaveAttempt(ownerId, AttemptStatus.COMPLETED, createSnapshotWithWritingPart(writingPartId, "ESSAY", "q1"));
        Map<String, Object> grade = validRegressionGrade(true);
        AttemptAnswer answer = answerWithGrade(attempt, REGRESSION_ESSAY, grade, fallback);
        String before = persistedRegressionState(attempt, answer);
        var task = getRegressionTask(attempt);
        assertThat(task.path("status").asText()).isEqualTo("DONE");
        assertThat(task.path("source").asText()).isEqualTo("AI");
        assertThat(task.hasNonNull("reasonCode")).isFalse();
        assertThat(task.path("overall").decimalValue()).isEqualByComparingTo("0.0");
        assertThat(task.path("wordCount").asInt()).isEqualTo(12);
        assertThat(task.path("correctedEssay").asText()).isEqualTo("The" + REGRESSION_ESSAY.substring(3));
        assertThat(task.path("corrections")).isEqualTo(objectMapper.valueToTree(grade.get("corrections")));
        assertThat(task.path("diff")).isEqualTo(objectMapper.valueToTree(grade.get("diff")));
        assertThat(persistedRegressionState(attempt, answer)).isEqualTo(before);
    }

    @Test
    void tenWordLocalGrade_remainsSystemTooShort() throws Exception {
        String essay = "one two three four five six seven eight nine ten";
        TestAttempt attempt = createAndSaveAttempt(ownerId, AttemptStatus.COMPLETED, createSnapshotWithWritingPart(writingPartId, "ESSAY", "q1"));
        answerWithGrade(attempt, essay, objectMapper.convertValue(WritingGrade.tooShort(essay), Map.class), false);
        var task = getRegressionTask(attempt);
        assertThat(task.path("wordCount").asInt()).isEqualTo(10);
        assertThat(task.path("source").asText()).isEqualTo("SYSTEM");
        assertThat(task.path("reasonCode").asText()).isEqualTo("TOO_SHORT");
    }

    @ParameterizedTest
    @ValueSource(strings = {"missing", "null", "blank", "vi", "fr-CA"})
    void languageComesOnlyFromHistoricalSnapshot(String value) throws Exception {
        Map<String, Object> snapshot = createSnapshotWithWritingPart(writingPartId, "ESSAY", "q1");
        if (value.equals("missing")) snapshot.remove("examLanguage");
        else snapshot.put("examLanguage", value.equals("null") ? null : value.equals("blank") ? "  " : value);
        TestAttempt attempt = createAndSaveAttempt(ownerId, AttemptStatus.COMPLETED, snapshot);
        var task = getRegressionTask(attempt);
        if (Set.of("missing", "null", "blank").contains(value)) assertThat(task.hasNonNull("language")).isFalse();
        else assertThat(task.path("language").asText()).isEqualTo(value.toLowerCase(Locale.ROOT));
        assertThat(task.path("reasonCode").asText()).isEqualTo("LEGACY_NO_JOB");
        assertThat(jobRepository.findAllByAttemptIdAndPartId(attempt.getId(), writingPartId)).isEmpty();
    }
}
