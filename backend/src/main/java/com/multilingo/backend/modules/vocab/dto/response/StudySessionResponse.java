package com.multilingo.backend.modules.vocab.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudySessionResponse {
    private Integer deckId;
    private String deckName;
    private String targetLanguage;
    private String sourceLanguage;
    private Integer totalSessionCards;
    private List<FlashcardStudyCardDto> cards;
}
