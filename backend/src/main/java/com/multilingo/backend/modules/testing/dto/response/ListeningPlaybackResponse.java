package com.multilingo.backend.modules.testing.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Server-authoritative response for TOEIC listening playback.
 * Never includes transcripts, answer clues, or correct answers.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ListeningPlaybackResponse {

    public enum Status {
        NOT_STARTED,
        RUNNING,
        FINISHED,
        LOCKED,
        CLOSED,
        UNAVAILABLE
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TrackDto {
        private String partId;
        private Integer partNumber;
        private String audioUrl;
        private Long durationMs;
        private Long startOffsetMs;
    }

    private Integer attemptId;
    private Status status;
    private Instant serverTime;
    private Instant startedAt;
    private String activePartId;
    private Integer activePartNumber;
    private Long positionMs;
    private Long elapsedMs;
    private Long remainingMs;
    private Long totalDurationMs;
    private List<TrackDto> tracks;
}
