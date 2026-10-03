package com.multilingo.backend.modules.vocab.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FlashcardResponse {
    private Integer id;
    private Integer deckId;
    private Integer wordId;
    private String customWord;
    private String customMeaning;
    private String exampleSentence;
    private String customImageUrl;
    private String status;
    private Integer reviewCount;
    private BigDecimal easeFactor;
    private Integer intervalDays;
    private Instant nextReviewDate;
    private Instant createdAt;
    private Instant updatedAt;
}
