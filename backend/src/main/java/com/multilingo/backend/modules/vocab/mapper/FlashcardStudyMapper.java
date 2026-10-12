package com.multilingo.backend.modules.vocab.mapper;

import com.multilingo.backend.modules.vocab.constant.VocabStudyConstants;
import com.multilingo.backend.modules.vocab.dto.response.CardReviewResponse;
import com.multilingo.backend.modules.vocab.dto.response.FlashcardStudyCardDto;
import com.multilingo.backend.modules.vocab.dto.response.StudySessionResponse;
import com.multilingo.backend.modules.vocab.dto.response.StudySessionSummaryResponse;
import com.multilingo.backend.modules.vocab.entity.FlashcardDeck;
import com.multilingo.backend.modules.vocab.entity.UserFlashcard;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;
import org.mapstruct.NullValuePropertyMappingStrategy;

import java.util.List;
import java.util.regex.Pattern;

/**
 * MapStruct Mapper cho phân hệ Ôn tập Flashcard SRS.
 */
@Mapper(componentModel = "spring", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
public interface FlashcardStudyMapper {

    /**
     * Chuyển đổi thực thể UserFlashcard sang DTO FlashcardStudyCardDto.
     */
    @Mapping(target = "id", source = "card.id")
    @Mapping(target = "phonetic", source = "card.word.phonetic")
    @Mapping(target = "pos", source = "card.word.pos")
    @Mapping(target = "fullSentence", source = "card", qualifiedByName = "resolveFullSentence")
    @Mapping(target = "maskedSentence", source = "card", qualifiedByName = "resolveMaskedSentence")
    FlashcardStudyCardDto toStudyCardDto(UserFlashcard card);

    /**
     * Chuyển đổi thông tin bộ thẻ và danh sách thẻ sang DTO StudySessionResponse.
     */
    @Mapping(target = "deckId", source = "deck.id")
    @Mapping(target = "deckName", source = "deck.name")
    @Mapping(target = "targetLanguage", source = "deck.targetLanguage")
    @Mapping(target = "sourceLanguage", source = "deck.sourceLanguage")
    @Mapping(target = "totalSessionCards", expression = "java(cards != null ? cards.size() : 0)")
    @Mapping(target = "cards", source = "cards")
    StudySessionResponse toStudySessionResponse(FlashcardDeck deck, List<FlashcardStudyCardDto> cards);

    /**
     * Chuyển đổi UserFlashcard sau khi đánh giá sang DTO CardReviewResponse.
     */
    @Mapping(target = "cardId", source = "id")
    @Mapping(target = "nextReviewDate", source = "nextReviewDate")
    @Mapping(target = "intervalDays", source = "intervalDays")
    @Mapping(target = "easeFactor", source = "easeFactor")
    @Mapping(target = "reviewCount", source = "reviewCount")
    @Mapping(target = "status", source = "status")
    CardReviewResponse toCardReviewResponse(UserFlashcard card);

    /**
     * Chuyển đổi kết quả phiên học sang DTO StudySessionSummaryResponse.
     */
    default StudySessionSummaryResponse toSessionSummaryResponse(
            int earnedXp,
            int currentStreak,
            int totalMasteredCards,
            int cardsReviewed
    ) {
        return StudySessionSummaryResponse.builder()
                .earnedXp(earnedXp)
                .currentStreak(currentStreak)
                .totalMasteredCards(totalMasteredCards)
                .cardsReviewed(cardsReviewed)
                .build();
    }

    @Named("resolveFullSentence")
    default String resolveFullSentence(UserFlashcard card) {
        if (card == null) return null;
        String sentence = card.getExampleSentence();
        if ((sentence == null || sentence.isBlank()) && card.getWord() != null) {
            sentence = card.getWord().getExampleSentence();
        }
        return sentence;
    }

    @Named("resolveMaskedSentence")
    default String resolveMaskedSentence(UserFlashcard card) {
        if (card == null) return null;
        String sentence = resolveFullSentence(card);
        String word = card.getCustomWord();
        if (sentence == null || sentence.isBlank() || word == null || word.isBlank()) {
            return sentence;
        }

        String trimmedWord = word.trim();
        String boundaryRegex = "(?i)\\b" + Pattern.quote(trimmedWord) + "\\b";
        String masked = sentence.replaceAll(boundaryRegex, VocabStudyConstants.MASK_WORD_REPLACEMENT);

        if (masked.equals(sentence)) {
            masked = sentence.replaceAll("(?i)" + Pattern.quote(trimmedWord), VocabStudyConstants.MASK_WORD_REPLACEMENT);
        }
        return masked;
    }
}
