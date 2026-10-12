package com.multilingo.backend.modules.vocab.dto.response;

import lombok.*;

import java.time.Instant;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PracticeSessionSnapshotDto {
    private String sessionId;
    private Integer userId;
    private Integer deckId;
    private String deckName;
    private String filterStatus;
    private Integer totalQuestions;
    private Instant createdAt;
    private Instant expiresAt;
    private List<PracticeQuestionSnapshotDto> questions;
}
