package com.multilingo.backend.modules.vocab.dto.response;

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
public class FlashcardStudyCardDto {
    private Integer id;
    private String customWord;
    private String phonetic;
    private String pos;
    private String maskedSentence;
    private String customMeaning;
    private String fullSentence;
    private String customImageUrl;
    private Integer reviewCount;
    private String status;
}
