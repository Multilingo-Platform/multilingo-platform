package com.multilingo.backend.modules.testing.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.adapter.entity.AttemptListeningPlayback;
import com.multilingo.backend.modules.testing.adapter.repository.AttemptListeningPlaybackRepository;
import com.multilingo.backend.modules.testing.dto.response.ListeningPlaybackResponse;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.service.support.ToeicListeningMediaProfile;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * TW-04 P1 regression on a real PostgreSQL instance: simultaneous "start playback" calls for the
 * same TOEIC Mock attempt must serialize on the attempt row lock. Every caller must observe the
 * same frozen playlist and identical startedAt, exactly one playback row must exist, and the
 * TestAttempt row (version, status, snapshot, deadline, answers) must remain untouched.
 *
 * Enabled only for an explicitly isolated, disposable database:
 * TW04_POSTGRES_TEST_URL=jdbc:postgresql://127.0.0.1:&lt;port&gt;/tw04_playback_test
 */
@SpringBootTest
@ActiveProfiles("test")
@EnabledIfEnvironmentVariable(named = "TW04_POSTGRES_TEST_URL",
        matches = "jdbc:postgresql://(127\\.0\\.0\\.1|localhost):[0-9]+/tw04_playback_test")
class ListeningPlaybackStartConcurrencyPostgresIT {

