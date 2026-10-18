package com.multilingo.backend.modules.testing.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.adapter.repository.AttemptListeningPlaybackRepository;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.service.support.ToeicListeningMediaProfile;
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
import org.springframework.test.web.servlet.MvcResult;
import org.mockito.MockedStatic;
import org.mockito.Mockito;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * TW-09 — cross-cutting backend contract for the TOEIC Part 1–7 workspace.
 *
 * Runs the real controller, the real {@code TestAttemptServiceImpl} workspace projection, the real
 * {@code WorkspaceSnapshotSanitizer}, the real {@code ListeningPlaybackService}/timeline and the real
 * JPA adapter against the test datasource. Only the verified media-metadata resource (which is an
 * environment artifact) is replaced, exactly like {@code ListeningPlaybackContractIT}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@WithMockUser(username = "1", roles = "USER")
class ToeicWorkspaceContractIT {

    private static final String TOEIC_CODE = "TOEIC-ETS-2024-T1-V2";
    private static final int LISTENING_SECTION_ID = 10;

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private TestAttemptRepository testAttemptRepository;
    @Autowired private AttemptListeningPlaybackRepository playbackRepository;
    @Autowired private IdentityAdapter identityAdapter;

    private final List<Integer> createdAttemptIds = new ArrayList<>();
    private MockedStatic<ToeicListeningMediaProfile> mediaProfile;

    @BeforeEach
    void useExplicitSyntheticVerifiedMetadata() throws Exception {
        ToeicListeningMediaProfile fixture = new ObjectMapper().readValue(
                getClass().getResourceAsStream("/testing/toeic-listening-verified-fixture.json"),
                ToeicListeningMediaProfile.class);
        mediaProfile = Mockito.mockStatic(ToeicListeningMediaProfile.class, invocation ->
                invocation.getMethod().getName().equals("loadDefault") ? fixture : invocation.callRealMethod());
        mediaProfile.when(ToeicListeningMediaProfile::loadDefault).thenReturn(fixture);
    }

    @AfterEach
    void tearDown() {
        for (Integer id : createdAttemptIds) {
            playbackRepository.deleteByAttemptId(id);
            testAttemptRepository.deleteById(id);
        }
        createdAttemptIds.clear();
        mediaProfile.close();
    }

    /* ---------------------------------------------------------------- */
    /* Snapshot fixture: canonical 1..200 across Listening (P1–4) + P5–7 */
    /* ---------------------------------------------------------------- */

    private static List<Integer> groupSizes(int partNumber) {
        return switch (partNumber) {
            case 1 -> List.of(6);
            case 2 -> List.of(25);
            case 3 -> java.util.Collections.nCopies(13, 3);
            case 4 -> java.util.Collections.nCopies(10, 3);
            case 5 -> List.of(30);
            case 6 -> List.of(4, 4, 4, 4);
            case 7 -> {
                List<Integer> sizes = new ArrayList<>();
                for (int i = 0; i < 12; i++) sizes.add(4);
                sizes.add(2);
                sizes.add(2);
                sizes.add(2);
                yield sizes;
            }
            default -> List.of();
        };
    }

