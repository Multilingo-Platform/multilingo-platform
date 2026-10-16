package com.multilingo.backend.modules.vocab.dto.response;

import lombok.*;

import java.time.Instant;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VocabTestExamDto {

    private String testToken;

    private Integer deckId;

    private String deckName;

    private Integer timeLimitSeconds;

    private Integer totalQuestions;

    private Instant startedAt;

    private Instant expiresAt;

    private Instant serverTime;

    private List<VocabTestQuestionDto> questions;
}
