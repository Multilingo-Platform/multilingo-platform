package com.multilingo.backend.modules.testing.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.adapter.entity.AttemptListeningPlayback;
import com.multilingo.backend.modules.testing.adapter.repository.AttemptListeningPlaybackRepository;
import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@WithMockUser(username = "1", roles = "USER")
class ListeningPlaybackContractIT {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TestAttemptRepository testAttemptRepository;

    @Autowired
    private AttemptListeningPlaybackRepository playbackRepository;

    @Autowired
    private IdentityAdapter identityAdapter;

    private final List<Integer> createdAttemptIds = new ArrayList<>();
    @Autowired private com.multilingo.backend.modules.testing.service.ListeningPlaybackService playbackService;
    private org.mockito.MockedStatic<com.multilingo.backend.modules.testing.service.support.ToeicListeningMediaProfile> mediaProfile;

    @BeforeEach
    void useExplicitSyntheticVerifiedMetadata() throws Exception {
        var type = com.multilingo.backend.modules.testing.service.support.ToeicListeningMediaProfile.class;
        var fixture = new ObjectMapper().readValue(getClass().getResourceAsStream(
                "/testing/toeic-listening-verified-fixture.json"), type);
        mediaProfile = org.mockito.Mockito.mockStatic(type, invocation ->
                invocation.getMethod().getName().equals("loadDefault") ? fixture : invocation.callRealMethod());
        mediaProfile.when(com.multilingo.backend.modules.testing.service.support.ToeicListeningMediaProfile::loadDefault)
                .thenReturn(fixture);
    }


    @AfterEach
    void tearDown() {
        for (Integer id : createdAttemptIds) {
            playbackRepository.deleteByAttemptId(id);
            testAttemptRepository.deleteById(id);
        }
        createdAttemptIds.clear();
        if (mediaProfile != null) {
            mediaProfile.close();
        }
    }

    private static final String TOEIC_CODE = "TOEIC-ETS-2024-T1-V2";

