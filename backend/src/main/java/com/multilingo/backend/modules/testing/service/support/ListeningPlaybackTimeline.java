package com.multilingo.backend.modules.testing.service.support;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * Pure server-authoritative timeline model for TOEIC listening playback.
 * Determines active track, position, elapsed time and status monotonically
 * based solely on server Clock and frozen playlist metadata. Never accepts
 * client-supplied position or duration.
 */
public final class ListeningPlaybackTimeline {

    public enum PlaybackStatus {
        NOT_STARTED,
        RUNNING,
        FINISHED,
        UNAVAILABLE
    }

    public record PlaybackTrack(
            @com.fasterxml.jackson.annotation.JsonProperty("partNumber") Integer partNumber,
            @com.fasterxml.jackson.annotation.JsonProperty("partId") String partId,
            @com.fasterxml.jackson.annotation.JsonProperty("audioUrl") String audioUrl,
            @com.fasterxml.jackson.annotation.JsonProperty("durationMs") long durationMs,
            @com.fasterxml.jackson.annotation.JsonProperty("startOffsetMs") long startOffsetMs,
            @com.fasterxml.jackson.annotation.JsonProperty("etag") String etag,
            @com.fasterxml.jackson.annotation.JsonProperty("contentLength") Long contentLength
    ) {
        public PlaybackTrack {
            Objects.requireNonNull(partNumber, "partNumber must not be null");
            if (durationMs <= 0) {
                throw new IllegalArgumentException("durationMs must be positive: " + durationMs);
            }
            if (startOffsetMs < 0) {
                throw new IllegalArgumentException("startOffsetMs cannot be negative: " + startOffsetMs);
            }
        }
    }

    public record TimelineState(
            PlaybackStatus status,
            Instant startedAt,
            long elapsedMs,
            long remainingMs,
            long totalDurationMs,
            Integer activePartNumber,
            String activePartId,
            String currentTrackUrl,
            long positionMs,
            List<PlaybackTrack> tracks
    ) {}

    private final List<PlaybackTrack> tracks;
    private final long totalDurationMs;
    private final Instant startedAt;

    public ListeningPlaybackTimeline(List<PlaybackTrack> tracks, Instant startedAt) {
        if (tracks == null || tracks.isEmpty()) {
            this.tracks = List.of();
            this.totalDurationMs = 0;
        } else {
            this.tracks = tracks.stream()
                    .sorted(Comparator.comparingLong(PlaybackTrack::startOffsetMs))
                    .toList();
            this.totalDurationMs = this.tracks.stream().mapToLong(PlaybackTrack::durationMs).sum();
        }
        this.startedAt = startedAt;
    }

    public List<PlaybackTrack> getTracks() {
        return tracks;
    }

    public long getTotalDurationMs() {
        return totalDurationMs;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public TimelineState computeState(Clock clock) {
        Objects.requireNonNull(clock, "clock must not be null");
        return computeState(clock.instant());
    }

    public TimelineState computeState(Instant currentTime) {
        Objects.requireNonNull(currentTime, "currentTime must not be null");

        if (tracks.isEmpty()) {
            return new TimelineState(
                    PlaybackStatus.UNAVAILABLE,
                    startedAt,
                    0L,
                    0L,
                    0L,
                    null,
                    null,
                    null,
                    0L,
                    List.of()
            );
        }

        if (startedAt == null) {
            PlaybackTrack first = tracks.getFirst();
            return new TimelineState(
                    PlaybackStatus.NOT_STARTED,
                    null,
                    0L,
                    totalDurationMs,
                    totalDurationMs,
                    first.partNumber(),
                    first.partId(),
                    first.audioUrl(),
                    0L,
                    tracks
            );
        }

        long rawElapsed = Duration.between(startedAt, currentTime).toMillis();
        long elapsedMs = Math.max(0L, rawElapsed);

        if (elapsedMs >= totalDurationMs) {
            return new TimelineState(
                    PlaybackStatus.FINISHED,
                    startedAt,
                    totalDurationMs,
                    0L,
                    totalDurationMs,
                    null,
                    null,
                    null,
                    0L,
                    tracks
            );
        }

        long remainingMs = totalDurationMs - elapsedMs;

        // Find active track based on elapsed boundary
        PlaybackTrack activeTrack = null;
        long positionMs = 0L;

        for (PlaybackTrack track : tracks) {
            long trackEnd = track.startOffsetMs() + track.durationMs();
            if (elapsedMs >= track.startOffsetMs() && elapsedMs < trackEnd) {
                activeTrack = track;
                positionMs = elapsedMs - track.startOffsetMs();
                break;
            }
        }

        if (activeTrack == null) {
            activeTrack = tracks.getFirst();
            positionMs = 0L;
        }

        return new TimelineState(
                PlaybackStatus.RUNNING,
                startedAt,
                elapsedMs,
                remainingMs,
                totalDurationMs,
                activeTrack.partNumber(),
                activeTrack.partId(),
                activeTrack.audioUrl(),
                positionMs,
                tracks
        );
    }

    public static TimelineState compute(List<PlaybackTrack> tracks, Instant startedAt, Instant currentTime) {
        return new ListeningPlaybackTimeline(tracks, startedAt).computeState(currentTime);
    }

    public static TimelineState compute(List<PlaybackTrack> tracks, Instant startedAt, Clock clock) {
        return new ListeningPlaybackTimeline(tracks, startedAt).computeState(clock);
    }
}
