package com.multilingo.backend.modules.vocab.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AutoSaveProgressRequest {

    @NotNull(message = "expectedVersion không được để trống")
    private Integer expectedVersion;

    private List<VocabTestAnswerItemDto> answers;
}
