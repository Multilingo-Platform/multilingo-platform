package com.multilingo.backend.modules.vocab.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateDeckRequest {

    @NotBlank(message = "DECK_NAME_REQUIRED")
    @Size(max = 200, message = "DECK_NAME_TOO_LONG")
    private String name;

    @Size(max = 2000, message = "DECK_DESCRIPTION_TOO_LONG")
    private String description;

    @Size(max = 10, message = "FLASHCARD_LANG_INVALID")
    private String targetLanguage;

    @Size(max = 10, message = "FLASHCARD_LANG_INVALID")
    private String sourceLanguage;

    private Boolean isPublic;
}
