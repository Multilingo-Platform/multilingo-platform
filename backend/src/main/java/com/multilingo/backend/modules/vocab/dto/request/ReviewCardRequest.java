package com.multilingo.backend.modules.vocab.dto.request;

import jakarta.validation.constraints.NotBlank;
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
public class ReviewCardRequest {

    @NotBlank(message = "INVALID_SRS_RATING")
    private String rating;
}
