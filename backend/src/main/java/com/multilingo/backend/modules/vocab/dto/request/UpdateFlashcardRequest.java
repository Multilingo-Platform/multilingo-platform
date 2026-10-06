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
public class UpdateFlashcardRequest {

    @NotBlank(message = "FLASHCARD_WORD_REQUIRED")
    @Size(max = 150, message = "FLASHCARD_WORD_TOO_LONG")
    private String customWord;

    @NotBlank(message = "FLASHCARD_MEANING_REQUIRED")
    private String customMeaning;

    private String exampleSentence;

    @Size(max = 500, message = "FLASHCARD_IMAGE_URL_TOO_LONG")
    private String customImageUrl;

    @Size(max = 150, message = "FLASHCARD_PHONETIC_TOO_LONG")
    private String phonetic;

    @Size(max = 50, message = "FLASHCARD_POS_TOO_LONG")
    private String pos;

    @Size(max = 10, message = "FLASHCARD_LEVEL_TOO_LONG")
    private String level;
}
