package com.multilingo.backend.modules.testing.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.adapter.ExamAdapter;
import com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@WithMockUser(username = "1", roles = "USER")
class TestAttemptResumeControllerIT {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TestAttemptRepository testAttemptRepository;

    @Autowired
    private AttemptAnswerRepository attemptAnswerRepository;

    @SpyBean
    private ExamAdapter examAdapter;

    private final List<Integer> createdAttemptIds = new ArrayList<>();

    private static final Set<String> BLACKLISTED_KEYS = Set.of(
            "correct_answer", "correctAnswer",
            "explanation",
            "ai_prompt_context", "aiPromptContext",
            "ai_feedback", "aiFeedback",
            "feedback",
            "grading_key", "gradingKey",
            "grading_keys", "gradingKeys",
            "is_correct_flags", "isCorrectFlags",
            "earned_score", "earnedScore",
            "skill_stats", "skillStats",
            "accepted_answers", "acceptedAnswers"
    );

    @BeforeEach
    void setUp() {
        reset(examAdapter);
    }

    @AfterEach
    void tearDown() {
        for (Integer attemptId : createdAttemptIds) {
            try {
                attemptAnswerRepository.deleteAll(attemptAnswerRepository.findByAttemptId(attemptId));
                testAttemptRepository.deleteById(attemptId);
            } catch (Exception ignored) {
            }
        }
        createdAttemptIds.clear();
    }

    private TestAttempt seedAttempt(Integer userId, int version, TestMode mode, AttemptStatus status, Instant deadline) {
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("id", "q_1");
        question.put("prompt", "Hãy viết một bài văn ngắn về du lịch");
        question.put("correct_answer", "Secret correct answer");
        question.put("explanation", "Secret reasoning");
        question.put("ai_feedback", "Secret AI feedback");
        question.put("grading_key", "Secret grading key");

        Map<String, Object> part = new LinkedHashMap<>();
        part.put("id", 10);
        part.put("name", "Writing Task 1");
        part.put("questions", List.of(question));

        Map<String, Object> section = new LinkedHashMap<>();
        section.put("id", 100);
        section.put("name", "Writing");
        section.put("parts", List.of(part));

        Map<String, Object> lockedSection = new LinkedHashMap<>();
        lockedSection.put("id", 200);
        lockedSection.put("name", "Speaking");
        lockedSection.put("parts", List.of());

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("id", 101);
        snapshot.put("title", "IELTS Practice Test");
        snapshot.put("sections", List.of(section, lockedSection));

        TestAttempt attempt = TestAttempt.builder()
                .userId(userId)
                .examId(101)
                .testScope(TestScope.FULL_EXAM)
                .testMode(mode)
                .status(status)
                .version(version)
                .startTime(Instant.parse("2026-10-10T03:00:00Z"))
                .deadline(deadline)
                .examSnapshot(snapshot)
                .lockedSections(new ArrayList<>(List.of(200)))
                .build();

        TestAttempt saved = testAttemptRepository.save(attempt);
        createdAttemptIds.add(saved.getId());

        // Seed initial answers with string, array, map, null, and Vietnamese essay containing "feedback"
        Map<String, Object> userAnswers = new HashMap<>();
        userAnswers.put("q_1", "Đây là bài essay tiếng Việt với nhận xét và feedback học tập.");
        userAnswers.put("q_str", "A");
        userAnswers.put("q_arr", List.of("opt1", "opt2"));
        userAnswers.put("q_map", Map.of("key1", "val1"));
        userAnswers.put("q_null", null);

        AttemptAnswer answer = AttemptAnswer.builder()
                .attempt(saved)
                .partId(10)
                .userAnswers(userAnswers)
                .build();
        attemptAnswerRepository.save(answer);

        return saved;
    }

