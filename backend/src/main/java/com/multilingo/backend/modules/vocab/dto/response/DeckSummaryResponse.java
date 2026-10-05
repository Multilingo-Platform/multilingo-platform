package com.multilingo.backend.modules.vocab.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeckSummaryResponse {
    private Integer id;
    private Integer userId;
    private String name;
    private String description;
    private String targetLanguage;
    private String sourceLanguage;
    private Boolean isPublic;
    private Integer clonesCount;
    private Long totalCards;
    private Long newCards;
    private Long learningCards;
    private Long masteredCards;
    private Long dueReviewCards;
    private Instant createdAt;
    private Instant updatedAt;
}