    /** Full 7-Part snapshot where every secret field is present so we can prove it is stripped. */
    private static Map<String, Object> buildCanonicalSnapshot() {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("code", TOEIC_CODE);
        snapshot.put("exam_code", TOEIC_CODE);
        snapshot.put("type", "TOEIC");
        snapshot.put("title", "ETS TOEIC 2024 Test 1");

        List<Map<String, Object>> listeningParts = new ArrayList<>();
        List<Map<String, Object>> readingParts = new ArrayList<>();
        int cursor = 0;

        for (int part = 1; part <= 7; part++) {
            Map<String, Object> partMap = new LinkedHashMap<>();
            partMap.put("id", 100 + part);
            partMap.put("part_id", 100 + part);
            partMap.put("partNumber", part);
            partMap.put("part_number", part);
            partMap.put("title", "Part " + part);
            if (part <= 4) {
                partMap.put("shared_audio", Map.of("url", "https://media.test/p" + part + ".mp3"));
            }

            List<Map<String, Object>> groups = new ArrayList<>();
            int groupIndex = 0;
            for (int size : groupSizes(part)) {
                groupIndex++;
                List<Map<String, Object>> questions = new ArrayList<>();
                for (int i = 0; i < size; i++) {
                    cursor++;
                    String id = String.format("q_%03d", cursor);
                    Map<String, Object> question = new LinkedHashMap<>();
                    question.put("question_id", id);
                    question.put("type", "SINGLE_CHOICE");
                    if (part <= 2) {
                        question.put("question_text", "SPOKEN PROMPT FOR " + id);
                    } else if (part == 3 || part == 4) {
                        question.put("question_text", "Question " + cursor + ": What is the purpose of the call?");
                    } else {
                        question.put("question_text", "Prompt for " + id);
                    }
                    question.put("options", List.of(
                            Map.of("id", "A", "text", "Option A " + id),
                            Map.of("id", "B", "text", "Option B " + id),
                            Map.of("id", "C", "text", "Option C " + id),
                            Map.of("id", "D", "text", "Option D " + id)));
                    question.put("media", null);
                    // Secrets: must never reach the workspace response, must stay in the DB snapshot.
                    question.put("correct_answer", "A");
                    question.put("explanation", "Because A " + id);
                    question.put("listening_transcript", "TRANSCRIPT " + id);
                    question.put("answer_clue", "CLUE " + id);
                    questions.add(question);
                }

                Map<String, Object> group = new LinkedHashMap<>();
                group.put("group_id", "p" + part + "-g" + groupIndex);
                group.put("instruction", groupIndex == 1 ? "Directions for Part " + part : null);
                if (part >= 6) {
                    group.put("content_html", "<p>Passage p" + part + "-g" + groupIndex + "</p>");
                }
                group.put("questions", questions);
                groups.add(group);
            }
            partMap.put("question_groups", groups);
            if (part <= 4) listeningParts.add(partMap); else readingParts.add(partMap);
        }

        snapshot.put("sections", List.of(
                Map.of("id", LISTENING_SECTION_ID, "section_id", LISTENING_SECTION_ID,
                        "skillType", "LISTENING", "skill_type", "LISTENING", "title", "Listening", "parts", listeningParts),
                Map.of("id", 20, "section_id", 20,
                        "skillType", "READING", "skill_type", "READING", "title", "Reading", "parts", readingParts)));
        return snapshot;
    }

    private TestAttempt createAttempt(TestMode mode, AttemptStatus status, Instant deadline,
                                      Integer userId, Map<String, Object> snapshot) {
        TestAttempt attempt = TestAttempt.builder()
                .userId(userId != null ? userId : identityAdapter.getCurrentUserId())
                .examId(999)
                .testScope(TestScope.FULL_EXAM)
                .testMode(mode)
                .status(status)
                .startTime(Instant.now().minusSeconds(60).truncatedTo(java.time.temporal.ChronoUnit.MILLIS))
                .deadline(deadline != null ? deadline.truncatedTo(java.time.temporal.ChronoUnit.MILLIS) : null)
                .version(1)
                .timeSpentSeconds(60)
                .examSnapshot(snapshot)
                .lockedSections(new ArrayList<>())
                .build();
        TestAttempt saved = testAttemptRepository.save(attempt);
        createdAttemptIds.add(saved.getId());
        return saved;
    }

