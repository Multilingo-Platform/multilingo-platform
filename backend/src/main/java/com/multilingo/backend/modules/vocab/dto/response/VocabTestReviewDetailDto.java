package com.multilingo.backend.modules.vocab.dto.response;

import lombok.*;

import java.time.Instant;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VocabTestReviewDetailDto {

    private String testToken;

    private Integer deckId;

    private String deckName;

    private String status;

    private Integer score;

    private Integer correctCount;

    private Integer totalQuestions;

    private Integer xpEarned;

    private Integer timeSpentSeconds;

    private Instant startedAt;

    private Instant submittedAt;

    private List<VocabTestReviewItemDto> reviewItems;
}
