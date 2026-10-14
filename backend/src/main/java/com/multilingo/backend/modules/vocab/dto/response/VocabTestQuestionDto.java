package com.multilingo.backend.modules.vocab.dto.response;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VocabTestQuestionDto {

    private Integer questionNumber;

    private Integer cardId;

    private String word;

    private String phonetic;

    private String pos;

    private String sentence;

    private List<VocabTestOptionDto> options;
}
