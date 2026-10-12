package com.multilingo.backend.modules.vocab.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SubmitPracticeAnswerDto {

    @NotNull(message = "questionId không được để trống")
    private Integer questionId;

    private String selectedOptionId;
}
