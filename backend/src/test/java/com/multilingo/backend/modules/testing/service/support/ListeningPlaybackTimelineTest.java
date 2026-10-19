package com.multilingo.backend.modules.testing.service.support;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ListeningPlaybackTimelineTest {

    private List<ListeningPlaybackTimeline.PlaybackTrack> tracks;
    private long totalDurationMs;
    private Instant startTime;

    @BeforeEach
    void setUp() {
        // Sample 4 tracks mirroring the TOEIC listening profile
        tracks = List.of(
                new ListeningPlaybackTimeline.PlaybackTrack(1, "p1", "https://audio/p1.mp3", 173505L, 0L, "etag1", 2836938L),
                new ListeningPlaybackTimeline.PlaybackTrack(2, "p2", "https://audio/p2.mp3", 536686L, 173505L, "etag2", 8634489L),
                new ListeningPlaybackTimeline.PlaybackTrack(3, "p3", "https://audio/p3.mp3", 1105842L, 710191L, "etag3", 17720085L),
                new ListeningPlaybackTimeline.PlaybackTrack(4, "p4", "https://audio/p4.mp3", 836206L, 1816033L, "etag4", 13415811L)
        );
        totalDurationMs = 2652239L;
        startTime = Instant.parse("2026-10-17T09:00:00Z");
    }

    @Test
    @DisplayName("compute trả về UNAVAILABLE khi danh sách tracks rỗng hoặc null")
    void computeEmptyTracksReturnsUnavailable() {
        ListeningPlaybackTimeline.TimelineState stateNull = ListeningPlaybackTimeline.compute(null, startTime, startTime);
        assertThat(stateNull.status()).isEqualTo(ListeningPlaybackTimeline.PlaybackStatus.UNAVAILABLE);
        assertThat(stateNull.tracks()).isEmpty();

        ListeningPlaybackTimeline.TimelineState stateEmpty = ListeningPlaybackTimeline.compute(List.of(), startTime, startTime);
        assertThat(stateEmpty.status()).isEqualTo(ListeningPlaybackTimeline.PlaybackStatus.UNAVAILABLE);
    }

    @Test
    @DisplayName("compute trước khi start trả về NOT_STARTED với Part 1 và vị trí 0")
    void computeBeforeStartedReturnsNotStarted() {
        ListeningPlaybackTimeline.TimelineState state = ListeningPlaybackTimeline.compute(tracks, null, startTime);

        assertThat(state.status()).isEqualTo(ListeningPlaybackTimeline.PlaybackStatus.NOT_STARTED);
        assertThat(state.elapsedMs()).isZero();
        assertThat(state.remainingMs()).isEqualTo(totalDurationMs);
        assertThat(state.activePartNumber()).isEqualTo(1);
        assertThat(state.activePartId()).isEqualTo("p1");
        assertThat(state.currentTrackUrl()).isEqualTo("https://audio/p1.mp3");
        assertThat(state.positionMs()).isZero();
        assertThat(state.totalDurationMs()).isEqualTo(totalDurationMs);
    }

    @Test
    @DisplayName("compute tại đúng thời điểm start trả về RUNNING, Part 1, position 0")
    void computeAtStartInstantReturnsRunningTrack1PositionZero() {
        ListeningPlaybackTimeline.TimelineState state = ListeningPlaybackTimeline.compute(tracks, startTime, startTime);

        assertThat(state.status()).isEqualTo(ListeningPlaybackTimeline.PlaybackStatus.RUNNING);
        assertThat(state.elapsedMs()).isZero();
        assertThat(state.remainingMs()).isEqualTo(totalDurationMs);
        assertThat(state.activePartNumber()).isEqualTo(1);
        assertThat(state.activePartId()).isEqualTo("p1");
        assertThat(state.currentTrackUrl()).isEqualTo("https://audio/p1.mp3");
        assertThat(state.positionMs()).isZero();
    }

    @Test
    @DisplayName("compute trong Part 1 trả về RUNNING và position đúng")
    void computeDuringTrack1ReturnsRunningCorrectPosition() {
        Instant current = startTime.plusMillis(60000L); // 1 phút
        ListeningPlaybackTimeline.TimelineState state = ListeningPlaybackTimeline.compute(tracks, startTime, current);

        assertThat(state.status()).isEqualTo(ListeningPlaybackTimeline.PlaybackStatus.RUNNING);
        assertThat(state.elapsedMs()).isEqualTo(60000L);
        assertThat(state.remainingMs()).isEqualTo(totalDurationMs - 60000L);
        assertThat(state.activePartNumber()).isEqualTo(1);
        assertThat(state.activePartId()).isEqualTo("p1");
        assertThat(state.currentTrackUrl()).isEqualTo("https://audio/p1.mp3");
        assertThat(state.positionMs()).isEqualTo(60000L);
    }

    @Test
    @DisplayName("compute ngay trước khi Part 1 kết thúc (173504ms) vẫn ở Part 1")
    void computeJustBeforeTrack1Ends() {
        Instant current = startTime.plusMillis(173504L);
        ListeningPlaybackTimeline.TimelineState state = ListeningPlaybackTimeline.compute(tracks, startTime, current);

        assertThat(state.status()).isEqualTo(ListeningPlaybackTimeline.PlaybackStatus.RUNNING);
        assertThat(state.activePartNumber()).isEqualTo(1);
        assertThat(state.positionMs()).isEqualTo(173504L);
    }

    @Test
    @DisplayName("compute tại đúng ranh giới Part 2 (173505ms) chuyển sang Part 2 với position 0")
    void computeAtExactTrack2BoundarySwitchesToTrack2() {
        Instant current = startTime.plusMillis(173505L);
        ListeningPlaybackTimeline.TimelineState state = ListeningPlaybackTimeline.compute(tracks, startTime, current);

        assertThat(state.status()).isEqualTo(ListeningPlaybackTimeline.PlaybackStatus.RUNNING);
        assertThat(state.elapsedMs()).isEqualTo(173505L);
        assertThat(state.activePartNumber()).isEqualTo(2);
        assertThat(state.activePartId()).isEqualTo("p2");
        assertThat(state.currentTrackUrl()).isEqualTo("https://audio/p2.mp3");
        assertThat(state.positionMs()).isZero();
    }

    @Test
    @DisplayName("compute trong Part 2 trả về position trừ đi startOffset của Part 2")
    void computeDuringTrack2() {
        Instant current = startTime.plusMillis(200000L); // 200,000ms
        ListeningPlaybackTimeline.TimelineState state = ListeningPlaybackTimeline.compute(tracks, startTime, current);

        assertThat(state.status()).isEqualTo(ListeningPlaybackTimeline.PlaybackStatus.RUNNING);
        assertThat(state.elapsedMs()).isEqualTo(200000L);
        assertThat(state.activePartNumber()).isEqualTo(2);
        assertThat(state.positionMs()).isEqualTo(200000L - 173505L); // 26495ms
    }

    @Test
    @DisplayName("compute tại đúng ranh giới Part 3 (710191ms) chuyển sang Part 3")
    void computeAtExactTrack3BoundarySwitchesToTrack3() {
        Instant current = startTime.plusMillis(710191L);
        ListeningPlaybackTimeline.TimelineState state = ListeningPlaybackTimeline.compute(tracks, startTime, current);

        assertThat(state.status()).isEqualTo(ListeningPlaybackTimeline.PlaybackStatus.RUNNING);
        assertThat(state.activePartNumber()).isEqualTo(3);
        assertThat(state.activePartId()).isEqualTo("p3");
        assertThat(state.currentTrackUrl()).isEqualTo("https://audio/p3.mp3");
        assertThat(state.positionMs()).isZero();
    }

    @Test
    @DisplayName("compute tại đúng ranh giới Part 4 (1816033ms) chuyển sang Part 4")
    void computeAtExactTrack4BoundarySwitchesToTrack4() {
        Instant current = startTime.plusMillis(1816033L);
        ListeningPlaybackTimeline.TimelineState state = ListeningPlaybackTimeline.compute(tracks, startTime, current);

        assertThat(state.status()).isEqualTo(ListeningPlaybackTimeline.PlaybackStatus.RUNNING);
        assertThat(state.activePartNumber()).isEqualTo(4);
        assertThat(state.activePartId()).isEqualTo("p4");
        assertThat(state.currentTrackUrl()).isEqualTo("https://audio/p4.mp3");
        assertThat(state.positionMs()).isZero();
    }

    @Test
    @DisplayName("compute ngay trước khi toàn bộ playlist kết thúc (2652238ms) vẫn ở Part 4")
    void computeJustBeforeTotalEnd() {
        Instant current = startTime.plusMillis(2652238L);
        ListeningPlaybackTimeline.TimelineState state = ListeningPlaybackTimeline.compute(tracks, startTime, current);

        assertThat(state.status()).isEqualTo(ListeningPlaybackTimeline.PlaybackStatus.RUNNING);
        assertThat(state.activePartNumber()).isEqualTo(4);
        assertThat(state.positionMs()).isEqualTo(2652238L - 1816033L);
        assertThat(state.remainingMs()).isEqualTo(1L);
    }

    @Test
    @DisplayName("compute tại đúng thời điểm kết thúc playlist (2652239ms) trả về FINISHED")
    void computeAtExactTotalEndReturnsFinished() {
        Instant current = startTime.plusMillis(2652239L);
        ListeningPlaybackTimeline.TimelineState state = ListeningPlaybackTimeline.compute(tracks, startTime, current);

        assertThat(state.status()).isEqualTo(ListeningPlaybackTimeline.PlaybackStatus.FINISHED);
        assertThat(state.elapsedMs()).isEqualTo(totalDurationMs);
        assertThat(state.remainingMs()).isZero();
        assertThat(state.activePartNumber()).isNull();
        assertThat(state.activePartId()).isNull();
        assertThat(state.currentTrackUrl()).isNull();
        assertThat(state.positionMs()).isZero();
    }

    @Test
    @DisplayName("compute sau khi playlist đã kết thúc lâu (vượt quá duration) vẫn trả về FINISHED và giới hạn elapsed")
    void computeBeyondTotalEndClamped() {
        Instant current = startTime.plus(Duration.ofHours(2));
        ListeningPlaybackTimeline.TimelineState state = ListeningPlaybackTimeline.compute(tracks, startTime, current);

        assertThat(state.status()).isEqualTo(ListeningPlaybackTimeline.PlaybackStatus.FINISHED);
        assertThat(state.elapsedMs()).isEqualTo(totalDurationMs);
        assertThat(state.remainingMs()).isZero();
    }

    @Test
    @DisplayName("compute xử lý an toàn khi clock skew làm currentTime nhỏ hơn startedAt")
    void computeClockSkewBeforeStartClampedToZero() {
        Instant past = startTime.minusSeconds(10);
        ListeningPlaybackTimeline.TimelineState state = ListeningPlaybackTimeline.compute(tracks, startTime, past);

        assertThat(state.status()).isEqualTo(ListeningPlaybackTimeline.PlaybackStatus.RUNNING);
        assertThat(state.elapsedMs()).isZero();
        assertThat(state.positionMs()).isZero();
        assertThat(state.activePartNumber()).isEqualTo(1);
    }

    @Test
    @DisplayName("compute với injected Clock trả kết quả chính xác")
    void computeWithInjectedClock() {
        Instant current = startTime.plusMillis(100000L);
        Clock clock = Clock.fixed(current, ZoneId.of("UTC"));

        ListeningPlaybackTimeline timeline = new ListeningPlaybackTimeline(tracks, startTime);
        ListeningPlaybackTimeline.TimelineState state = timeline.computeState(clock);

        assertThat(state.status()).isEqualTo(ListeningPlaybackTimeline.PlaybackStatus.RUNNING);
        assertThat(state.elapsedMs()).isEqualTo(100000L);
        assertThat(state.activePartNumber()).isEqualTo(1);
        assertThat(state.positionMs()).isEqualTo(100000L);
    }

    @Test
    @DisplayName("compute bất biến qua các múi giờ khác nhau vì dựa trên UTC Instant")
    void computeTimezoneImmunity() {
        Instant current = startTime.plusMillis(250000L);
        Clock utcClock = Clock.fixed(current, ZoneId.of("UTC"));
        Clock hcmClock = Clock.fixed(current, ZoneId.of("Asia/Ho_Chi_Minh"));
        Clock nyClock = Clock.fixed(current, ZoneId.of("America/New_York"));

        ListeningPlaybackTimeline timeline = new ListeningPlaybackTimeline(tracks, startTime);
        ListeningPlaybackTimeline.TimelineState stateUtc = timeline.computeState(utcClock);
        ListeningPlaybackTimeline.TimelineState stateHcm = timeline.computeState(hcmClock);
        ListeningPlaybackTimeline.TimelineState stateNy = timeline.computeState(nyClock);

        assertThat(stateUtc.elapsedMs()).isEqualTo(stateHcm.elapsedMs()).isEqualTo(stateNy.elapsedMs());
        assertThat(stateUtc.positionMs()).isEqualTo(stateHcm.positionMs()).isEqualTo(stateNy.positionMs());
        assertThat(stateUtc.activePartNumber()).isEqualTo(stateHcm.activePartNumber()).isEqualTo(stateNy.activePartNumber());
    }

    @Test
    @DisplayName("Mất kết nối 10 phút rồi khôi phục: timeline nhảy tới vị trí server hiện tại, không phát bù Part 1")
    void reconnectAfterTenMinutesJumpsToCurrentServerPosition() {
        // Sau 10 phút (600,000ms), Part 1 (173,505ms) đã hoàn toàn trôi qua
        Instant reconnectTime = startTime.plusMillis(600000L);

        ListeningPlaybackTimeline timeline = new ListeningPlaybackTimeline(tracks, startTime);
        ListeningPlaybackTimeline.TimelineState state = timeline.computeState(reconnectTime);

        assertThat(state.status()).isEqualTo(ListeningPlaybackTimeline.PlaybackStatus.RUNNING);
        assertThat(state.elapsedMs()).isEqualTo(600000L);
        assertThat(state.activePartNumber()).isEqualTo(2); // Đang ở Part 2
        assertThat(state.positionMs()).isEqualTo(600000L - 173505L); // 426,495ms trong Part 2
        assertThat(state.currentTrackUrl()).isEqualTo("https://audio/p2.mp3");
    }
}
