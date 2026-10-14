package com.multilingo.backend.modules.vocab.dto.request;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VocabTestAnswerItemDto {

    private Integer questionNumber;

    private String selectedKey;

    @Builder.Default
    private Boolean flagged = false;
}
