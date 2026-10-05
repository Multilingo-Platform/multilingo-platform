package com.multilingo.backend.modules.vocab.mapper;

import com.multilingo.backend.modules.vocab.dto.request.CreateFlashcardRequest;
import com.multilingo.backend.modules.vocab.dto.response.FlashcardResponse;
import com.multilingo.backend.modules.vocab.entity.FlashcardDeck;
import com.multilingo.backend.modules.vocab.entity.UserFlashcard;
import org.mapstruct.BeanMapping;
import org.mapstruct.Builder;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.NullValuePropertyMappingStrategy;

@Mapper(componentModel = "spring", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
public interface UserFlashcardMapper {

    /**
     * Chuyển đổi Entity UserFlashcard sang DTO FlashcardResponse.
     * Trích xuất deckId từ deck.id và wordId từ word.id.
     */
    @Mapping(target = "deckId", source = "deck.id")
    @Mapping(target = "wordId", source = "word.id")
    @Mapping(target = "phonetic", source = "word.phonetic")
    @Mapping(target = "pos", source = "word.pos")
    @Mapping(target = "languageCode", source = "word.languageCode")
    @Mapping(target = "defaultMeaning", source = "word.defaultMeaning")
    FlashcardResponse toResponse(UserFlashcard flashcard);

    /**
     * Chuyển đổi CreateFlashcardRequest sang Entity UserFlashcard khi tạo mới.
     * Khởi tạo các giá trị thuật toán SRS ban đầu:
     * - status = "NEW"
     * - reviewCount = 0
     * - easeFactor = 2.50
     * - intervalDays = 0
     * - nextReviewDate = Instant.now()
     */
    @BeanMapping(builder = @Builder(disableBuilder = true))
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deck", source = "deck")
    @Mapping(target = "userId", source = "userId")
    @Mapping(target = "word", ignore = true)
    @Mapping(target = "status", constant = "NEW")
    @Mapping(target = "reviewCount", constant = "0")
    @Mapping(target = "easeFactor", expression = "java(new java.math.BigDecimal(\"2.50\"))")
    @Mapping(target = "intervalDays", constant = "0")
    @Mapping(target = "nextReviewDate", expression = "java(java.time.Instant.now())")
    UserFlashcard toEntity(CreateFlashcardRequest request, FlashcardDeck deck, Integer userId);
}
