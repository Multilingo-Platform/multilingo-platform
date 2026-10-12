package com.multilingo.backend.modules.vocab.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SubmitPracticeRequest {

    @Builder.Default
    private Integer durationSeconds = 0;

    @NotEmpty(message = "Danh sách câu trả lời không được để trống")
    @Valid
    private List<SubmitPracticeAnswerDto> answers;
}