    @Test
    @DisplayName("profile ETS đã xác minh bật summary, GET NOT_STARTED và POST RUNNING với snapshot khớp")
    void verifiedProductionProfileEnablesMockPlaybackForMatchingSnapshot() throws Exception {
        mediaProfile.close();
        mediaProfile = null;
        var profile = com.multilingo.backend.modules.testing.service.support.ToeicListeningMediaProfile.loadDefault();
        TestAttempt attempt = createToeicAttempt(
                TestMode.MOCK_TEST,
                AttemptStatus.IN_PROGRESS,
                Instant.now().plusSeconds(3600),
                1,
                TOEIC_CODE,
                part -> profile.getTrack(part).audioUrl()
        );

        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/workspace"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.listeningPlayback.status").value("NOT_STARTED"))
                .andExpect(jsonPath("$.data.listeningPlayback.available").value(true));
        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/listening-playback"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("NOT_STARTED"));
        mockMvc.perform(post("/api/v1/attempts/" + attempt.getId() + "/listening-playback/start"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RUNNING"));
    }

    private TestAttempt createToeicAttempt(TestMode mode, AttemptStatus status, Instant deadline, Integer userId) {
        return createToeicAttempt(mode, status, deadline, userId, TOEIC_CODE,
                part -> "https://media.test/p" + part + ".mp3");
    }

    private TestAttempt createToeicAttempt(TestMode mode, AttemptStatus status, Instant deadline, Integer userId,
            String examCode, java.util.function.IntFunction<String> audioUrlForPart) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("code", examCode);
        snapshot.put("type", "TOEIC");
        snapshot.put("title", "ETS TOEIC 2024 Test 1");

        List<Map<String, Object>> parts = new ArrayList<>();
        for (int part = 1; part <= 4; part++) {
            Map<String, Object> partMap = new LinkedHashMap<>();
            partMap.put("id", 100 + part);
            partMap.put("partNumber", part);
            partMap.put("title", "Part " + part);
            String audioUrl = audioUrlForPart != null ? audioUrlForPart.apply(part) : null;
            if (audioUrl != null) {
                partMap.put("shared_audio", Map.of("url", audioUrl));
            }
            parts.add(partMap);
        }

        snapshot.put("sections", List.of(
                Map.of("id", 10, "skillType", "LISTENING", "parts", parts),
                Map.of("id", 20, "skillType", "READING", "parts", List.of(
                        Map.of("id", 105, "partNumber", 5, "title", "Incomplete Sentences")
                ))
        ));

        Instant normalizedDeadline = deadline != null ? deadline.truncatedTo(java.time.temporal.ChronoUnit.MILLIS) : null;
        TestAttempt attempt = TestAttempt.builder()
                .userId(userId != null ? userId : identityAdapter.getCurrentUserId())
                .examId(999)
                .testScope(TestScope.FULL_EXAM)
                .testMode(mode)
                .status(status)
                .startTime(Instant.now().minusSeconds(60).truncatedTo(java.time.temporal.ChronoUnit.MILLIS))
                .deadline(normalizedDeadline)
                .version(1)
                .timeSpentSeconds(60)
                .examSnapshot(snapshot)
                .lockedSections(new ArrayList<>())
                .build();

        TestAttempt saved = testAttemptRepository.save(attempt);
        createdAttemptIds.add(saved.getId());
        return saved;
    }

    @Test
    @DisplayName("GET playback với attemptId không tồn tại trả về 404 Not Found")
    void getPlayback_unknownAttempt_returns404() throws Exception {
        mockMvc.perform(get("/api/v1/attempts/999999/listening-playback"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404));
    }

    @Test
    @DisplayName("GET playback với attempt thuộc về user khác trả về 403 Forbidden")
    void getPlayback_otherUserAttempt_returns403() throws Exception {
        TestAttempt otherUserAttempt = createToeicAttempt(
                TestMode.MOCK_TEST,
                AttemptStatus.IN_PROGRESS,
                Instant.now().plusSeconds(3600),
                9999 // Khác user hiện tại (userId=1)
        );

        mockMvc.perform(get("/api/v1/attempts/" + otherUserAttempt.getId() + "/listening-playback"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    @DisplayName("GET playback với chế độ PRACTICE trả về 403 Forbidden")
    void getPlayback_practiceMode_returns403() throws Exception {
        TestAttempt practiceAttempt = createToeicAttempt(
                TestMode.PRACTICE,
                AttemptStatus.IN_PROGRESS,
                null,
                1
        );

        mockMvc.perform(get("/api/v1/attempts/" + practiceAttempt.getId() + "/listening-playback"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    @DisplayName("GET playback với bài thi không phải TOEIC (ví dụ IELTS) trả về 403 Forbidden")
    void getPlayback_nonToeicExam_returns403() throws Exception {
        Map<String, Object> ieltsSnapshot = Map.of(
                "code", "IELTS-CAM-20-T1",
                "type", "IELTS_ACADEMIC",
                "title", "Cambridge IELTS 20 Test 1"
        );

        TestAttempt ieltsAttempt = TestAttempt.builder()
                .userId(1)
                .examId(888)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.MOCK_TEST)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(Instant.now())
                .deadline(Instant.now().plusSeconds(3600))
                .examSnapshot(ieltsSnapshot)
                .build();
        ieltsAttempt = testAttemptRepository.save(ieltsAttempt);
        createdAttemptIds.add(ieltsAttempt.getId());

        mockMvc.perform(get("/api/v1/attempts/" + ieltsAttempt.getId() + "/listening-playback"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    @DisplayName("GET playback với attempt đã nộp trả về trạng thái CLOSED")
    void getPlayback_submittedAttempt_returnsClosedStatus() throws Exception {
        TestAttempt completedAttempt = createToeicAttempt(
                TestMode.MOCK_TEST,
                AttemptStatus.COMPLETED,
                Instant.now().plusSeconds(3600),
                1
        );

        mockMvc.perform(get("/api/v1/attempts/" + completedAttempt.getId() + "/listening-playback"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CLOSED"));
    }

    @Test
    @DisplayName("GET playback với attempt đã hết hạn làm bài trả về trạng thái CLOSED")
    void getPlayback_expiredAttempt_returnsClosedStatus() throws Exception {
        TestAttempt expiredAttempt = createToeicAttempt(
                TestMode.MOCK_TEST,
                AttemptStatus.IN_PROGRESS,
                Instant.now().minusSeconds(100), // Đã quá hạn
                1
        );

        mockMvc.perform(get("/api/v1/attempts/" + expiredAttempt.getId() + "/listening-playback"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CLOSED"));
    }

    @Test
    @DisplayName("GET playback khi Listening section đã bị khóa trả về trạng thái LOCKED")
    void getPlayback_listeningSectionLocked_returnsLockedStatus() throws Exception {
        TestAttempt attempt = createToeicAttempt(
                TestMode.MOCK_TEST,
                AttemptStatus.IN_PROGRESS,
                Instant.now().plusSeconds(3600),
                1
        );
        // Khóa Listening section (id = 10)
        attempt.setLockedSections(List.of(10));
        testAttemptRepository.save(attempt);

        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/listening-playback"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("LOCKED"));
    }

    @Test
    @DisplayName("GET playback trước khi start trả về NOT_STARTED với đủ 4 tracks, URL và duration")
    void getPlayback_beforeStart_returnsNotStartedWithTracks() throws Exception {
        TestAttempt attempt = createToeicAttempt(
                TestMode.MOCK_TEST,
                AttemptStatus.IN_PROGRESS,
                Instant.now().plusSeconds(3600),
                1
        );

        MvcResult result = mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/listening-playback"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("NOT_STARTED"))
                .andExpect(jsonPath("$.data.positionMs").value(0))
                .andExpect(jsonPath("$.data.activePartNumber").value(1))
                .andExpect(jsonPath("$.data.activePartId").value("101"))
                .andExpect(jsonPath("$.data.tracks").isArray())
                .andExpect(jsonPath("$.data.tracks.length()").value(4))
                .andExpect(jsonPath("$.data.tracks[0].partNumber").value(1))
                .andExpect(jsonPath("$.data.tracks[0].audioUrl").isNotEmpty())
                .andExpect(jsonPath("$.data.tracks[0].durationMs").value(173505))
                .andReturn();

        String responseBody = result.getResponse().getContentAsString();
        // Bảo mật tuyệt đối: không lộ clues, transcript, options hay correct answers
        assertThat(responseBody).doesNotContain("transcript");
        assertThat(responseBody).doesNotContain("correct_answer");
        assertThat(responseBody).doesNotContain("options");
        assertThat(responseBody).doesNotContain("clues");
    }

    @Test
    @DisplayName("POST /start khởi động playback, idempotent khi gọi nhiều lần, không làm thay đổi attempt version")
    void startPlayback_idempotentAndVersionSafe() throws Exception {
        TestAttempt attempt = createToeicAttempt(
                TestMode.MOCK_TEST,
                AttemptStatus.IN_PROGRESS,
                Instant.now().plusSeconds(3600),
                1
        );
        Integer initialVersion = attempt.getVersion();
        Instant initialDeadline = attempt.getDeadline();

        // Lần gọi 1: POST start
        MvcResult firstResult = mockMvc.perform(post("/api/v1/attempts/" + attempt.getId() + "/listening-playback/start"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RUNNING"))
                .andExpect(jsonPath("$.data.startedAt").isNotEmpty())
                .andExpect(jsonPath("$.data.activePartNumber").value(1))
                .andReturn();

        String firstStartedAt = objectMapper.readTree(firstResult.getResponse().getContentAsString())
                .get("data").get("startedAt").asText();

        // Lần gọi 2: POST start ngay sau đó -> IDEMPOTENT (giữ nguyên startedAt)
        MvcResult secondResult = mockMvc.perform(post("/api/v1/attempts/" + attempt.getId() + "/listening-playback/start"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RUNNING"))
                .andReturn();

        String secondStartedAt = objectMapper.readTree(secondResult.getResponse().getContentAsString())
                .get("data").get("startedAt").asText();

        assertThat(Instant.parse(secondStartedAt)).isEqualTo(Instant.parse(firstStartedAt));

        // Kiểm tra tính bất biến của TestAttempt (version, deadline, snapshot giữ nguyên)
        TestAttempt reloadedAttempt = testAttemptRepository.findById(attempt.getId()).orElseThrow();
        assertThat(reloadedAttempt.getVersion()).isEqualTo(initialVersion);
        assertThat(reloadedAttempt.getDeadline()).isEqualTo(initialDeadline);
    }

    @Test
    @DisplayName("POST /start trả về 409 khi attempt đã kết thúc hoặc đã nộp")
    void startPlayback_whenSubmitted_returns409() throws Exception {
        TestAttempt completedAttempt = createToeicAttempt(
                TestMode.MOCK_TEST,
                AttemptStatus.COMPLETED,
                Instant.now().plusSeconds(3600),
                1
        );

        mockMvc.perform(post("/api/v1/attempts/" + completedAttempt.getId() + "/listening-playback/start"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(409));
    }

    @Test
    @DisplayName("POST /start trả về 409 khi attempt đã hết hạn làm bài")
    void startPlayback_whenExpired_returns409() throws Exception {
        TestAttempt expiredAttempt = createToeicAttempt(
                TestMode.MOCK_TEST,
                AttemptStatus.IN_PROGRESS,
                Instant.now().minusSeconds(100),
                1
        );

        mockMvc.perform(post("/api/v1/attempts/" + expiredAttempt.getId() + "/listening-playback/start"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(409));
    }

    @Test
    @DisplayName("POST /start trả về 409 khi phần thi nghe đã bị khóa")
    void startPlayback_whenLocked_returns409() throws Exception {
        TestAttempt lockedAttempt = createToeicAttempt(
                TestMode.MOCK_TEST,
                AttemptStatus.IN_PROGRESS,
                Instant.now().plusSeconds(3600),
                1
        );
        lockedAttempt.setLockedSections(List.of(10));
        testAttemptRepository.save(lockedAttempt);

        mockMvc.perform(post("/api/v1/attempts/" + lockedAttempt.getId() + "/listening-playback/start"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(409));
    }
    @Test
    void unverifiedProfileIsUnavailableWithoutCreatingPlayback() throws Exception {
        var attempt = createToeicAttempt(TestMode.MOCK_TEST, AttemptStatus.IN_PROGRESS, Instant.now().plusSeconds(3600), 1);
        mediaProfile.when(com.multilingo.backend.modules.testing.service.support.ToeicListeningMediaProfile::loadDefault)
                .thenThrow(new IllegalStateException("Unverified profile"));
        assertUnavailableWithoutWrite(attempt);
    }

    @Test
    void blockedProfileCannotExposePreviouslyFrozenUnverifiedTracks() throws Exception {
        var attempt = createToeicAttempt(TestMode.MOCK_TEST, AttemptStatus.IN_PROGRESS, Instant.now().plusSeconds(3600), 1);
        mockMvc.perform(post("/api/v1/attempts/" + attempt.getId() + "/listening-playback/start"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("RUNNING"));
        var before = playbackRepository.findByAttemptId(attempt.getId()).orElseThrow();
        mediaProfile.when(com.multilingo.backend.modules.testing.service.support.ToeicListeningMediaProfile::loadDefault)
                .thenThrow(new IllegalStateException("Unverified profile"));
        for (var request : List.of(get("/api/v1/attempts/" + attempt.getId() + "/listening-playback"),
                post("/api/v1/attempts/" + attempt.getId() + "/listening-playback/start"))) {
            mockMvc.perform(request).andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.status").value("UNAVAILABLE"))
                    .andExpect(jsonPath("$.data.tracks").isEmpty());
        }
        assertThat(playbackService.getPlaybackSummary(attempt).getAvailable()).isFalse();
        assertThat(playbackRepository.findByAttemptId(attempt.getId()).orElseThrow().getStartedAt()).isEqualTo(before.getStartedAt());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(booleans = {false, true})
    void invalidSnapshotPartIdentityFailsClosed(boolean duplicateId) throws Exception {
        var attempt = createToeicAttempt(TestMode.MOCK_TEST, AttemptStatus.IN_PROGRESS, Instant.now().plusSeconds(3600), 1);
        var tree = objectMapper.valueToTree(attempt.getExamSnapshot());
        var fourth = (com.fasterxml.jackson.databind.node.ObjectNode) tree.get("sections").get(0).get("parts").get(3);
        if (duplicateId) fourth.put("id", 101); else fourth.remove("id");
        attempt.setExamSnapshot(objectMapper.convertValue(tree, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {}));
        attempt = testAttemptRepository.saveAndFlush(attempt);
        assertUnavailableWithoutWrite(attempt);
    }

    @Test
    @DisplayName("GET/POST playback trả UNAVAILABLE khi exam code của snapshot khác profile đã xác minh")
    void playbackForDifferentExamCodeFailsClosedWithoutWrite() throws Exception {
        TestAttempt attempt = createToeicAttempt(TestMode.MOCK_TEST, AttemptStatus.IN_PROGRESS,
                Instant.now().plusSeconds(3600), 1, "TOEIC-OTHER-EXAM",
                part -> "https://media.test/p" + part + ".mp3");
        assertUnavailableWithoutWrite(attempt);
    }

    @Test
    @DisplayName("GET/POST playback trả UNAVAILABLE khi media reference trong snapshot khác profile đã xác minh")
    void playbackForDifferentMediaReferenceFailsClosedWithoutWrite() throws Exception {
        TestAttempt attempt = createToeicAttempt(TestMode.MOCK_TEST, AttemptStatus.IN_PROGRESS,
                Instant.now().plusSeconds(3600), 1, TOEIC_CODE,
                part -> part == 3 ? "https://other.test/p3.mp3" : "https://media.test/p" + part + ".mp3");
        assertUnavailableWithoutWrite(attempt);
    }

    @Test
    @DisplayName("GET workspace trả summary playback cho TOEIC Mock, không tạo write và không có cho Practice")
    void workspaceExposesPlaybackSummaryWithoutWriteOnlyForToeicMock() throws Exception {
        TestAttempt attempt = createToeicAttempt(TestMode.MOCK_TEST, AttemptStatus.IN_PROGRESS,
                Instant.now().plusSeconds(3600), 1);

        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/workspace"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.listeningPlayback.status").value("NOT_STARTED"))
                .andExpect(jsonPath("$.data.listeningPlayback.available").value(true));
        assertThat(playbackRepository.findByAttemptId(attempt.getId())).isEmpty();

        mockMvc.perform(post("/api/v1/attempts/" + attempt.getId() + "/listening-playback/start"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RUNNING"));

        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/workspace"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.listeningPlayback.status").value("RUNNING"))
                .andExpect(jsonPath("$.data.listeningPlayback.available").value(true));

        TestAttempt practiceAttempt = createToeicAttempt(TestMode.PRACTICE, AttemptStatus.IN_PROGRESS, null, 1);
        MvcResult practiceResult = mockMvc.perform(get("/api/v1/attempts/" + practiceAttempt.getId() + "/workspace"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.listeningPlayback").doesNotExist())
                .andReturn();
        assertThat(practiceResult.getResponse().getContentAsString()).doesNotContain("listeningPlayback");
        assertThat(playbackRepository.findByAttemptId(practiceAttempt.getId())).isEmpty();
    }

    private void assertUnavailableWithoutWrite(TestAttempt attempt) throws Exception {
        for (var request : List.of(get("/api/v1/attempts/" + attempt.getId() + "/listening-playback"),
                post("/api/v1/attempts/" + attempt.getId() + "/listening-playback/start"))) {
            mockMvc.perform(request).andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.status").value("UNAVAILABLE"))
                    .andExpect(jsonPath("$.data.tracks").isEmpty());
        }
        assertThat(playbackService.getPlaybackSummary(attempt).getStatus()).isEqualTo("UNAVAILABLE");
        assertThat(playbackService.getPlaybackSummary(attempt).getAvailable()).isFalse();
        assertThat(playbackRepository.findByAttemptId(attempt.getId())).isEmpty();
        var after = testAttemptRepository.findById(attempt.getId()).orElseThrow();
        assertThat(after.getVersion()).isEqualTo(attempt.getVersion());
        assertThat(after.getExamSnapshot()).isEqualTo(attempt.getExamSnapshot());
        assertThat(after.getDeadline()).isEqualTo(attempt.getDeadline());
    }

}
