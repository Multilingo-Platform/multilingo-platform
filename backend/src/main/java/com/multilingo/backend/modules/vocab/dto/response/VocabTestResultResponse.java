package com.multilingo.backend.modules.vocab.dto.response;

import lombok.*;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VocabTestResultResponse {

    private String testToken;

    private String status;

    private Integer score;

    private Integer correctCount;

    private Integer totalQuestions;

    private Integer xpEarned;

    private Integer timeSpentSeconds;

    private Integer currentStreak;

    private boolean streakIncremented;

    private Instant submittedAt;
}
