package com.multilingo.backend.modules.testing.controller;

import com.fasterxml.jackson.databind.JsonNode;
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
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * TV3-22-02 Lifecycle Contract Integration Test.
 * Validates complete attempt lifecycle (Create -> Workspace -> Autosave Draft -> Resume -> Submit -> Result -> Review),
 * historical snapshot immutability, server deadline/grace periods, and secret leakage prevention.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@WithMockUser(username = "1", roles = "USER")
class Tv3LifecycleContractIT {

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

    private ExamPart findPartByExamAndNumber(Integer examId, int partNumber) {
        return examSectionRepository.findByExam_Id(examId).stream()
                .flatMap(s -> examPartRepository.findBySection_Id(s.getId()).stream())
                .filter(p -> p.getPartNumber() != null && p.getPartNumber() == partNumber)
                .findFirst()
                .orElseThrow(() -> new NoSuchElementException("Part " + partNumber + " not found in exam " + examId));
    }

    /**
     * Deep-copies exam part content data (nested maps/lists) so mutations in the
     * snapshot-immutability test cannot leak into other assertions or other tests
     * via a shared reference from the JPA-converted JSON payload.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> deepCopy(Map<String, Object> source) {
        Map<String, Object> copy = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : source.entrySet()) {
            Object value = entry.getValue();
            if (value instanceof Map<?, ?> mapValue) {
                copy.put(entry.getKey(), deepCopy((Map<String, Object>) mapValue));
            } else if (value instanceof List<?> listValue) {
                List<Object> listCopy = new ArrayList<>();
                for (Object item : listValue) {
                    if (item instanceof Map<?, ?> mapItem) {
                        listCopy.add(deepCopy((Map<String, Object>) mapItem));
                    } else {
                        listCopy.add(item);
                    }
                }
                copy.put(entry.getKey(), listCopy);
            } else {
                copy.put(entry.getKey(), value);
            }
        }
        return copy;
    }

    private void assertNoAnswerKeysOrExplanations(JsonNode node) {
        if (node == null) return;
        if (node.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                String key = field.getKey();
                if ("defaultExplanationLanguage".equals(key) || "supportedExplanationLanguages".equals(key)) {
                    assertThat(field.getValue().isTextual() || field.getValue().isArray() || field.getValue().isNull()).isTrue();
                    continue; // Public language metadata, not a question explanation.
                }
                assertThat(key)
                        .withFailMessage("Workspace response leaked sensitive property: %s", key)
                        .doesNotMatch("(?i).*(correct_answer|correctAnswer|explanation|grading_key|gradingKey|grading_keys|gradingKeys|answer_key|answerKey|accepted_answers|acceptedAnswers).*");
                assertNoAnswerKeysOrExplanations(field.getValue());
            }
        } else if (node.isArray()) {
            for (JsonNode element : node) {
                assertNoAnswerKeysOrExplanations(element);
            }
        }
    }

    private Exam seedDeterministicExam(String uniqueCode) {
        Exam exam = Exam.builder()
                .title("TV3 Lifecycle Comprehensive Exam")
                .code(uniqueCode)
                .type("TOEIC")
                .examLanguage("en")
                .isPublished(true)
                .isVipOnly(false)
                .durationMinutes(60)
                .build();
        exam = examRepository.save(exam);
        createdExamIds.add(exam.getId());

        // Non-consecutive Section ID 101: READING
        ExamSection readingSection = ExamSection.builder()
                .exam(exam)
                .skillType("READING")
                .title("Reading Section")
                .durationMinutes(30)
                .orderIndex(1)
                .build();
        readingSection = examSectionRepository.save(readingSection);

        // Non-consecutive Part ID: Reading Part 11
        Map<String, Object> rPartData = new LinkedHashMap<>();
        rPartData.put("title", "Reading Part 11");
        rPartData.put("passage", "Artificial intelligence in education offers personalized learning pathways.");

        Map<String, Object> group1 = new LinkedHashMap<>();
        group1.put("instruction", "Choose the correct option for questions 1-2");
        group1.put("options", List.of(
                Map.of("key", "A", "text", "Option A description"),
                Map.of("key", "B", "text", "Option B description"),
                Map.of("key", "C", "text", "Option C description")
        ));

        Map<String, Object> q1 = new LinkedHashMap<>();
        q1.put("question_id", "q_read_1");
        q1.put("type", "SINGLE_CHOICE");
        q1.put("text", "What does AI offer?");
        q1.put("correct_answer", "A");
        q1.put("explanation", "AI provides personalized learning pathways according to the text.");

        Map<String, Object> q2 = new LinkedHashMap<>();
        q2.put("question_id", "q_read_2");
        q2.put("type", "SINGLE_CHOICE");
        q2.put("text", "Is AI adaptive?");
        q2.put("correct_answer", "B");
        q2.put("explanation", "The second paragraph explains adaptive learning.");

        group1.put("questions", List.of(q1, q2));
        rPartData.put("question_groups", List.of(group1));

        ExamPart rPart = ExamPart.builder()
                .section(readingSection)
                .partNumber(11)
                .contentData(rPartData)
                .build();
        examPartRepository.save(rPart);

        // Non-consecutive Section ID 305: WRITING
        ExamSection writingSection = ExamSection.builder()
                .exam(exam)
                .skillType("WRITING")
                .title("Writing Section")
                .durationMinutes(30)
                .orderIndex(2)
                .build();
        writingSection = examSectionRepository.save(writingSection);

        // Non-consecutive Part ID: Writing Part 27
        Map<String, Object> wPartData = new LinkedHashMap<>();
        wPartData.put("title", "Writing Part 27");
        wPartData.put("instruction", "Write an opinion essay.");

        Map<String, Object> q3 = new LinkedHashMap<>();
        q3.put("question_id", "q_write_1");
        q3.put("type", "ESSAY");
        q3.put("text", "Discuss the impacts of AI on modern workplaces.");
        q3.put("sample_response", "AI improves automation while requiring new skills.");

        wPartData.put("questions", List.of(q3));

        ExamPart wPart = ExamPart.builder()
                .section(writingSection)
                .partNumber(27)
                .contentData(wPartData)
                .build();
        examPartRepository.save(wPart);

        return exam;
    }

    @Test
    @DisplayName("TC_TV3_22_01: Vòng đời attempt hoàn chỉnh (Create -> Workspace -> Autosave -> Resume -> Submit finalAnswers -> Result -> Review)")
    void testFullLifecycleFlow_start_autosave_submit_result_review() throws Exception {
        Exam exam = seedDeterministicExam("LIFECYCLE_E2E_01");
        ExamPart readingPart = findPartByExamAndNumber(exam.getId(), 11);

        // 1. POST /api/v1/attempts (Create attempt)
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);

        MvcResult createResult = mockMvc.perform(post("/api/v1/attempts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.attemptId").isNumber())
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.data.version").value(1))
                .andReturn();

        Integer attemptId = objectMapper.readTree(createResult.getResponse().getContentAsString())
                .get("data").get("attemptId").asInt();
        createdAttemptIds.add(attemptId);

        // 2. GET /api/v1/attempts/{id}/workspace (Verify security & recursive no answer keys leaked)
        MvcResult workspaceResult = mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/workspace"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.data.version").value(1))
                .andReturn();

        String workspaceJson = workspaceResult.getResponse().getContentAsString();
        JsonNode workspaceTree = objectMapper.readTree(workspaceJson);
        assertNoAnswerKeysOrExplanations(workspaceTree);

        // AC-02, AC-05: Absolute security - no leaked correct answers, explanations or prompt context
        assertThat(workspaceJson).doesNotContain("personalized learning pathways according to the text");
        assertThat(workspaceJson).doesNotContain("grading_key");

        // Verify legitimate option keys and labels remain intact
        assertThat(workspaceJson).contains("\"key\":\"A\"");
        assertThat(workspaceJson).contains("\"text\":\"Option A description\"");

        // 3. PUT /api/v1/attempts/{id}/answers (Autosave draft answers B)
        AutosaveAnswersRequest autosaveReq = new AutosaveAnswersRequest();
        autosaveReq.setVersion(1);
        AutosaveAnswersRequest.PartAnswerDto pAns = new AutosaveAnswersRequest.PartAnswerDto();
        pAns.setPartId(readingPart.getId());
        pAns.setAnswers(List.of(
                new AutosaveAnswersRequest.QuestionAnswerDto("q_read_1", "B"), // Draft answer B (wrong)
                new AutosaveAnswersRequest.QuestionAnswerDto("q_read_2", "C")  // Draft answer C (wrong)
        ));
        autosaveReq.setAnswers(List.of(pAns));

        mockMvc.perform(put("/api/v1/attempts/" + attemptId + "/answers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(autosaveReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value(2));

        // 4. GET /api/v1/attempts/{id}/workspace (Resume hydration verification)
        mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/workspace"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value(2))
                .andExpect(jsonPath("$.data.savedAnswers[0].part_id").value(readingPart.getId()))
                .andExpect(jsonPath("$.data.savedAnswers[0].answers[0].question_id").value("q_read_1"))
                .andExpect(jsonPath("$.data.savedAnswers[0].answers[0].answer").value("B"));

        // 5. POST /api/v1/attempts/{id}/submit (Submit with final answer override: q_read_1="A" correct, q_read_2="B" correct)
        AutosaveAnswersRequest.PartAnswerDto finalAns = new AutosaveAnswersRequest.PartAnswerDto();
        finalAns.setPartId(readingPart.getId());
        finalAns.setAnswers(List.of(
                new AutosaveAnswersRequest.QuestionAnswerDto("q_read_1", "A"),
                new AutosaveAnswersRequest.QuestionAnswerDto("q_read_2", "B")
        ));

        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .finalAnswers(List.of(finalAns))
                .build();

        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/submit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(submitReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));

        // 6. GET /api/v1/attempts/{id}/result (Verify grading results)
        mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/result"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.resultSummary.totalObjectiveCount").value(2))
                .andExpect(jsonPath("$.data.resultSummary.correctCount").value(2))
                .andExpect(jsonPath("$.data.resultSummary.objective.accuracy").value(100.0));

        // 7. GET /api/v1/attempts/{id}/review/{partId} (Verify full review now exposes correct answer & explanation)
        mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/review/" + readingPart.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.questions[0].questionId").value("q_read_1"))
                .andExpect(jsonPath("$.data.questions[0].userAnswer").value("A"))
                .andExpect(jsonPath("$.data.questions[0].correctAnswer").value("A"))
                .andExpect(jsonPath("$.data.questions[0].isCorrect").value(true))
                .andExpect(jsonPath("$.data.questions[0].explanation").isNotEmpty());
    }

    @Test
    @DisplayName("TC_TV3_22_06: Tính bất biến của Exam Snapshot khi sửa đổi hoặc Unpublish đề gốc")
    void testExamSnapshotImmutability_whenExamModifiedOrUnpublished() throws Exception {
        Exam exam = seedDeterministicExam("IMMUTABLE_SNAPSHOT_01");
        ExamPart readingPart = findPartByExamAndNumber(exam.getId(), 11);

        // 1. Create attempt -> freezes snapshot in TestAttempt.examSnapshot
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);

        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        // 2. Simulate Admin mutating the original exam in database (deep copy):
        // Mutate the nested question data (text, options, correct_answer, explanation),
        // NOT just the part title, so a live-content regression would actually change
        // grading keys and review payloads. Then verify the live content really changed
        // on disk before submitting.
        Map<String, Object> modifiedContent = deepCopy(readingPart.getContentData());
        Map<String, Object> mutatedGroup = (Map<String, Object>) ((List<?>) modifiedContent.get("question_groups")).get(0);
        List<Object> mutatedQuestions = new ArrayList<>((List<?>) mutatedGroup.get("questions"));
        Map<String, Object> mutatedQ1 = new LinkedHashMap<>((Map<String, Object>) mutatedQuestions.get(0));
        mutatedQ1.put("text", "MUTATED question text q_read_1");
        mutatedQ1.put("correct_answer", "Z");
        mutatedQ1.put("explanation", "MUTATED explanation q_read_1");
        mutatedQuestions.set(0, mutatedQ1);
        mutatedGroup.put("questions", mutatedQuestions);
        mutatedGroup.put("options", List.of(
                Map.of("key", "A", "text", "MUTATED Option A description"),
                Map.of("key", "B", "text", "MUTATED Option B description"),
                Map.of("key", "Z", "text", "MUTATED Option Z description")
        ));
        modifiedContent.put("title", "MODIFIED READING TITLE");
        readingPart.setContentData(modifiedContent);
        examPartRepository.save(readingPart);

        // Prove the live content was really mutated (guard against a test that
        // silently no-ops the mutation):
        ExamPart reloadedPart = findPartByExamAndNumber(exam.getId(), 11);
        assertThat(reloadedPart.getContentData().toString()).contains("MUTATED question text q_read_1");
        assertThat(reloadedPart.getContentData().toString()).contains("MUTATED explanation q_read_1");
        assertThat(reloadedPart.getContentData().toString()).contains("MUTATED Option Z description");

        exam.setIsPublished(false);
        exam.setTitle("UNPUBLISHED EXAM TITLE");
        examRepository.save(exam);

        // 3. Candidate submits attempt answering original correct answer "A"
        AutosaveAnswersRequest.PartAnswerDto finalReading = new AutosaveAnswersRequest.PartAnswerDto();
        finalReading.setPartId(readingPart.getId());
        finalReading.setAnswers(List.of(
                new AutosaveAnswersRequest.QuestionAnswerDto("q_read_1", "A"),
                new AutosaveAnswersRequest.QuestionAnswerDto("q_read_2", "B")
        ));

        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .finalAnswers(List.of(finalReading))
                .build();

        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/submit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(submitReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));

        // 4. Verify candidate's score is graded against snapshot ("A"), NOT mutated exam ("Z")
        mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/result"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.resultSummary.correctCount").value(2));

        // 4b. Result/review payloads must carry the snapshot explanation, not the mutated text.
        MvcResult resultResponse = mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/result"))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(resultResponse.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).doesNotContain("MUTATED");

        mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/review/" + readingPart.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.questions[0].isCorrect").value(true)) // Graded against snapshot "A"
                .andExpect(jsonPath("$.data.questions[0].correctAnswer").value("A"))
                .andExpect(jsonPath("$.data.questions[0].explanation").value("AI provides personalized learning pathways according to the text."));

        MvcResult reviewResponse = mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/review/" + readingPart.getId()))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(reviewResponse.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).doesNotContain("MUTATED");
    }

    @Test
    @DisplayName("TC_TV3_22_04: Ranh giới Deadline và Grace Period (+15s) được thực thi nghiêm ngặt")
    void testDeadlineGracePeriod_boundaryEnforcement() throws Exception {
        Exam exam = seedDeterministicExam("DEADLINE_GRACE_01");
        ExamPart readingPart = findPartByExamAndNumber(exam.getId(), 11);

        Map<String, Object> graceSnapshot = new LinkedHashMap<>();
        graceSnapshot.put("id", exam.getId());
        graceSnapshot.put("title", exam.getTitle());
        graceSnapshot.put("sections", List.of(
                Map.of(
                        "id", readingPart.getSection().getId(),
                        "skillType", "READING",
                        "parts", List.of(
                                Map.of(
                                        "id", readingPart.getId(),
                                        "part_number", 11,
                                        "questions", List.of(
                                                Map.of("id", "q_read_1", "type", "SINGLE_CHOICE", "correct_answer", "A")
                                        )
                                )
                        )
                )
        ));

        // Case A: Deadline expired beyond 15s grace period (e.g. 30s ago) with MANUAL submit -> 409 Conflict (ATTEMPT_EXPIRED)
        TestAttempt expiredManualAttempt = TestAttempt.builder()
                .userId(1)
                .examId(exam.getId())
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.MOCK_TEST)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(Instant.now().minusSeconds(3700))
                .deadline(Instant.now().minusSeconds(30)) // Beyond grace period
                .version(1)
                .examSnapshot(graceSnapshot)
                .build();
        expiredManualAttempt = testAttemptRepository.save(expiredManualAttempt);
        createdAttemptIds.add(expiredManualAttempt.getId());

        SubmitAttemptRequest manualSubmitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();

        mockMvc.perform(post("/api/v1/attempts/" + expiredManualAttempt.getId() + "/submit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(manualSubmitReq)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(409));

        // Case B: Deadline expired beyond 15s grace period with TIMEOUT_CLIENT -> Reason downgraded to TIMEOUT_SERVER, payload discarded
        TestAttempt lateTimeoutAttempt = TestAttempt.builder()
                .userId(1)
                .examId(exam.getId())
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.MOCK_TEST)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(Instant.now().minusSeconds(3700))
                .deadline(Instant.now().minusSeconds(30)) // Beyond 15s grace period
                .version(1)
                .examSnapshot(graceSnapshot)
                .build();
        lateTimeoutAttempt = testAttemptRepository.save(lateTimeoutAttempt);
        createdAttemptIds.add(lateTimeoutAttempt.getId());

        AutosaveAnswersRequest.PartAnswerDto latePartAnswer = new AutosaveAnswersRequest.PartAnswerDto();
        latePartAnswer.setPartId(readingPart.getId());
        latePartAnswer.setAnswers(List.of(new AutosaveAnswersRequest.QuestionAnswerDto("q_read_1", "B")));

        SubmitAttemptRequest lateTimeoutReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.TIMEOUT_CLIENT)
                .finalAnswers(List.of(latePartAnswer))
                .build();

        mockMvc.perform(post("/api/v1/attempts/" + lateTimeoutAttempt.getId() + "/submit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(lateTimeoutReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));

        // Payload discarded: attemptAnswerRepository should not contain discarded late answers
        assertThat(attemptAnswerRepository.findByAttemptId(lateTimeoutAttempt.getId())).isEmpty();

        // Case C: Deadline expired 5s ago (within 15s grace window) with TIMEOUT_CLIENT -> Accepted and payload retained
        TestAttempt inGraceAttempt = TestAttempt.builder()
                .userId(1)
                .examId(exam.getId())
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.MOCK_TEST)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(Instant.now().minusSeconds(3605))
                .deadline(Instant.now().minusSeconds(5)) // 5s past deadline, within 15s grace
                .version(1)
                .examSnapshot(graceSnapshot)
                .lockedSections(new ArrayList<>())
                .build();
        inGraceAttempt = testAttemptRepository.save(inGraceAttempt);
        createdAttemptIds.add(inGraceAttempt.getId());

        AutosaveAnswersRequest.PartAnswerDto gracePartAnswer = new AutosaveAnswersRequest.PartAnswerDto();
        gracePartAnswer.setPartId(readingPart.getId());
        gracePartAnswer.setAnswers(List.of(new AutosaveAnswersRequest.QuestionAnswerDto("q_read_1", "A")));

        SubmitAttemptRequest graceSubmitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.TIMEOUT_CLIENT)
                .finalAnswers(List.of(gracePartAnswer))
                .build();

        mockMvc.perform(post("/api/v1/attempts/" + inGraceAttempt.getId() + "/submit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(graceSubmitReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));

        // Verify payload was retained and saved because submit occurred within the 15s grace window
        List<AttemptAnswer> savedGraceAnswers = attemptAnswerRepository.findByAttemptId(inGraceAttempt.getId());
        assertThat(savedGraceAnswers).isNotEmpty();
        assertThat(savedGraceAnswers.get(0).getUserAnswers()).containsEntry("q_read_1", "A");

        // Case D: Valid active deadline in future -> Submit succeeds
        ExamSection readingSection = examSectionRepository.findByExam_Id(exam.getId()).stream()
                .filter(s -> "READING".equalsIgnoreCase(s.getSkillType()))
                .findFirst().orElseThrow();

        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.SINGLE_SKILL);
        createReq.setTargetSectionId(readingSection.getId());
        createReq.setTestMode(TestMode.MOCK_TEST);

        WorkspaceResponse activeWorkspace = testAttemptService.createAttempt(createReq);
        Integer activeAttemptId = activeWorkspace.getAttemptId();
        createdAttemptIds.add(activeAttemptId);

        mockMvc.perform(post("/api/v1/attempts/" + activeAttemptId + "/submit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(manualSubmitReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));
    }

    @Test
    @DisplayName("TC_TV3_22_09: Nộp bài có phần Writing lưu trữ bài luận và cập nhật trạng thái bài thi")
    void testWritingEssaySubmission_savedInAnswersAndResultReflected() throws Exception {
        Exam exam = seedDeterministicExam("WRITING_SUBMISSION_01");
        ExamPart writingPart = findPartByExamAndNumber(exam.getId(), 27);

        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);

        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        // Submit with essay answer
        String candidateEssay = "In my opinion, artificial intelligence will fundamentally reshape workplaces by automating routine tasks.";
        AutosaveAnswersRequest.PartAnswerDto writingAns = new AutosaveAnswersRequest.PartAnswerDto();
        writingAns.setPartId(writingPart.getId());
        writingAns.setAnswers(List.of(
                new AutosaveAnswersRequest.QuestionAnswerDto("q_write_1", candidateEssay)
        ));

        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .finalAnswers(List.of(writingAns))
                .build();

        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/submit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(submitReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("AI_GRADING_QUEUED"));

        // Verify saved answer in database contains candidate's essay
        List<AttemptAnswer> savedAnswers = attemptAnswerRepository.findByAttemptId(attemptId);
        Optional<AttemptAnswer> writingAnswerOpt = savedAnswers.stream()
                .filter(a -> a.getPartId().equals(writingPart.getId()))
                .findFirst();

        assertThat(writingAnswerOpt).isPresent();
        assertThat(writingAnswerOpt.get().getUserAnswers()).containsKey("q_write_1");
        assertThat(writingAnswerOpt.get().getUserAnswers().get("q_write_1")).isEqualTo(candidateEssay);
    }
}
