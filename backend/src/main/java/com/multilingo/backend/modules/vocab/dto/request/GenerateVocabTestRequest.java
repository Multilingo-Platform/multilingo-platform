package com.multilingo.backend.modules.vocab.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GenerateVocabTestRequest {

    @Min(value = 4, message = "Số lượng câu hỏi tối thiểu là 4")
    @Max(value = 20, message = "Số lượng câu hỏi tối đa là 20")
    @Builder.Default
    private Integer limit = 10;
}
