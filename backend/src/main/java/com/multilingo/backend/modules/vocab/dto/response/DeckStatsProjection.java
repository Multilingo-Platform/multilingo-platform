package com.multilingo.backend.modules.vocab.dto.response;

public interface DeckStatsProjection {
    Integer getDeckId();
    Long getTotalCards();
    Long getNewCards();
    Long getLearningCards();
    Long getMasteredCards();
    Long getDueReviewCards();
}
