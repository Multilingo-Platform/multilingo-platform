package com.multilingo.backend.modules.testing.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.auth.entity.Role;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.repository.RoleRepository;
import com.multilingo.backend.modules.auth.repository.UserRepository;
import com.multilingo.backend.modules.analytics.entity.UserQuota;
import com.multilingo.backend.modules.analytics.repository.UserQuotaRepository;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.entity.ExamPart;
import com.multilingo.backend.modules.exam.entity.ExamSection;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamSectionRepository;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiClient;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiClientException;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiGenerationRequest;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiGenerationResult;
import com.multilingo.backend.modules.testing.config.WritingHintsProperties;
import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.dto.request.SubmitAttemptRequest;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.WritingHintRequest;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.SubmitReason;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.repository.WritingHintRequestRepository;
import com.multilingo.backend.modules.testing.service.TestAttemptService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.core.io.ClassPathResource;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.junit.jupiter.api.extension.ExtendWith;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.nio.charset.StandardCharsets;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@WithMockUser(username = "1", roles = "USER")
@ExtendWith(OutputCaptureExtension.class)
class WritingHintsContractIT {

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
    private UserQuotaRepository userQuotaRepository;

    @Autowired
    private WritingHintRequestRepository writingHintRequestRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private TestAttemptService testAttemptService;

    @Autowired
    private WritingHintsProperties writingHintsProperties;

    @SpyBean
    private IdentityAdapter identityAdapter;

    @MockBean
    private GeminiClient geminiClient;

    private final List<Integer> createdAttemptIds = new ArrayList<>();
    private final List<Integer> createdExamIds = new ArrayList<>();
    private User testUser;
    private UserQuota testQuota;

    @BeforeEach
    void setUp() {
        when(identityAdapter.getCurrentUserId()).thenReturn(1);
        writingHintsProperties.setEnabled(true);
        writingHintsProperties.setMinInterval(Duration.ZERO); // Disable cooldown for fast deterministic tests

        // Ensure user 1 exists
        testUser = userRepository.findById(1).orElseGet(() -> {
            Role role = roleRepository.findByName("ROLE_USER").orElseGet(() ->
                    roleRepository.save(Role.builder().name("ROLE_USER").build())
            );
            return userRepository.save(User.builder()
                    .email("learner@test.com")
                    .passwordHash("secret123")
                    .fullName("Learner Test")
                    .role(role)
                    .targetLanguage("en")
                    .build());
        });
        testUser.setTargetLanguage("en");
        userRepository.save(testUser);

        // Ensure UserQuota for AI_WRITING_HINTS exists with maxLimit = 10
        List<UserQuota> quotas = userQuotaRepository.findAllByUserIdAndFeatureCode(1, "AI_WRITING_HINTS");
        testQuota = quotas.isEmpty() ? userQuotaRepository.save(UserQuota.builder()
                .userId(1)
                .featureCode("AI_WRITING_HINTS")
                .maxLimit(10)
                .usedCount(0)
                .resetDate(Instant.now().plus(Duration.ofDays(1)))
                .build()) : quotas.getFirst();
        testQuota.setUsedCount(0);
        testQuota.setMaxLimit(10);
        testQuota.setResetDate(Instant.now().plus(Duration.ofDays(1)));
        testQuota = userQuotaRepository.save(testQuota);

        writingHintRequestRepository.deleteAll();
    }

