package com.multilingo.backend.modules.vocab.dto.response;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PracticeQuestionSnapshotDto {
    private Integer questionId;
    private Integer cardId;
    private String targetWord;
    private String phonetic;
    private String pos;
    private String sentence;
    private List<PracticeOptionDto> options;
    private String correctOptionId;
    private String explanation;
}
