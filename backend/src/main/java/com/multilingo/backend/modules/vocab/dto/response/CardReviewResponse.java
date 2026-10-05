package com.multilingo.backend.modules.vocab.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CardReviewResponse {
    private Integer cardId;
    private String status;
    private Integer reviewCount;
    private Integer intervalDays;
    private BigDecimal easeFactor;
    private Instant nextReviewDate;
}
