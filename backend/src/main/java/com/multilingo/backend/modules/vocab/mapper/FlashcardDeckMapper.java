package com.multilingo.backend.modules.vocab.mapper;

import com.multilingo.backend.modules.vocab.dto.request.CreateDeckRequest;
import com.multilingo.backend.modules.vocab.dto.response.DeckDetailResponse;
import com.multilingo.backend.modules.vocab.dto.response.DeckResponse;
import com.multilingo.backend.modules.vocab.dto.response.DeckStatsProjection;
import com.multilingo.backend.modules.vocab.dto.response.DeckSummaryResponse;
import com.multilingo.backend.modules.vocab.entity.FlashcardDeck;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.NullValuePropertyMappingStrategy;

@Mapper(componentModel = "spring", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
public interface FlashcardDeckMapper {

    /**
     * Chuyển đổi từ CreateDeckRequest sang Entity FlashcardDeck khi tạo mới.
     * Tự động khởi tạo clonesCount = 0 và gán userId từ context người dùng.
     */
    @org.mapstruct.BeanMapping(builder = @org.mapstruct.Builder(disableBuilder = true))
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "clonesCount", constant = "0")
    @Mapping(target = "userId", source = "userId")
    FlashcardDeck toEntity(CreateDeckRequest request, Integer userId);

    /**
     * Chuyển đổi Entity sang DeckResponse cơ bản.
     */
    DeckResponse toDeckResponse(FlashcardDeck deck);

    /**
     * Ghép nối Entity FlashcardDeck và số liệu thống kê (Projection)
     * thành DeckSummaryResponse phục vụ hiển thị danh sách thẻ.
     */
    default DeckSummaryResponse toSummaryResponse(FlashcardDeck deck, DeckStatsProjection stats) {
        if (deck == null) {
            return null;
        }
        return DeckSummaryResponse.builder()
                .id(deck.getId())
                .userId(deck.getUserId())
                .name(deck.getName())
                .description(deck.getDescription())
                .isPublic(deck.getIsPublic())
                .clonesCount(deck.getClonesCount())
                .totalCards(stats != null && stats.getTotalCards() != null ? stats.getTotalCards() : 0L)
                .newCards(stats != null && stats.getNewCards() != null ? stats.getNewCards() : 0L)
                .learningCards(stats != null && stats.getLearningCards() != null ? stats.getLearningCards() : 0L)
                .masteredCards(stats != null && stats.getMasteredCards() != null ? stats.getMasteredCards() : 0L)
                .dueReviewCards(stats != null && stats.getDueReviewCards() != null ? stats.getDueReviewCards() : 0L)
                .createdAt(deck.getCreatedAt())
                .updatedAt(deck.getUpdatedAt())
                .build();
    }

    /**
     * Ghép nối Entity FlashcardDeck và thống kê (Projection)
     * thành DeckDetailResponse phục vụ màn hình chi tiết bộ thẻ (Deck Detail & Card Explorer).
     */
    default DeckDetailResponse toDetailResponse(FlashcardDeck deck, DeckStatsProjection stats) {
        if (deck == null) {
            return null;
        }
        return DeckDetailResponse.builder()
                .id(deck.getId())
                .userId(deck.getUserId())
                .name(deck.getName())
                .description(deck.getDescription())
                .isPublic(deck.getIsPublic())
                .clonesCount(deck.getClonesCount())
                .totalCards(stats != null && stats.getTotalCards() != null ? stats.getTotalCards() : 0L)
                .newCards(stats != null && stats.getNewCards() != null ? stats.getNewCards() : 0L)
                .learningCards(stats != null && stats.getLearningCards() != null ? stats.getLearningCards() : 0L)
                .masteredCards(stats != null && stats.getMasteredCards() != null ? stats.getMasteredCards() : 0L)
                .dueReviewCards(stats != null && stats.getDueReviewCards() != null ? stats.getDueReviewCards() : 0L)
                .createdAt(deck.getCreatedAt())
                .updatedAt(deck.getUpdatedAt())
                .build();
    }
}
