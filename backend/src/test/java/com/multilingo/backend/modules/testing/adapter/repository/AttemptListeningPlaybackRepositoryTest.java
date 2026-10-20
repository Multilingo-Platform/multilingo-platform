package com.multilingo.backend.modules.testing.adapter.repository;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.JpaTestConfig;
import com.multilingo.backend.modules.testing.adapter.entity.AttemptListeningPlayback;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DataJpaTest
@ActiveProfiles("test")
@Import(JpaTestConfig.class)
class AttemptListeningPlaybackRepositoryTest {

    @Autowired
    private AttemptListeningPlaybackRepository playbackRepository;

    @Autowired
    private TestAttemptRepository attemptRepository;

    @Autowired
    private TestEntityManager entityManager;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("Lưu và tìm kiếm AttemptListeningPlayback với đầy đủ trường, JSONB và audit fields")
    void saveAndFindPlaybackPersistsAllFields() throws Exception {
        Instant now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MILLIS);
        List<Map<String, Object>> playlist = List.of(
                Map.of("partNumber", 1, "durationMs", 173505, "audioUrl", "https://media.test/p1.mp3")
        );
        String playlistJson = objectMapper.writeValueAsString(playlist);

        AttemptListeningPlayback playback = AttemptListeningPlayback.builder()
                .attemptId(1001)
                .startedAt(now)
                .playlistFrozen(playlistJson)
                .totalDurationMs(2652239L)
                .build();

        AttemptListeningPlayback saved = playbackRepository.saveAndFlush(playback);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();

        entityManager.clear();

        Optional<AttemptListeningPlayback> foundOpt = playbackRepository.findByAttemptId(1001);
        assertThat(foundOpt).isPresent();
        AttemptListeningPlayback found = foundOpt.get();
        assertThat(found.getAttemptId()).isEqualTo(1001);
        assertThat(found.getStartedAt().truncatedTo(java.time.temporal.ChronoUnit.MILLIS)).isEqualTo(now);
        assertThat(found.getTotalDurationMs()).isEqualTo(2652239L);
        assertThat(found.getPlaylistFrozen()).isEqualTo(playlistJson);
    }

    @Test
    @DisplayName("Ràng buộc unique trên attemptId ném DataIntegrityViolationException khi trùng lặp")
    void uniqueConstraintAttemptIdThrowsException() {
        AttemptListeningPlayback p1 = AttemptListeningPlayback.builder()
                .attemptId(2001)
                .startedAt(Instant.now())
                .playlistFrozen("[]")
                .totalDurationMs(1000L)
                .build();
        playbackRepository.saveAndFlush(p1);

        AttemptListeningPlayback p2 = AttemptListeningPlayback.builder()
                .attemptId(2001) // Trùng attemptId
                .startedAt(Instant.now())
                .playlistFrozen("[]")
                .totalDurationMs(2000L)
                .build();

        assertThatThrownBy(() -> playbackRepository.saveAndFlush(p2))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("Ghi AttemptListeningPlayback không làm thay đổi TestAttempt.version, snapshot, answers hay deadline")
    void savingPlaybackDoesNotMutateAttemptVersionOrAnswersOrSnapshotOrDeadline() throws Exception {
        Instant startTime = Instant.now();
        Instant deadline = startTime.plusSeconds(7200);
        Map<String, Object> initialSnapshot = Map.of(
                "title", "TOEIC ETS 2024 Test 1",
                "code", "TOEIC-ETS-2024-T1-V2",
                "type", "TOEIC"
        );

        TestAttempt attempt = TestAttempt.builder()
                .userId(99)
                .examId(1)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.MOCK_TEST)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(startTime)
                .deadline(deadline)
                .timeSpentSeconds(120)
                .version(1)
                .examSnapshot(initialSnapshot)
                .sectionScores(Map.of("LISTENING", 0))
                .build();

        TestAttempt savedAttempt = attemptRepository.saveAndFlush(attempt);
        Integer attemptId = savedAttempt.getId();
        Integer initialVersion = savedAttempt.getVersion();
        Instant initialUpdatedAt = savedAttempt.getUpdatedAt();

        entityManager.clear();

        // Bây giờ ghi playback độc lập cho attempt này
        AttemptListeningPlayback playback = AttemptListeningPlayback.builder()
                .attemptId(attemptId)
                .startedAt(startTime)
                .playlistFrozen(objectMapper.writeValueAsString(List.of(Map.of("part", 1))))
                .totalDurationMs(2652239L)
                .build();
        playbackRepository.saveAndFlush(playback);

        entityManager.clear();

        // Tải lại TestAttempt và kiểm chứng không hề bị ảnh hưởng
        TestAttempt reloadedAttempt = attemptRepository.findById(attemptId).orElseThrow();
        assertThat(reloadedAttempt.getVersion()).isEqualTo(initialVersion);
        assertThat(reloadedAttempt.getUpdatedAt().truncatedTo(java.time.temporal.ChronoUnit.MILLIS))
                .isEqualTo(initialUpdatedAt.truncatedTo(java.time.temporal.ChronoUnit.MILLIS));
        assertThat(reloadedAttempt.getDeadline().truncatedTo(java.time.temporal.ChronoUnit.MILLIS))
                .isEqualTo(deadline.truncatedTo(java.time.temporal.ChronoUnit.MILLIS));
        assertThat(reloadedAttempt.getExamSnapshot()).isEqualTo(initialSnapshot);
        assertThat(reloadedAttempt.getTimeSpentSeconds()).isEqualTo(120);
        assertThat(reloadedAttempt.getSectionScores()).containsEntry("LISTENING", 0);
    }
}
