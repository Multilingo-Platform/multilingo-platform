package com.multilingo.backend.modules.vocab.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FinishStudySessionRequest {

    @NotNull(message = "Số thẻ đã ôn tập không được để trống")
    @Min(value = 0, message = "Số thẻ đã ôn tập không được âm")
    private Integer cardsReviewed;

    @Builder.Default
    @Min(value = 0, message = "Số thẻ nhớ không được âm")
    private Integer cardsRemembered = 0;

    @Builder.Default
    @Min(value = 0, message = "Số thẻ quên không được âm")
    private Integer cardsForgotten = 0;

    @Builder.Default
    @Min(value = 0, message = "Thời gian học không được âm")
    private Integer durationSeconds = 0;
}