    @DynamicPropertySource
    static void configureDisposablePostgres(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> System.getenv("TW04_POSTGRES_TEST_URL"));
        registry.add("spring.datasource.username", () -> System.getenv().getOrDefault("TW04_POSTGRES_TEST_USER", "tw04"));
        registry.add("spring.datasource.password", () -> System.getenv().getOrDefault("TW04_POSTGRES_TEST_PASSWORD", ""));
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        registry.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
    }

    @Autowired
    private ListeningPlaybackService listeningPlaybackService;

    @Autowired
    private TestAttemptRepository testAttemptRepository;

    @Autowired
    private AttemptListeningPlaybackRepository playbackRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private static final Integer TEST_USER_ID = 1; // FixtureIdentityAdapter

    @BeforeEach
    void cleanDisposableDatabase() {
        playbackRepository.deleteAll();
        testAttemptRepository.deleteAll();
    }

    @AfterEach
    void removeSeededRows() {
        playbackRepository.deleteAll();
        testAttemptRepository.deleteAll();
    }

    @Test
    void concurrentStartsSerializeOnAttemptLockAndShareOneFrozenPlaylist() throws Exception {
        TestAttempt seeded = seedInProgressToeicAttempt();
        Integer attemptId = seeded.getId();
        Instant initialDeadline = seeded.getDeadline();
        Map<String, Object> initialSnapshot = seeded.getExamSnapshot();
        Integer initialVersion = seeded.getVersion();

        ToeicListeningMediaProfile fixture = verifiedFixture();
        int workers = 4;
        ExecutorService executor = Executors.newFixedThreadPool(workers);
        CountDownLatch ready = new CountDownLatch(workers);
        CountDownLatch release = new CountDownLatch(1);
        CountDownLatch finished = new CountDownLatch(workers);
        List<ListeningPlaybackResponse> responses = Collections.synchronizedList(new ArrayList<>());
        List<Throwable> failures = Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < workers; i++) {
            executor.submit(() -> {
                // Mockito static mocks are thread-local: each worker installs its own
                // verified-profile mock before calling the service.
                try (var mockedProfile = Mockito.mockStatic(ToeicListeningMediaProfile.class, invocation ->
                        invocation.getMethod().getName().equals("loadDefault") ? fixture : invocation.callRealMethod())) {
                    mockedProfile.when(ToeicListeningMediaProfile::loadDefault).thenReturn(fixture);
                    ready.countDown();
                    release.await(10, TimeUnit.SECONDS);
                    responses.add(listeningPlaybackService.startPlayback(attemptId));
                } catch (Throwable t) {
                    failures.add(t);
                } finally {
                    finished.countDown();
                }
            });
        }

        assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
        release.countDown();
        assertThat(finished.await(30, TimeUnit.SECONDS)).isTrue();
        executor.shutdown();

        assertThat(failures).isEmpty();
        assertThat(responses).hasSize(workers);

        Set<Instant> startedAtValues = responses.stream()
                .map(ListeningPlaybackResponse::getStartedAt)
                .collect(Collectors.toSet());
        assertThat(startedAtValues).hasSize(1);
        Instant startedAt = startedAtValues.iterator().next();
        assertThat(startedAt).isNotNull();

        assertThat(responses).allSatisfy(response -> {
            assertThat(response.getStatus()).isEqualTo(ListeningPlaybackResponse.Status.RUNNING);
            assertThat(response.getTotalDurationMs()).isEqualTo(fixture.getTotalDurationMs());
            assertThat(response.getTracks()).hasSize(4);
            assertThat(response.getTracks()).extracting(ListeningPlaybackResponse.TrackDto::getAudioUrl)
                    .containsExactly("https://media.test/p1.mp3", "https://media.test/p2.mp3",
                            "https://media.test/p3.mp3", "https://media.test/p4.mp3");
        });

        // Exactly one frozen playback row, shared by every caller
        List<AttemptListeningPlayback> stored = playbackRepository.findAll().stream()
                .filter(row -> attemptId.equals(row.getAttemptId()))
                .toList();
        assertThat(stored).hasSize(1);
        AttemptListeningPlayback playback = stored.get(0);
        assertThat(playback.getStartedAt()).isEqualTo(startedAt);
        assertThat(playback.getTotalDurationMs()).isEqualTo(fixture.getTotalDurationMs());

        List<Map<String, Object>> frozen = objectMapper.readValue(
                playback.getPlaylistFrozen(), new TypeReference<>() {});
        assertThat(frozen).hasSize(4);
        for (int part = 1; part <= 4; part++) {
            Map<String, Object> frozenTrack = frozen.get(part - 1);
            assertThat(frozenTrack)
                    .containsEntry("partNumber", part)
                    .containsEntry("partId", String.valueOf(100 + part))
                    .containsEntry("audioUrl", "https://media.test/p" + part + ".mp3");
            // JSON round-trip stores numbers as Integer; compare numerically against the fixture
            assertThat(((Number) frozenTrack.get("durationMs")).longValue())
                    .isEqualTo(fixture.getTrack(part).durationMs());
            assertThat(((Number) frozenTrack.get("startOffsetMs")).longValue())
                    .isEqualTo(fixture.getTrack(part).startOffsetMs());
        }

        // Attempt invariants: playback must never mutate the attempt row
        TestAttempt reloaded = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(reloaded.getVersion()).isEqualTo(initialVersion);
        assertThat(reloaded.getStatus()).isEqualTo(AttemptStatus.IN_PROGRESS);
        assertThat(reloaded.getDeadline()).isEqualTo(initialDeadline);
        assertThat(reloaded.getExamSnapshot()).isEqualTo(initialSnapshot);
        assertThat(reloaded.getTimeSpentSeconds()).isEqualTo(60);
        assertThat(reloaded.getEndTime()).isNull();
    }

    private TestAttempt seedInProgressToeicAttempt() {
        TestAttempt attempt = TestAttempt.builder()
                .userId(TEST_USER_ID)
                .examId(999)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.MOCK_TEST)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(Instant.now().minusSeconds(60).truncatedTo(ChronoUnit.MILLIS))
                .deadline(Instant.now().plusSeconds(3600).truncatedTo(ChronoUnit.MILLIS))
                .version(1)
                .timeSpentSeconds(60)
                .examSnapshot(toeicListeningSnapshot())
                .lockedSections(new ArrayList<>())
                .build();
        return testAttemptRepository.saveAndFlush(attempt);
    }

    private static Map<String, Object> toeicListeningSnapshot() {
        List<Map<String, Object>> parts = new ArrayList<>();
        for (int part = 1; part <= 4; part++) {
            Map<String, Object> partMap = new LinkedHashMap<>();
            partMap.put("id", 100 + part);
            partMap.put("partNumber", part);
            partMap.put("sharedAudio", Map.of("url", "https://media.test/p" + part + ".mp3"));
            parts.add(partMap);
        }
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("code", "TOEIC-ETS-2024-T1-V2");
        snapshot.put("type", "TOEIC_LR");
        snapshot.put("title", "ETS TOEIC 2024 Test 1");
        snapshot.put("sections", List.of(
                Map.of("id", 10, "skillType", "LISTENING", "parts", parts),
                Map.of("id", 20, "skillType", "READING", "parts", List.of(
                        Map.of("id", 105, "partNumber", 5, "title", "Incomplete Sentences")))));
        return snapshot;
    }

    private static ToeicListeningMediaProfile verifiedFixture() throws Exception {
        try (var input = ListeningPlaybackStartConcurrencyPostgresIT.class
                .getResourceAsStream("/testing/toeic-listening-verified-fixture.json")) {
            return new ObjectMapper().readValue(input, ToeicListeningMediaProfile.class);
        }
    }
}
