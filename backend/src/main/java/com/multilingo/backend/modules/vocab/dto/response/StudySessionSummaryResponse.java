package com.multilingo.backend.modules.vocab.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudySessionSummaryResponse {
    private Integer earnedXp;
    private Integer currentStreak;
    private Integer totalMasteredCards;
    private Integer cardsReviewed;
}
