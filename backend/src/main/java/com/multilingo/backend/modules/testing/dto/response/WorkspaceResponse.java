package com.multilingo.backend.modules.testing.dto.response;

import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Safe workspace response — returned to client after creating or reading an attempt.
 * SECURITY CONSTRAINT: This DTO must NEVER contain correct_answer, explanation, or ai_feedback.
 * Those fields are only accessible via the result endpoint after submission.
 */
@Data
@Builder
public class WorkspaceResponse {
    private Integer attemptId;
    private AttemptStatus status;
    private TestScope testScope;
    private TestMode testMode;
    private Instant startTime;
    /** null for PRACTICE mode */
    private Instant deadline;
    /** Current server timestamp in UTC for client timer drift compensation */
    private Instant serverTime;
    /** Grace period in seconds for submission after deadline (default 15) */
    private Integer gracePeriodSeconds;
    /** Authoritative persisted attempt version. */
    private Integer version;
    /** Persisted learner answers in the same shape accepted by autosave. */
    private List<AutosaveAnswersRequest.PartAnswerDto> savedAnswers;
    /**
     * Server-side snapshot of exam at attempt creation time.
     * Contains questions and options, but NOT correct_answer or explanation.
     */
    private Map<String, Object> examSnapshot;
    private AttemptLanguageContextResponse languageContext;
    private List<Integer> lockedSections;

    /**
     * Optional listening playback summary for TOEIC Mock tests.
     * Exposes only safe status/endpoint metadata, never transcripts or clues.
     * Omitted entirely for Practice/IELTS attempts so clients cannot observe a null field.
     */
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    private ListeningPlaybackSummary listeningPlayback;

    @Data
    @Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public static class ListeningPlaybackSummary {
        private String status;
        private Boolean available;
    }
}