    @AfterEach
    void tearDown() {
        for (Integer attemptId : createdAttemptIds) {
            try {
                attemptAnswerRepository.deleteAll(attemptAnswerRepository.findByAttemptId(attemptId));
                writingHintRequestRepository.deleteAll(writingHintRequestRepository.findByAttemptId(attemptId));
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

    private Exam seedWritingExam(String code) {
        Exam exam = Exam.builder()
                .code(code)
                .title("Writing Contract Exam " + code)
                .type("IELTS")
                .durationMinutes(60)
                .isPublished(true)
                .build();
        exam = examRepository.save(exam);
        createdExamIds.add(exam.getId());

        ExamSection writingSection = ExamSection.builder()
                .exam(exam)
                .skillType("WRITING")
                .title("Writing Academic Section")
                .durationMinutes(60)
                .orderIndex(1)
                .build();
        writingSection = examSectionRepository.save(writingSection);

        Map<String, Object> partData = new LinkedHashMap<>();
        partData.put("title", "Writing Task 1");
        partData.put("instruction", "You should spend about 20 minutes on this task.");

        Map<String, Object> group = new LinkedHashMap<>();
        group.put("instruction", "Write at least 150 words.");

        Map<String, Object> q1 = new LinkedHashMap<>();
        q1.put("question_id", "writing-task-1");
        q1.put("type", "ESSAY");
        q1.put("text", "The chart below shows renewable energy production from 2010 to 2020.");
        q1.put("prompt", "Summarize the information by selecting and reporting the main features.");
        q1.put("correct_answer", "PRIVATE_TASK_KEY_TV3_18_06");
        q1.put("explanation", "PRIVATE_TASK_EXPLANATION_TV3_18_06");
        q1.put("ai_prompt_context", "PRIVATE_TASK_PROMPT_TV3_18_06");

        group.put("questions", List.of(q1));
        partData.put("question_groups", List.of(group));

        ExamPart part = ExamPart.builder()
                .section(writingSection)
                .partNumber(1)
                .contentData(partData)
                .build();
        examPartRepository.save(part);

        return exam;
    }

    private String createValidGeminiJsonResponse(String hintLanguage) throws Exception {
        if (List.of("vi", "fr").contains(hintLanguage)) {
            try (var input = new ClassPathResource("fixtures/writing-hints-" + hintLanguage + ".json").getInputStream()) {
                return new String(input.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
            }
        }
        return """
                {
                  "hintLanguage": "%s",
                  "outline": [
                    {
                      "title": "Introduction & Overview",
                      "points": ["Paraphrase the prompt statement", "Highlight overall production growth across renewable sources"]
                    },
                    {
                      "title": "Body Paragraph 1",
                      "points": ["Detail wind energy trends from 2010 to 2015", "Compare solar energy output surges"]
                    },
                    {
                      "title": "Body Paragraph 2",
                      "points": ["Examine hydroelectric stability", "Contrast initial figures with final 2020 metrics"]
                    }
                  ],
                  "vocabulary": [
                    {
                      "term": "exponential",
                      "definition": "growing at an increasingly rapid rate",
                      "explanation": "use for dramatic surges in clean energy",
                      "example": "Solar power experienced exponential growth."
                    },
                    {
                      "term": "predominance",
                      "definition": "the state of being greater in number or influence",
                      "explanation": "use when identifying the leading source",
                      "example": "Hydro power maintained its predominance initially."
                    },
                    {
                      "term": "stagnate",
                      "definition": "to stay at the same level without developing",
                      "explanation": "use for plateaus in generation",
                      "example": "Wind energy output stagnated between 2012 and 2014."
                    },
                    {
                      "term": "fluctuation",
                      "definition": "an irregular rising and falling in number",
                      "explanation": "use for unstable intervals",
                      "example": "Mild fluctuations were observed annually."
                    },
                    {
                      "term": "counterpart",
                      "definition": "a person or thing holding a corresponding position",
                      "explanation": "use when comparing renewable types",
                      "example": "Solar outperformed its conventional counterparts."
                    }
                  ],
                  "limitations": [
                    "Hints are generated from textual prompt metadata; visual graph details require user review."
                  ]
                }
                """.formatted(hintLanguage);
    }

    @Test
    @DisplayName("TC_18_08: Tạo attempt rồi sửa TV2 live exam; hints vẫn lấy task trong snapshot bất biến")
    void historicalSnapshotTaskIsPreservedEvenWhenLiveExamIsModified() throws Exception {
        Exam exam = seedWritingExam("EXAM-IMMUTABLE-01");

        // 1. Candidate starts Practice attempt
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);

        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        ExamSection section = examSectionRepository.findByExam_Id(exam.getId()).getFirst();
        ExamPart part = examPartRepository.findBySection_Id(section.getId()).getFirst();
        Integer partId = part.getId();

        // 2. Teacher/Author updates the live ExamPart with altered text
        Map<String, Object> modifiedContent = new LinkedHashMap<>(part.getContentData());
        modifiedContent.put("title", "MODIFIED TITLE THAT MUST NEVER APPEAR IN HINTS");
        part.setContentData(modifiedContent);
        examPartRepository.saveAndFlush(part);

        // 3. Stub GeminiClient and capture request
        ArgumentCaptor<GeminiGenerationRequest> captor = ArgumentCaptor.forClass(GeminiGenerationRequest.class);
        when(geminiClient.generate(captor.capture())).thenReturn(
                new GeminiGenerationResult(createValidGeminiJsonResponse("en"), new GeminiGenerationResult.Usage(100, 150, 250))
        );

        // 4. Candidate requests hints
        String jsonPayload = """
                {
                  "partId": %d,
                  "questionId": "writing-task-1",
                  "requestId": "a0000000-0000-0000-0000-000000000001",
                  "learningLanguage": "en",
                  "hintLanguage": "en"
                }
                """.formatted(partId);

        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonPayload))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.vocabulary.length()").value(5));

        // 5. Verify the prompt sent to Gemini read ONLY the immutable snapshot text!
        GeminiGenerationRequest sentReq = captor.getValue();
        assertThat(sentReq.userText()).contains("The chart below shows renewable energy production from 2010 to 2020.");
        assertThat(sentReq.userText()).doesNotContain("MODIFIED TITLE THAT MUST NEVER APPEAR IN HINTS");
    }

    @Test
    @DisplayName("TC_18_05 & TC_18_06: Test en/vi/fr và override chéo; mọi generated fields theo hintLanguage")
    void multilingualPrecedenceAndCrossLanguageOverrides() throws Exception {
        Exam exam = seedWritingExam("EXAM-LANG-01");

        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);

        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        ExamSection section = examSectionRepository.findByExam_Id(exam.getId()).getFirst();
        ExamPart part = examPartRepository.findBySection_Id(section.getId()).getFirst();
        Integer partId = part.getId();

        // 1. Request with hintLanguage = "vi" (Vietnamese)
        ArgumentCaptor<GeminiGenerationRequest> captorVi = ArgumentCaptor.forClass(GeminiGenerationRequest.class);
        when(geminiClient.generate(captorVi.capture())).thenReturn(
                new GeminiGenerationResult(createValidGeminiJsonResponse("vi"), new GeminiGenerationResult.Usage(100, 150, 250))
        );

        String payloadVi = """
                {
                  "partId": %d,
                  "questionId": "writing-task-1",
                  "requestId": "a0000000-0000-0000-0000-000000000002",
                  "learningLanguage": "en",
                  "hintLanguage": "vi"
                }
                """.formatted(partId);

        var responseVi = mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payloadVi))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hintLanguage").value("vi"))
                .andExpect(jsonPath("$.data.learningLanguage").value("en"))
                .andExpect(jsonPath("$.data.vocabulary.length()").value(5))
                .andReturn();

        assertLocalizedContent(responseVi.getResponse().getContentAsString(StandardCharsets.UTF_8), "vi");

        assertPromptLanguageAndOriginalTask(captorVi.getValue(), "en", "vi");

        // 2. Request with hintLanguage = "fr" (French)
        ArgumentCaptor<GeminiGenerationRequest> captorFr = ArgumentCaptor.forClass(GeminiGenerationRequest.class);
        when(geminiClient.generate(captorFr.capture())).thenReturn(
                new GeminiGenerationResult(createValidGeminiJsonResponse("fr"), new GeminiGenerationResult.Usage(100, 150, 250))
        );

        String payloadFr = """
                {
                  "partId": %d,
                  "questionId": "writing-task-1",
                  "requestId": "a0000000-0000-0000-0000-000000000003",
                  "learningLanguage": "en",
                  "hintLanguage": "fr"
                }
                """.formatted(partId);

        var responseFr = mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payloadFr))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hintLanguage").value("fr"))
                .andExpect(jsonPath("$.data.vocabulary.length()").value(5))
                .andReturn();

        assertLocalizedContent(responseFr.getResponse().getContentAsString(StandardCharsets.UTF_8), "fr");

        assertPromptLanguageAndOriginalTask(captorFr.getValue(), "en", "fr");
    }

    private void assertPromptLanguageAndOriginalTask(GeminiGenerationRequest prompt, String learning, String hint) throws Exception {
        JsonNode data = objectMapper.readTree(prompt.userText());
        assertThat(data.get("learningLanguage").asText()).isEqualTo(learning);
        assertThat(data.get("hintLanguage").asText()).isEqualTo(hint);
        assertThat(data.get("task").get("taskPrompt").asText())
                .isEqualTo("The chart below shows renewable energy production from 2010 to 2020.");
        assertThat(data.get("task").get("partInstruction").asText())
                .isEqualTo("You should spend about 20 minutes on this task.");
        assertThat(data.get("task").get("groupInstruction").asText()).isEqualTo("Write at least 150 words.");
        assertThat(prompt.systemInstruction()).contains("ALL generated fields", "specified \"hintLanguage\"",
                "Do NOT translate or rewrite the original task prompt");
        for (String field : List.of("title", "points", "term", "definition", "explanation", "example", "limitations")) {
            assertThat(prompt.systemInstruction()).contains("\"" + field + "\"");
        }
    }

    private void assertLocalizedContent(String response, String language) throws Exception {
        JsonNode actual = objectMapper.readTree(response).get("data");
        try (var input = new ClassPathResource("fixtures/writing-hints-" + language + ".json").getInputStream()) {
            JsonNode expected = objectMapper.readTree(input);
            // Compare every generated title/point/term/definition/explanation/example/limitation.
            for (String field : List.of("outline", "vocabulary", "limitations")) {
                assertThat(actual.get(field)).as("%s content in %s", field, language).isEqualTo(expected.get(field));
            }
        }
    }

    private record ContractFixture(Integer attemptId, Integer partId, Integer sectionId, WorkspaceResponse workspace) {}

    private ContractFixture createPracticeFixture(String code) {
        Exam exam = seedWritingExam(code);
        CreateAttemptRequest request = new CreateAttemptRequest();
        request.setExamId(exam.getId());
        request.setTestScope(TestScope.FULL_EXAM);
        request.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse workspace = testAttemptService.createAttempt(request);
        createdAttemptIds.add(workspace.getAttemptId());
        ExamSection section = examSectionRepository.findByExam_Id(exam.getId()).getFirst();
        ExamPart part = examPartRepository.findBySection_Id(section.getId()).getFirst();
        return new ContractFixture(workspace.getAttemptId(), part.getId(), section.getId(), workspace);
    }

    private String payload(ContractFixture fixture, Map<String, String> languages) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>(languages);
        body.put("partId", fixture.partId());
        body.put("questionId", "writing-task-1");
        body.put("requestId", UUID.randomUUID().toString());
        return objectMapper.writeValueAsString(body);
    }

    private void assertNoReservationOrProviderCall() {
        assertThat(userQuotaRepository.findById(testQuota.getId()).orElseThrow().getUsedCount()).isZero();
        assertThat(writingHintRequestRepository.findAll()).isEmpty();
        verifyNoInteractions(geminiClient);
    }

    @Test
    void persistedTargetLanguageFallbackAndExplicitLearningOverride() throws Exception {
        var fixture = createPracticeFixture("EXAM-LANG-FALLBACK");
        testUser.setTargetLanguage("fr");
        userRepository.saveAndFlush(testUser);
        List<GeminiGenerationRequest> prompts = new ArrayList<>();
        when(geminiClient.generate(any())).thenAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            GeminiGenerationRequest prompt = invocation.getArgument(0);
            prompts.add(prompt);
            String hint = objectMapper.readTree(prompt.userText()).get("hintLanguage").asText();
            return new GeminiGenerationResult(createValidGeminiJsonResponse(hint), new GeminiGenerationResult.Usage(1, 2, 3));
        });
        var fallback = mockMvc.perform(post("/api/v1/attempts/" + fixture.attemptId() + "/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON).content(payload(fixture, Map.of())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.learningLanguage").value("fr"))
                .andExpect(jsonPath("$.data.hintLanguage").value("fr")).andReturn();
        assertLocalizedContent(fallback.getResponse().getContentAsString(StandardCharsets.UTF_8), "fr");
        assertPromptLanguageAndOriginalTask(prompts.getFirst(), "fr", "fr");

        var override = mockMvc.perform(post("/api/v1/attempts/" + fixture.attemptId() + "/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON).content(payload(fixture, Map.of("learningLanguage", "vie"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.learningLanguage").value("vi"))
                .andExpect(jsonPath("$.data.hintLanguage").value("vi")).andReturn();
        assertLocalizedContent(override.getResponse().getContentAsString(StandardCharsets.UTF_8), "vi");
        assertPromptLanguageAndOriginalTask(prompts.getLast(), "vi", "vi");
        assertThat(userQuotaRepository.findById(testQuota.getId()).orElseThrow().getUsedCount()).isEqualTo(2);
    }

    @ParameterizedTest
    @ValueSource(strings = {"missing-target", "invalid-target", "invalid-learning", "invalid-hint"})
    void missingOrInvalidLanguageFailsWithoutEnglishFallback(String scenario) throws Exception {
        var fixture = createPracticeFixture("EXAM-LANG-" + scenario);
        Map<String, String> languages = switch (scenario) {
            case "invalid-learning" -> Map.of("learningLanguage", "xx");
            case "invalid-hint" -> Map.of("hintLanguage", "xx");
            default -> Map.of();
        };
        if (scenario.equals("missing-target") || scenario.equals("invalid-target")) {
            testUser.setTargetLanguage(scenario.equals("missing-target") ? "" : "xx");
            userRepository.saveAndFlush(testUser);
        }
        mockMvc.perform(post("/api/v1/attempts/" + fixture.attemptId() + "/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON).content(payload(fixture, languages)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"));
        assertNoReservationOrProviderCall();
    }

    @ParameterizedTest
    @ValueSource(strings = {"foreign", "mock", "expired", "locked"})
    void actualHttpGuardsRejectBeforeProviderAndReservation(String scenario) throws Exception {
        var fixture = createPracticeFixture("EXAM-GUARD-" + scenario);
        TestAttempt attempt = testAttemptRepository.findById(fixture.attemptId()).orElseThrow();
        switch (scenario) {
            case "foreign" -> when(identityAdapter.getCurrentUserId()).thenReturn(999);
            case "mock" -> attempt.setTestMode(TestMode.MOCK_TEST);
            case "expired" -> attempt.setDeadline(Instant.now().minusSeconds(3600));
            case "locked" -> attempt.setLockedSections(List.of(fixture.sectionId()));
            default -> throw new AssertionError(scenario);
        }
        testAttemptRepository.saveAndFlush(attempt);
        mockMvc.perform(post("/api/v1/attempts/" + fixture.attemptId() + "/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON).content(payload(fixture, Map.of())))
                .andExpect(status().is(scenario.equals("foreign") || scenario.equals("mock") ? 403 : 409))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"));
        assertNoReservationOrProviderCall();
    }

    @Test
    void invalidParserOutputRefundsAndExplicitRetrySucceedsWithoutSentinelLogs(CapturedOutput logs) throws Exception {
        var fixture = createPracticeFixture("EXAM-PARSER-FAILURE");
        String body = payload(fixture, Map.of("hintLanguage", "fr"));
        String key = objectMapper.readTree(body).get("requestId").asText();
        String outputSentinel = "PRIVATE_PROVIDER_OUTPUT_TV3_18_06";
        when(geminiClient.generate(any())).thenAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            return new GeminiGenerationResult("{\"private\":\"" + outputSentinel + "\"}", new GeminiGenerationResult.Usage(1, 2, 3));
        });
        String failure = mockMvc.perform(post("/api/v1/attempts/" + fixture.attemptId() + "/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadGateway()).andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(failure).doesNotContain(outputSentinel);
        assertThat(logs.getAll()).doesNotContain(outputSentinel);
        assertThat(userQuotaRepository.findById(testQuota.getId()).orElseThrow().getUsedCount()).isZero();
        WritingHintRequest failed = writingHintRequestRepository.findByUserIdAndRequestId(1, key).orElseThrow();
        assertThat(failed.getStatus()).isEqualTo(WritingHintRequest.Status.FAILED);
        assertThat(failed.getQuotaReserved()).isFalse();
        String oldRun = failed.getRunId();
        doAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            return new GeminiGenerationResult(createValidGeminiJsonResponse("fr"), new GeminiGenerationResult.Usage(1, 2, 3));
        }).when(geminiClient).generate(any());
        var retry = mockMvc.perform(post("/api/v1/attempts/" + fixture.attemptId() + "/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn();
        assertLocalizedContent(retry.getResponse().getContentAsString(StandardCharsets.UTF_8), "fr");
        WritingHintRequest succeeded = writingHintRequestRepository.findByUserIdAndRequestId(1, key).orElseThrow();
        assertThat(succeeded.getStatus()).isEqualTo(WritingHintRequest.Status.SUCCEEDED);
        assertThat(succeeded.getRunId()).isNotEqualTo(oldRun);
        assertThat(userQuotaRepository.findById(testQuota.getId()).orElseThrow().getUsedCount()).isEqualTo(1);
        assertThat(logs.getAll()).doesNotContain(outputSentinel);
    }

    @Test
    void successfulHintsPreserveAttemptAndAnswersAndKeepPrivateDataOutOfPromptWorkspaceAndLogs(CapturedOutput logs) throws Exception {
        var fixture = createPracticeFixture("EXAM-HINTS-INTEGRITY");
        String key = "PRIVATE_TASK_KEY_TV3_18_06";
        String explanation = "PRIVATE_TASK_EXPLANATION_TV3_18_06";
        String privatePrompt = "PRIVATE_TASK_PROMPT_TV3_18_06";
        TestAttempt attempt = testAttemptRepository.findById(fixture.attemptId()).orElseThrow();
        String snapshot = objectMapper.writeValueAsString(attempt.getExamSnapshot());
        assertThat(snapshot).contains(key, explanation); // Non-vacuous: secrets exist in persisted input.
        assertThat(snapshot).doesNotContain(privatePrompt); // Storage adapter strips private AI metadata.
        assertThat(objectMapper.writeValueAsString(fixture.workspace())).doesNotContain(key, explanation, privatePrompt);
        AttemptAnswer answer = attemptAnswerRepository.saveAndFlush(AttemptAnswer.builder().attempt(attempt)
                .partId(fixture.partId()).userAnswers(Map.of("writing-task-1", "Learner draft stays unchanged."))
                .build());
        answer = attemptAnswerRepository.findById(answer.getId()).orElseThrow();
        JsonNode beforeAttempt = objectMapper.valueToTree(attempt);
        Map<String, Object> beforeAnswers = new LinkedHashMap<>(answer.getUserAnswers());
        when(geminiClient.generate(any())).thenAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            GeminiGenerationRequest prompt = invocation.getArgument(0);
            assertThat(prompt.userText()).doesNotContain(key, explanation, privatePrompt, "Learner draft stays unchanged.");
            assertThat(prompt.systemInstruction()).doesNotContain(key, explanation, privatePrompt);
            return new GeminiGenerationResult(createValidGeminiJsonResponse("fr"), new GeminiGenerationResult.Usage(1, 2, 3));
        });
        var response = mockMvc.perform(post("/api/v1/attempts/" + fixture.attemptId() + "/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON).content(payload(fixture, Map.of("hintLanguage", "fr"))))
                .andExpect(status().isOk()).andReturn();
        assertThat(response.getResponse().getContentAsString(StandardCharsets.UTF_8)).doesNotContain(key, explanation, privatePrompt);
        assertThat(objectMapper.<JsonNode>valueToTree(testAttemptRepository.findById(fixture.attemptId()).orElseThrow()))
                .isEqualTo(beforeAttempt);
        AttemptAnswer afterAnswer = attemptAnswerRepository.findById(answer.getId()).orElseThrow();
        assertThat(afterAnswer.getUserAnswers()).isEqualTo(beforeAnswers);
        assertThat(afterAnswer.getUpdatedAt()).isEqualTo(answer.getUpdatedAt());
        assertThat(afterAnswer.getAiFeedback()).isNull();
        String workspace = objectMapper.writeValueAsString(testAttemptService.getAttemptWorkspace(fixture.attemptId()));
        assertThat(workspace).doesNotContain(key, explanation, privatePrompt, "outline", "vocabulary", "hintLanguage");
        assertThat(logs.getAll()).doesNotContain(key, explanation, privatePrompt);
    }

    @Test
    @DisplayName("TC_18_07 & TC_18_13 & TC_18_11: Replay thành công, Provider failure hoàn quota và retry sau đó")
    void replaySuccessAndFailureRecoveryExplicitRetry() throws Exception {
        Exam exam = seedWritingExam("EXAM-REPLAY-RETRY-01");

        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);

        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        ExamSection section = examSectionRepository.findByExam_Id(exam.getId()).getFirst();
        ExamPart part = examPartRepository.findBySection_Id(section.getId()).getFirst();
        Integer partId = part.getId();

        String reqIdReplay = "b0000000-0000-0000-0000-000000000001";
        String validResponseJson = createValidGeminiJsonResponse("en");
        when(geminiClient.generate(any())).thenReturn(
                new GeminiGenerationResult(validResponseJson, new GeminiGenerationResult.Usage(100, 150, 250))
        );

        String payloadReplay = """
                {
                  "partId": %d,
                  "questionId": "writing-task-1",
                  "requestId": "%s"
                }
                """.formatted(partId, reqIdReplay);

        // 1. Initial success: charges quota by 1
        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payloadReplay))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.requestId").value(reqIdReplay));

        UserQuota q1 = userQuotaRepository.findById(testQuota.getId()).orElseThrow();
        assertThat(q1.getUsedCount()).isEqualTo(1);
        verify(geminiClient, times(1)).generate(any());

        // 2. Replay with exact same requestId: returns cached result without calling Gemini or charging quota again!
        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payloadReplay))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.requestId").value(reqIdReplay));

        UserQuota q2 = userQuotaRepository.findById(testQuota.getId()).orElseThrow();
        assertThat(q2.getUsedCount()).isEqualTo(1);
        verify(geminiClient, times(1)).generate(any()); // Still 1!

        // 3. Second call with different requestId that fails on Gemini provider
        String reqIdFailed = "b0000000-0000-0000-0000-000000000002";
        when(geminiClient.generate(any())).thenThrow(
                new GeminiClientException(GeminiClientException.Kind.TIMEOUT, "Gateway Timeout Upstream")
        );

        String payloadFailed = """
                {
                  "partId": %d,
                  "questionId": "writing-task-1",
                  "requestId": "%s"
                }
                """.formatted(partId, reqIdFailed);

        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payloadFailed))
                .andExpect(status().isGatewayTimeout())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"));

        // Quota must be refunded!
        UserQuota q3 = userQuotaRepository.findById(testQuota.getId()).orElseThrow();
        assertThat(q3.getUsedCount()).isEqualTo(1);

        WritingHintRequest ledgerFail = writingHintRequestRepository
                .findByUserIdAndRequestId(1, reqIdFailed).orElseThrow();
        assertThat(ledgerFail.getStatus()).isEqualTo(WritingHintRequest.Status.FAILED);
        assertThat(ledgerFail.getQuotaReserved()).isFalse();

        // 4. Explicit retry with the failed requestId: now Gemini succeeds
        doReturn(new GeminiGenerationResult(validResponseJson, new GeminiGenerationResult.Usage(100, 150, 250)))
                .when(geminiClient).generate(any());

        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payloadFailed))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.requestId").value(reqIdFailed));

        UserQuota q4 = userQuotaRepository.findById(testQuota.getId()).orElseThrow();
        assertThat(q4.getUsedCount()).isEqualTo(2);

        WritingHintRequest ledgerSuccess = writingHintRequestRepository
                .findByUserIdAndRequestId(1, reqIdFailed).orElseThrow();
        assertThat(ledgerSuccess.getStatus()).isEqualTo(WritingHintRequest.Status.SUCCEEDED);
        assertThat(ledgerSuccess.getQuotaReserved()).isFalse();
        assertThat(ledgerSuccess.getResultJson()).isNotNull();
    }

    @Test
    @DisplayName("TC_18_16 & AC-09: Submit bài thi giữa chừng provider call -> hoàn quota và không thay đổi attempt")
    void submitAttemptDuringProviderCallRefundsAndDoesNotMutateAttempt() throws Exception {
        Exam exam = seedWritingExam("EXAM-RACE-SUBMIT-01");

        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);

        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        ExamSection section = examSectionRepository.findByExam_Id(exam.getId()).getFirst();
        ExamPart part = examPartRepository.findBySection_Id(section.getId()).getFirst();
        Integer partId = part.getId();

        String validResponseJson = createValidGeminiJsonResponse("en");
        String reqId = "c0000000-0000-0000-0000-000000000001";
        var submittedState = new java.util.concurrent.atomic.AtomicReference<JsonNode>();

        // When Gemini is called, candidate submits the attempt in the middle of generation!
        when(geminiClient.generate(any())).thenAnswer(inv -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            SubmitAttemptRequest submitReq = new SubmitAttemptRequest();
            submitReq.setReason(SubmitReason.MANUAL);
            testAttemptService.submitAttempt(attemptId, submitReq);
            submittedState.set(objectMapper.valueToTree(testAttemptRepository.findById(attemptId).orElseThrow()));
            return new GeminiGenerationResult(validResponseJson, new GeminiGenerationResult.Usage(100, 150, 250));
        });

        String payload = """
                {
                  "partId": %d,
                  "questionId": "writing-task-1",
                  "requestId": "%s"
                }
                """.formatted(partId, reqId);

        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isConflict())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.code").value(409));

        // 1. Quota reservation must be refunded!
        UserQuota quota = userQuotaRepository.findById(testQuota.getId()).orElseThrow();
        assertThat(quota.getUsedCount()).isEqualTo(0);

        // 2. Ledger must record FAILED status
        WritingHintRequest ledger = writingHintRequestRepository
                .findByUserIdAndRequestId(1, reqId).orElseThrow();
        assertThat(ledger.getStatus()).isEqualTo(WritingHintRequest.Status.FAILED);
        assertThat(ledger.getQuotaReserved()).isFalse();

        // 3. Attempt must be in SUBMITTED/AI_GRADING state without answers/score mutation from hints
        TestAttempt attempt = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(attempt.getStatus()).isIn(AttemptStatus.COMPLETED, AttemptStatus.SUBMITTED, AttemptStatus.AI_GRADING);
        assertThat(attempt.getResultSummary()).isNotNull();
        assertThat(objectMapper.<JsonNode>valueToTree(attempt)).isEqualTo(submittedState.get());
    }
}
