package com.multilingo.backend.modules.testing.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@ExtendWith(OutputCaptureExtension.class)
@WithMockUser(username = "1", roles = "USER")
class PracticeFeedbackControllerIT {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TestAttemptRepository testAttemptRepository;

    @SpyBean
    private IdentityAdapter identityAdapter;

    private final List<Integer> createdAttemptIds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        when(identityAdapter.getCurrentUserId()).thenReturn(1);
    }

    @AfterEach
    void tearDown() {
        for (Integer attemptId : createdAttemptIds) {
            testAttemptRepository.deleteById(attemptId);
        }
        createdAttemptIds.clear();
    }

    private Map<String, Object> createStandardSnapshot(Integer partId) {
        Map<String, Object> q1 = new LinkedHashMap<>();
        q1.put("question_id", "q_1");
        q1.put("type", "SINGLE_CHOICE");
        q1.put("correct_answer", "A");
        q1.put("explanation", "Giải thích câu q_1");

        Map<String, Object> qEssay = new LinkedHashMap<>();
        qEssay.put("question_id", "q_essay");
        qEssay.put("type", "ESSAY");

        Map<String, Object> part = new LinkedHashMap<>();
        part.put("id", partId);
        part.put("title", "Part " + partId);
        part.put("questions", List.of(q1, qEssay));

        Map<String, Object> section = new LinkedHashMap<>();
        section.put("name", "READING");
        section.put("parts", List.of(part));

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("sections", List.of(section));
        return snapshot;
    }

    private TestAttempt createAttempt(Integer userId, TestMode mode, AttemptStatus status) {
        TestAttempt attempt = TestAttempt.builder()
                .userId(userId)
                .examId(1)
                .testMode(mode)
                .status(status)
                .startTime(Instant.now())
                .examSnapshot(createStandardSnapshot(10))
                .version(1)
                .build();
        attempt = testAttemptRepository.save(attempt);
        createdAttemptIds.add(attempt.getId());
        return attempt;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Security & Access Control
    // ─────────────────────────────────────────────────────────────────────────────

    @Test
    @WithAnonymousUser
    @DisplayName("Unauthenticated request returns HTTP 401")
    void feedback_unauthenticated_returns401() throws Exception {
        mockMvc.perform(post("/api/v1/attempts/1/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"partId\": 10, \"questionId\": \"q_1\", \"answer\": \"A\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Attempt owned by different user returns HTTP 403")
    void feedback_wrongOwner_returns403() throws Exception {
        TestAttempt attempt = createAttempt(999, TestMode.PRACTICE, AttemptStatus.IN_PROGRESS);

        mockMvc.perform(post("/api/v1/attempts/" + attempt.getId() + "/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"partId\": 10, \"questionId\": \"q_1\", \"answer\": \"A\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    @DisplayName("Non-existent attempt ID returns HTTP 403")
    void feedback_notFoundAttempt_returns403() throws Exception {
        mockMvc.perform(post("/api/v1/attempts/999999/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"partId\": 10, \"questionId\": \"q_1\", \"answer\": \"A\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    @DisplayName("MOCK_TEST attempt (live or finalized) returns HTTP 403")
    void feedback_mockTest_returns403() throws Exception {
        TestAttempt mockAttempt = createAttempt(1, TestMode.MOCK_TEST, AttemptStatus.IN_PROGRESS);
        String validBody = "{\"partId\": 10, \"questionId\": \"q_1\", \"answer\": \"A\"}";

        mockMvc.perform(post("/api/v1/attempts/" + mockAttempt.getId() + "/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content(validBody))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    @DisplayName("PRACTICE attempt already completed returns HTTP 409")
    void feedback_practiceFinalized_returns409() throws Exception {
        TestAttempt completedAttempt = createAttempt(1, TestMode.PRACTICE, AttemptStatus.COMPLETED);

        mockMvc.perform(post("/api/v1/attempts/" + completedAttempt.getId() + "/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"partId\": 10, \"questionId\": \"q_1\", \"answer\": \"A\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(409))
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Success flow & Allowlist verification
    // ─────────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Valid practice feedback returns HTTP 200, no-store, and allowlisted fields only")
    void feedback_validPracticeInProgress_returns200AndAllowlistedFields() throws Exception {
        TestAttempt practiceAttempt = createAttempt(1, TestMode.PRACTICE, AttemptStatus.IN_PROGRESS);
        String validBody = "{\"partId\": 10, \"questionId\": \"q_1\", \"answer\": \"A\"}";

        mockMvc.perform(post("/api/v1/attempts/" + practiceAttempt.getId() + "/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content(validBody))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.attemptId").value(practiceAttempt.getId()))
                .andExpect(jsonPath("$.data.partId").value(10))
                .andExpect(jsonPath("$.data.questionId").value("q_1"))
                .andExpect(jsonPath("$.data.type").value("SINGLE_CHOICE"))
                .andExpect(jsonPath("$.data.userAnswer").value("A"))
                .andExpect(jsonPath("$.data.verdict").value("CORRECT"))
                .andExpect(jsonPath("$.data.score").value(1))
                .andExpect(jsonPath("$.data.correctAnswer").value("A"))
                .andExpect(jsonPath("$.data.explanation").value("Giải thích câu q_1"))
                // Allowlist assertions: non-whitelisted fields must NOT exist
                .andExpect(jsonPath("$.data.version").doesNotExist())
                .andExpect(jsonPath("$.data.resultSummary").doesNotExist())
                .andExpect(jsonPath("$.data.examData").doesNotExist())
                .andExpect(jsonPath("$.data.questions").doesNotExist())
                .andExpect(jsonPath("$.data.gradingKeys").doesNotExist())
                .andExpect(jsonPath("$.data.alternates").doesNotExist())
                .andExpect(jsonPath("$.data.options").doesNotExist());
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Path ID & Error table validation
    // ─────────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Invalid path ID (leading zero, non-numeric, overflow) returns HTTP 400")
    void feedback_invalidPathId_returns400() throws Exception {
        String validBody = "{\"partId\": 10, \"questionId\": \"q_1\", \"answer\": \"A\"}";

        // 0 is invalid
        mockMvc.perform(post("/api/v1/attempts/0/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content(validBody))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("Cache-Control", "no-store"));

        // Leading zero
        mockMvc.perform(post("/api/v1/attempts/012/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content(validBody))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("Cache-Control", "no-store"));

        // Non-numeric
        mockMvc.perform(post("/api/v1/attempts/12abc/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content(validBody))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("Cache-Control", "no-store"));

        // Overflow
        mockMvc.perform(post("/api/v1/attempts/999999999999/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content(validBody))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    @DisplayName("Unknown Part ID returns HTTP 404")
    void feedback_partNotFound_returns404() throws Exception {
        TestAttempt practiceAttempt = createAttempt(1, TestMode.PRACTICE, AttemptStatus.IN_PROGRESS);

        mockMvc.perform(post("/api/v1/attempts/" + practiceAttempt.getId() + "/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"partId\": 999, \"questionId\": \"q_1\", \"answer\": \"A\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404))
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    @DisplayName("Unknown Question ID returns HTTP 404")
    void feedback_questionNotFound_returns404() throws Exception {
        TestAttempt practiceAttempt = createAttempt(1, TestMode.PRACTICE, AttemptStatus.IN_PROGRESS);

        mockMvc.perform(post("/api/v1/attempts/" + practiceAttempt.getId() + "/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"partId\": 10, \"questionId\": \"q_unknown\", \"answer\": \"A\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404))
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    @DisplayName("ESSAY question returns HTTP 422 VALIDATION_FAILED")
    void feedback_essayQuestion_returns422() throws Exception {
        TestAttempt practiceAttempt = createAttempt(1, TestMode.PRACTICE, AttemptStatus.IN_PROGRESS);

        mockMvc.perform(post("/api/v1/attempts/" + practiceAttempt.getId() + "/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"partId\": 10, \"questionId\": \"q_essay\", \"answer\": \"Some essay\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value(422))
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    @DisplayName("Missing answer field returns HTTP 422 VALIDATION_FAILED")
    void feedback_missingAnswerField_returns422() throws Exception {
        TestAttempt practiceAttempt = createAttempt(1, TestMode.PRACTICE, AttemptStatus.IN_PROGRESS);

        mockMvc.perform(post("/api/v1/attempts/" + practiceAttempt.getId() + "/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"partId\": 10, \"questionId\": \"q_1\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value(422))
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Malformed JSON and Non-Leak Sentinel Verification
    // ─────────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Malformed JSON containing sensitive sentinel token does not leak sentinel in error response or logs")
    void feedback_malformedJson_returns400AndDoesNotLeakSentinel(CapturedOutput output) throws Exception {
        TestAttempt practiceAttempt = createAttempt(1, TestMode.PRACTICE, AttemptStatus.IN_PROGRESS);
        String sentinel = "SENTINEL_SECRET_TOKEN_XYZ987";
        String malformedJson = "{\"partId\": 10, \"questionId\": \"q_1\", \"answer\": \"" + sentinel + "\""; // unclosed brace

        MvcResult result = mockMvc.perform(post("/api/v1/attempts/" + practiceAttempt.getId() + "/practice-feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content(malformedJson))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andReturn();

        String responseBody = result.getResponse().getContentAsString();
        assertThat(responseBody).doesNotContain(sentinel);
        assertThat(output.getAll()).doesNotContain(sentinel);
    }
}