    private JsonNode workspaceData(int attemptId) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/workspace"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8)).get("data");
    }

    private static JsonNode groupsOf(JsonNode part) {
        return part.has("question_groups") ? part.get("question_groups") : part.get("questionGroups");
    }

    /* ---------------------------------------------------------------- */
    /* 1. Projection: 7 Parts, canonical 1..200, 3-question groups       */
    /* ---------------------------------------------------------------- */

    @Test
    @DisplayName("TW-09: workspace projects 7 Parts, canonical 1..200 chain and three-question Part 3/4 groups")
    void workspaceProjectsCanonicalWholeExamNumbering() throws Exception {
        TestAttempt attempt = createAttempt(TestMode.MOCK_TEST, AttemptStatus.IN_PROGRESS,
                Instant.now().plusSeconds(3600), 1, buildCanonicalSnapshot());

        JsonNode snapshot = workspaceData(attempt.getId()).get("examSnapshot");
        List<JsonNode> parts = new ArrayList<>();
        List<Integer> numbers = new ArrayList<>();
        for (JsonNode section : snapshot.get("sections")) {
            for (JsonNode part : section.get("parts")) {
                parts.add(part);
                for (JsonNode group : groupsOf(part)) {
                    for (JsonNode question : group.get("questions")) {
                        numbers.add(question.get("question_number").asInt());
                    }
                }
            }
        }

        assertThat(parts).hasSize(7);
        assertThat(numbers).hasSize(200);
        // Whole-exam chain is complete, unique and in server order.
        assertThat(numbers).isSorted();
        assertThat(numbers).containsExactlyElementsOf(
                java.util.stream.IntStream.rangeClosed(1, 200).boxed().toList());

        JsonNode part3 = parts.stream().filter(p -> p.get("part_number").asInt() == 3).findFirst().orElseThrow();
        JsonNode part4 = parts.stream().filter(p -> p.get("part_number").asInt() == 4).findFirst().orElseThrow();
        for (JsonNode group : groupsOf(part3)) {
            assertThat(group.get("questions")).hasSize(3);
        }
        for (JsonNode group : groupsOf(part4)) {
            assertThat(group.get("questions")).hasSize(3);
        }
        assertThat(groupsOf(parts.stream().filter(p -> p.get("part_number").asInt() == 6).findFirst().orElseThrow()))
                .hasSize(4);
        assertThat(groupsOf(parts.stream().filter(p -> p.get("part_number").asInt() == 7).findFirst().orElseThrow()))
                .hasSize(15);

        // Part 3/4 prompt prefix is stripped only for the canonical question number.
        JsonNode part3FirstQuestion = groupsOf(part3).get(0).get("questions").get(0);
        assertThat(part3FirstQuestion.get("question_id").asText()).isEqualTo("q_032");
        assertThat(part3FirstQuestion.get("question_text").asText())
                .isEqualTo("What is the purpose of the call?");
    }

    /* ---------------------------------------------------------------- */
    /* 2. Mock filtering must not mutate the stored snapshot             */
    /* ---------------------------------------------------------------- */

    @Test
    @DisplayName("TW-09: Mock workspace hides transcript/answer/clue keys but the stored snapshot keeps them")
    void mockWorkspaceStripsSecretsWithoutMutatingStoredSnapshot() throws Exception {
        TestAttempt attempt = createAttempt(TestMode.MOCK_TEST, AttemptStatus.IN_PROGRESS,
                Instant.now().plusSeconds(3600), 1, buildCanonicalSnapshot());

        MvcResult result = mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/workspace"))
                .andExpect(status().isOk())
                .andReturn();
        String body = result.getResponse().getContentAsString(StandardCharsets.UTF_8);

        assertThat(body).doesNotContain("listening_transcript");
        assertThat(body).doesNotContain("TRANSCRIPT ");
        assertThat(body).doesNotContain("correct_answer");
        assertThat(body).doesNotContain("explanation");
        assertThat(body).doesNotContain("CLUE ");

        JsonNode part1 = workspaceData(attempt.getId()).get("examSnapshot").get("sections").get(0).get("parts").get(0);
        JsonNode firstQuestion = groupsOf(part1).get(0).get("questions").get(0);
        assertThat(firstQuestion.get("question_text").asText()).isEqualTo("Question 1");
        assertThat(firstQuestion.get("options").get(0).get("text").asText()).isEmpty();
        assertThat(firstQuestion.get("options").get(3).get("text").asText()).isEmpty();

        // The persisted snapshot is untouched: the sanitizer/projection only ever operate on a copy.
        TestAttempt reloaded = testAttemptRepository.findById(attempt.getId()).orElseThrow();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> storedSections = (List<Map<String, Object>>) reloaded.getExamSnapshot().get("sections");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> storedListeningParts = (List<Map<String, Object>>) storedSections.get(0).get("parts");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> storedGroups = (List<Map<String, Object>>) storedListeningParts.get(0).get("question_groups");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> storedQuestions = (List<Map<String, Object>>) storedGroups.get(0).get("questions");
        assertThat(storedQuestions.get(0).get("listening_transcript")).isEqualTo("TRANSCRIPT q_001");
        assertThat(storedQuestions.get(0).get("correct_answer")).isEqualTo("A");
        assertThat(storedQuestions.get(0).get("question_text")).isEqualTo("SPOKEN PROMPT FOR q_001");
    }

    @Test
    @DisplayName("TW-09: Mock workspace redacts flat questions list when both flat questions and groups are present in snapshot")
    void mockWorkspaceRedactsFlatQuestionsAlongsideGroupsWithoutMutatingStoredSnapshot() throws Exception {
        Map<String, Object> snapshot = buildCanonicalSnapshot();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> sections = (List<Map<String, Object>>) snapshot.get("sections");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> parts = (List<Map<String, Object>>) sections.get(0).get("parts");
        Map<String, Object> part1 = parts.get(0);

        // Populate flat questions list alongside question_groups, mirroring DbExamAdapter
        Map<String, Object> flatQ1 = new LinkedHashMap<>();
        flatQ1.put("question_id", "q_001");
        flatQ1.put("question_text", "SECRET SPOKEN PROMPT FOR q_001");
        flatQ1.put("listening_transcript", "SECRET TRANSCRIPT q_001");
        flatQ1.put("correct_answer", "A");
        flatQ1.put("answer_clue", "SECRET CLUE q_001");
        flatQ1.put("options", List.of(
                Map.of("id", "A", "text", "SECRET SPOKEN OPTION A"),
                Map.of("id", "B", "text", "SECRET SPOKEN OPTION B")
        ));
        part1.put("questions", new ArrayList<>(List.of(flatQ1)));

        TestAttempt attempt = createAttempt(TestMode.MOCK_TEST, AttemptStatus.IN_PROGRESS,
                Instant.now().plusSeconds(3600), 1, snapshot);

        MvcResult result = mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/workspace"))
                .andExpect(status().isOk())
                .andReturn();
        String body = result.getResponse().getContentAsString(StandardCharsets.UTF_8);

        // Entire serialized response body must be clean
        assertThat(body).doesNotContain("SECRET");
        assertThat(body).doesNotContain("listening_transcript");
        assertThat(body).doesNotContain("correct_answer");

        JsonNode projPart1 = workspaceData(attempt.getId()).get("examSnapshot").get("sections").get(0).get("parts").get(0);
        JsonNode flatQuestions = projPart1.get("questions");
        assertThat(flatQuestions).isNotNull();
        assertThat(flatQuestions.size()).isEqualTo(1);
        JsonNode projFlatQ1 = flatQuestions.get(0);
        assertThat(projFlatQ1.get("question_text").asText()).isEqualTo("Question 1");
        assertThat(projFlatQ1.get("options").get(0).get("text").asText()).isEmpty();

        // Database entity is unmutated
        TestAttempt reloaded = testAttemptRepository.findById(attempt.getId()).orElseThrow();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> storedSections = (List<Map<String, Object>>) reloaded.getExamSnapshot().get("sections");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> storedParts = (List<Map<String, Object>>) storedSections.get(0).get("parts");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> storedFlatQuestions = (List<Map<String, Object>>) storedParts.get(0).get("questions");
        assertThat(storedFlatQuestions.get(0).get("question_text")).isEqualTo("SECRET SPOKEN PROMPT FOR q_001");
        assertThat(storedFlatQuestions.get(0).get("listening_transcript")).isEqualTo("SECRET TRANSCRIPT q_001");
    }

    /* ---------------------------------------------------------------- */
    /* 3. Playback: start → workspace summary → timeline invariant        */
    /* ---------------------------------------------------------------- */

    @Test
    @DisplayName("TW-09: Mock playback start is idempotent, surfaces in the workspace summary and never touches attempt state")
    void mockPlaybackStartIsIdempotentAndStateSafe() throws Exception {
        TestAttempt attempt = createAttempt(TestMode.MOCK_TEST, AttemptStatus.IN_PROGRESS,
                Instant.now().plusSeconds(3600), 1, buildCanonicalSnapshot());
        Integer initialVersion = attempt.getVersion();
        Instant initialDeadline = attempt.getDeadline();

        // Before start: summary available, no playback row created by a workspace read.
        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/workspace"))
                .andExpect(jsonPath("$.data.listeningPlayback.status").value("NOT_STARTED"))
                .andExpect(jsonPath("$.data.listeningPlayback.available").value(true));
        assertThat(playbackRepository.findByAttemptId(attempt.getId())).isEmpty();

        MvcResult first = mockMvc.perform(post("/api/v1/attempts/" + attempt.getId() + "/listening-playback/start"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RUNNING"))
                .andExpect(jsonPath("$.data.tracks.length()").value(4))
                .andExpect(jsonPath("$.data.activePartNumber").value(1))
                .andReturn();
        String firstStartedAt = objectMapper.readTree(first.getResponse().getContentAsString())
                .get("data").get("startedAt").asText();

        MvcResult second = mockMvc.perform(post("/api/v1/attempts/" + attempt.getId() + "/listening-playback/start"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RUNNING"))
                .andReturn();
        assertThat(objectMapper.readTree(second.getResponse().getContentAsString()).get("data").get("startedAt").asText())
                .isEqualTo(firstStartedAt);

        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/workspace"))
                .andExpect(jsonPath("$.data.listeningPlayback.status").value("RUNNING"))
                .andExpect(jsonPath("$.data.listeningPlayback.available").value(true));

        TestAttempt reloaded = testAttemptRepository.findById(attempt.getId()).orElseThrow();
        assertThat(reloaded.getVersion()).isEqualTo(initialVersion);
        assertThat(reloaded.getDeadline()).isEqualTo(initialDeadline);
        assertThat(reloaded.getExamSnapshot()).isEqualTo(attempt.getExamSnapshot());
        assertThat(playbackRepository.findByAttemptId(attempt.getId())).isPresent();
    }

    @Test
    @DisplayName("TW-09: after start the server timeline is self-consistent so a reload can jump to the current position")
    void playbackTimelineIsServerAuthoritativeAfterStart() throws Exception {
        TestAttempt attempt = createAttempt(TestMode.MOCK_TEST, AttemptStatus.IN_PROGRESS,
                Instant.now().plusSeconds(3600), 1, buildCanonicalSnapshot());
        mockMvc.perform(post("/api/v1/attempts/" + attempt.getId() + "/listening-playback/start"))
                .andExpect(status().isOk());

        MvcResult result = mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/listening-playback"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RUNNING"))
                .andExpect(jsonPath("$.data.startedAt").isNotEmpty())
                .andExpect(jsonPath("$.data.serverTime").isNotEmpty())
                .andReturn();
        JsonNode data = objectMapper.readTree(result.getResponse().getContentAsString()).get("data");

        long totalDurationMs = data.get("totalDurationMs").asLong();
        long elapsedMs = data.get("elapsedMs").asLong();
        long positionMs = data.get("positionMs").asLong();
        long remainingMs = data.get("remainingMs").asLong();

        assertThat(elapsedMs).isGreaterThanOrEqualTo(0);
        assertThat(elapsedMs + remainingMs).isEqualTo(totalDurationMs);

        int activePartNumber = data.get("activePartNumber").asInt();
        JsonNode activeTrack = data.get("tracks").get(activePartNumber - 1);
        assertThat(activeTrack.get("partNumber").asInt()).isEqualTo(activePartNumber);
        // Position is expressed inside the active track, so a reconnect resumes instead of replaying.
        assertThat(positionMs).isEqualTo(elapsedMs - activeTrack.get("startOffsetMs").asLong());
        assertThat(data.get("activePartId").asText()).isEqualTo(activeTrack.get("partId").asText());
    }

    /* ---------------------------------------------------------------- */
    /* 4. Practice is excluded from playback                              */
    /* ---------------------------------------------------------------- */

    @Test
    @DisplayName("TW-09: Practice has no playback summary and is rejected by GET/POST playback without leaking content")
    void practiceIsExcludedFromPlayback() throws Exception {
        TestAttempt attempt = createAttempt(TestMode.PRACTICE, AttemptStatus.IN_PROGRESS,
                null, 1, buildCanonicalSnapshot());

        MvcResult workspace = mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/workspace"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.listeningPlayback").doesNotExist())
                .andReturn();
        String body = workspace.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).doesNotContain("listeningPlayback");
        // The sanitizer removes solution keys for every mode; Practice keeps its own content
        // (transcript/clue filtering is a Mock-only requirement: see the Mock test above).
        assertThat(body).doesNotContain("correct_answer");
        assertThat(body).doesNotContain("explanation");

        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/listening-playback"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
        mockMvc.perform(post("/api/v1/attempts/" + attempt.getId() + "/listening-playback/start"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
        assertThat(playbackRepository.findByAttemptId(attempt.getId())).isEmpty();
    }

    /* ---------------------------------------------------------------- */
    /* 5. Ownership and lock/expiry gates                                 */
    /* ---------------------------------------------------------------- */

    @Test
    @DisplayName("TW-09: foreign attempts return 403 without leaking the snapshot")
    void foreignAttemptIsForbiddenWithoutLeak() throws Exception {
        TestAttempt foreign = createAttempt(TestMode.MOCK_TEST, AttemptStatus.IN_PROGRESS,
                Instant.now().plusSeconds(3600), 9999, buildCanonicalSnapshot());

        MvcResult result = mockMvc.perform(get("/api/v1/attempts/" + foreign.getId() + "/workspace"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403))
                .andReturn();
        String body = result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).doesNotContain("examSnapshot");
        assertThat(body).doesNotContain("q_001");
        assertThat(body).doesNotContain("TOEIC");

        mockMvc.perform(get("/api/v1/attempts/" + foreign.getId() + "/listening-playback"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    @DisplayName("TW-09: locked Listening section and expired deadline close playback without changing the attempt")
    void lockdownAndExpiryClosePlaybackWithoutMutatingAttempt() throws Exception {
        TestAttempt locked = createAttempt(TestMode.MOCK_TEST, AttemptStatus.IN_PROGRESS,
                Instant.now().plusSeconds(3600), 1, buildCanonicalSnapshot());
        locked.setLockedSections(List.of(LISTENING_SECTION_ID));
        testAttemptRepository.save(locked);
        Integer lockedVersion = locked.getVersion();

        mockMvc.perform(get("/api/v1/attempts/" + locked.getId() + "/listening-playback"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("LOCKED"));
        mockMvc.perform(get("/api/v1/attempts/" + locked.getId() + "/workspace"))
                .andExpect(jsonPath("$.data.listeningPlayback.status").value("LOCKED"))
                .andExpect(jsonPath("$.data.listeningPlayback.available").value(false));

        TestAttempt expired = createAttempt(TestMode.MOCK_TEST, AttemptStatus.IN_PROGRESS,
                Instant.now().minusSeconds(100), 1, buildCanonicalSnapshot());
        mockMvc.perform(get("/api/v1/attempts/" + expired.getId() + "/listening-playback"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CLOSED"));

        TestAttempt reloaded = testAttemptRepository.findById(locked.getId()).orElseThrow();
        assertThat(reloaded.getVersion()).isEqualTo(lockedVersion);
        assertThat(reloaded.getExamSnapshot()).isEqualTo(locked.getExamSnapshot());
        assertThat(playbackRepository.findByAttemptId(expired.getId())).isEmpty();
    }
}