    @Test
    void putAnswers_thenGetWorkspace_returnsVersion8_andUpdatedAnswers() throws Exception {
        TestAttempt attempt = seedAttempt(1, 7, TestMode.PRACTICE, AttemptStatus.IN_PROGRESS, null);
        Integer attemptId = attempt.getId();

        AutosaveAnswersRequest putRequest = AutosaveAnswersRequest.builder()
                .version(7)
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(10)
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                .questionId("q_1")
                                                .answer("A")
                                                .build()
                                ))
                                .build()
                ))
                .build();

        // 1. PUT autosave answers v7 -> increments to v8
        mockMvc.perform(put("/api/v1/attempts/{id}/answers", attemptId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(putRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value(8));

        // 2. GET workspace -> returns v8, updated answers, real locks, null deadline for PRACTICE
        mockMvc.perform(get("/api/v1/attempts/{id}/workspace", attemptId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.attemptId").value(attemptId))
                .andExpect(jsonPath("$.data.version").value(8))
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.data.savedAnswers[0].part_id").value(10))
                .andExpect(jsonPath("$.data.savedAnswers[0].answers[0].question_id").value("q_1"))
                .andExpect(jsonPath("$.data.savedAnswers[0].answers[0].answer").value("A"))
                .andExpect(jsonPath("$.data.gracePeriodSeconds").value(15))
                .andExpect(jsonPath("$.data.serverTime").isNotEmpty())
                .andExpect(jsonPath("$.data.deadline").doesNotExist())
                .andExpect(jsonPath("$.data.lockedSections[0]").value(200));
    }

    @Test
    void getWorkspaceAlias_returnsSameShape() throws Exception {
        TestAttempt attempt = seedAttempt(1, 7, TestMode.PRACTICE, AttemptStatus.IN_PROGRESS, null);
        Integer attemptId = attempt.getId();

        MvcResult aliasResult = mockMvc.perform(get("/api/v1/attempts/{id}", attemptId))
                .andExpect(status().isOk())
                .andReturn();

        MvcResult directResult = mockMvc.perform(get("/api/v1/attempts/{id}/workspace", attemptId))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode aliasNode = objectMapper.readTree(aliasResult.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).get("data");
        JsonNode directNode = objectMapper.readTree(directResult.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).get("data");

        assertThat(aliasNode.get("attemptId").asInt()).isEqualTo(directNode.get("attemptId").asInt());
        assertThat(aliasNode.get("version").asInt()).isEqualTo(directNode.get("version").asInt());
        assertThat(aliasNode.get("status").asText()).isEqualTo(directNode.get("status").asText());
    }

    @Test
    void repeatedGetWorkspace_doesNotChangeVersionOrStartTimeOrDeadline() throws Exception {
        Instant deadline = Instant.now().plusSeconds(7200).truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
        TestAttempt attempt = seedAttempt(1, 7, TestMode.MOCK_TEST, AttemptStatus.IN_PROGRESS, deadline);
        Integer attemptId = attempt.getId();

        MvcResult firstResult = mockMvc.perform(get("/api/v1/attempts/{id}/workspace", attemptId))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode firstData = objectMapper.readTree(firstResult.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).get("data");

        MvcResult secondResult = mockMvc.perform(get("/api/v1/attempts/{id}/workspace", attemptId))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode secondData = objectMapper.readTree(secondResult.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).get("data");

        // Assert response values match initial state and stay IN_PROGRESS
        assertThat(firstData.get("status").asText()).isEqualTo("IN_PROGRESS");
        assertThat(firstData.get("version").asInt()).isEqualTo(7);
        assertThat(firstData.get("startTime").asText()).isEqualTo(attempt.getStartTime().toString());
        assertThat(firstData.get("deadline").asText()).isEqualTo(deadline.toString());

        assertThat(secondData.get("status").asText()).isEqualTo("IN_PROGRESS");
        assertThat(secondData.get("version").asInt()).isEqualTo(7);
        assertThat(secondData.get("startTime").asText()).isEqualTo(firstData.get("startTime").asText());
        assertThat(secondData.get("deadline").asText()).isEqualTo(firstData.get("deadline").asText());

        // Assert database persisted state is intact (not modified, no version bump, still IN_PROGRESS)
        TestAttempt persisted = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(persisted.getStatus()).isEqualTo(AttemptStatus.IN_PROGRESS);
        assertThat(persisted.getVersion()).isEqualTo(7);
        assertThat(persisted.getStartTime()).isEqualTo(attempt.getStartTime());
        assertThat(persisted.getDeadline()).isEqualTo(deadline);
    }

    @Test
    void getWorkspace_nonOwnerOrMissingId_returnsForbidden() throws Exception {
        // Seed attempt owned by userId=2 (non-owner relative to authenticated user 1)
        TestAttempt nonOwnerAttempt = seedAttempt(2, 7, TestMode.PRACTICE, AttemptStatus.IN_PROGRESS, null);

        mockMvc.perform(get("/api/v1/attempts/{id}/workspace", nonOwnerAttempt.getId()))
                .andExpect(status().isForbidden());

        // Missing attempt ID
        mockMvc.perform(get("/api/v1/attempts/{id}/workspace", 9999999))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithAnonymousUser
    void getWorkspace_anonymousUser_returnsUnauthorized() throws Exception {
        TestAttempt attempt = seedAttempt(1, 7, TestMode.PRACTICE, AttemptStatus.IN_PROGRESS, null);

        mockMvc.perform(get("/api/v1/attempts/{id}/workspace", attempt.getId()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(909));
    }

    @Test
    void getWorkspace_legacySnapshot_sanitizesPrivateKeysInResponse_whileDatabaseSnapshotRemainsIntact() throws Exception {
        TestAttempt attempt = seedAttempt(1, 7, TestMode.PRACTICE, AttemptStatus.IN_PROGRESS, null);
        Integer attemptId = attempt.getId();

        MvcResult result = mockMvc.perform(get("/api/v1/attempts/{id}/workspace", attemptId))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
        JsonNode snapshotNode = root.path("data").path("examSnapshot");

        // 1. Recursive check that NO blacklisted keys exist anywhere in the returned snapshot
        assertNoBlacklistedKeysRecursive(snapshotNode, BLACKLISTED_KEYS);

        // 2. User answers contain text with "feedback" and Vietnamese characters intact
        JsonNode savedAnswers = root.path("data").path("savedAnswers");
        assertThat(savedAnswers.isArray()).isTrue();
        String essayAnswer = savedAnswers.get(0).get("answers").get(0).get("answer").asText();
        assertThat(essayAnswer).contains("feedback");
        assertThat(essayAnswer).contains("tiếng Việt");

        // 3. Database snapshot still contains the original private keys (not modified)
        TestAttempt reloaded = testAttemptRepository.findById(attemptId).orElseThrow();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> sections = (List<Map<String, Object>>) reloaded.getExamSnapshot().get("sections");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> parts = (List<Map<String, Object>>) sections.getFirst().get("parts");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> questions = (List<Map<String, Object>>) parts.getFirst().get("questions");

        assertThat(questions.getFirst()).containsKey("correct_answer");
        assertThat(questions.getFirst()).containsKey("explanation");
        assertThat(questions.getFirst()).containsKey("ai_feedback");
        assertThat(questions.getFirst()).containsKey("grading_key");

        // 4. Verify ExamAdapter was never called to fetch source exam
        verify(examAdapter, never()).findById(any());
    }

    @ParameterizedTest
    @EnumSource(value = AttemptStatus.class, names = {"SUBMITTED", "COMPLETED", "EXPIRED", "GRADING_FAILED"})
    void getWorkspace_terminalStatuses_returnsStatusWithoutRegradingOrIncrementingVersion(AttemptStatus terminalStatus) throws Exception {
        TestAttempt attempt = seedAttempt(1, 7, TestMode.MOCK_TEST, terminalStatus, Instant.now().minusSeconds(100));
        Integer attemptId = attempt.getId();

        mockMvc.perform(get("/api/v1/attempts/{id}/workspace", attemptId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.attemptId").value(attemptId))
                .andExpect(jsonPath("$.data.status").value(terminalStatus.name()))
                .andExpect(jsonPath("$.data.version").value(7));

        TestAttempt reloaded = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(reloaded.getVersion()).isEqualTo(7);
        assertThat(reloaded.getStatus()).isEqualTo(terminalStatus);
    }

    private void assertNoBlacklistedKeysRecursive(JsonNode node, Set<String> blacklisted) {
        if (node.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> entry = fields.next();
                assertThat(blacklisted).as("Field key: " + entry.getKey()).doesNotContain(entry.getKey());
                assertNoBlacklistedKeysRecursive(entry.getValue(), blacklisted);
            }
        } else if (node.isArray()) {
            for (JsonNode child : node) {
                assertNoBlacklistedKeysRecursive(child, blacklisted);
            }
        }
    }
}
