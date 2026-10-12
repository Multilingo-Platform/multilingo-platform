package com.multilingo.backend.modules.vocab.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateQuizSessionRequest {

    @Min(value = 1, message = "Số lượng câu hỏi tối thiểu là 1")
    @Max(value = 50, message = "Số lượng câu hỏi tối đa là 50")
    @Builder.Default
    private Integer limit = 10;

    @Builder.Default
    private String filterStatus = "ALL";
}
