package com.multilingo.backend.modules.vocab.dto.response;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PracticeWrongAnswerDto {
    private Integer questionId;
    private Integer cardId;
    private String word;
    private String selectedOptionId;
    private String correctOptionId;
    private String correctMeaning;
}
