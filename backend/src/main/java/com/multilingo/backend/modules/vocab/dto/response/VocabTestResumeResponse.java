package com.multilingo.backend.modules.vocab.dto.response;

import com.multilingo.backend.modules.vocab.dto.request.VocabTestAnswerItemDto;
import lombok.*;

import java.time.Instant;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VocabTestResumeResponse {

    private String testToken;

    private Integer deckId;

    private String deckName;

    private String status;

    private Integer progressVersion;

    private Integer timeLimitSeconds;

    private Integer totalQuestions;

    private Instant startedAt;

    private Instant expiresAt;

    private Instant serverTime;

    private boolean deadlinePassed;

    private List<VocabTestQuestionDto> questions;

    private List<VocabTestAnswerItemDto> savedAnswers;

    private VocabTestResultResponse resultSummary;
}
