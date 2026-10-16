package com.multilingo.backend.modules.vocab.dto.response;

public interface UserVocabStatsProjection {
    Long getTotalCards();
    Long getMasteredCards();
    Long getLearningCards();
    Long getDueReviewCards();
}
