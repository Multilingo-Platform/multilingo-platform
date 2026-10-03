package com.multilingo.backend.modules.vocab.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.vocab.dto.request.CreateDeckRequest;
import com.multilingo.backend.modules.vocab.dto.request.UpdateDeckRequest;
import com.multilingo.backend.modules.vocab.dto.response.DeckDetailResponse;
import com.multilingo.backend.modules.vocab.dto.response.DeckResponse;
import com.multilingo.backend.modules.vocab.dto.response.DeckStatsProjection;
import com.multilingo.backend.modules.vocab.dto.response.DeckSummaryResponse;
import com.multilingo.backend.modules.vocab.entity.FlashcardDeck;
import com.multilingo.backend.modules.vocab.mapper.FlashcardDeckMapper;
import com.multilingo.backend.modules.vocab.repository.FlashcardDeckRepository;
import com.multilingo.backend.modules.vocab.repository.UserFlashcardRepository;
import com.multilingo.backend.modules.vocab.service.impl.FlashcardDeckServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("FlashcardDeckService Unit Tests")
class FlashcardDeckServiceTest {

    @Mock
    private FlashcardDeckRepository flashcardDeckRepository;

    @Mock
    private UserFlashcardRepository userFlashcardRepository;

    @Spy
    private FlashcardDeckMapper flashcardDeckMapper = Mappers.getMapper(FlashcardDeckMapper.class);

    @InjectMocks
    private FlashcardDeckServiceImpl flashcardDeckService;

    private FlashcardDeck sampleDeck;
    private final Integer userId = 1;
    private final Integer otherUserId = 2;

    @BeforeEach
    void setUp() {
        sampleDeck = FlashcardDeck.builder()
                .userId(userId)
                .name("IELTS Academic Core")
                .description("500 core words")
                .isPublic(false)
                .clonesCount(0)
                .build();
        sampleDeck.setId(10);
        sampleDeck.setCreatedAt(Instant.now());
        sampleDeck.setUpdatedAt(Instant.now());
    }

    @Test
    @DisplayName("TC_VOCAB_DECK_01: getUserDecks trả về danh sách kèm map thống kê thẻ chính xác")
    void testGetUserDecks_withStats() {
        when(flashcardDeckRepository.findAllByUserIdOrderByCreatedAtDesc(userId))
                .thenReturn(List.of(sampleDeck));

        DeckStatsProjection mockStats = mock(DeckStatsProjection.class);
        when(mockStats.getDeckId()).thenReturn(10);
        when(mockStats.getTotalCards()).thenReturn(15L);
        when(mockStats.getNewCards()).thenReturn(5L);
        when(mockStats.getLearningCards()).thenReturn(7L);
        when(mockStats.getMasteredCards()).thenReturn(3L);
        when(mockStats.getDueReviewCards()).thenReturn(4L);

        when(userFlashcardRepository.countStatsByDeckIds(eq(List.of(10)), any(Instant.class)))
                .thenReturn(List.of(mockStats));

        List<DeckSummaryResponse> responses = flashcardDeckService.getUserDecks(userId);

        assertEquals(1, responses.size());
        DeckSummaryResponse res = responses.get(0);
        assertEquals(10, res.getId());
        assertEquals("IELTS Academic Core", res.getName());
        assertEquals(15L, res.getTotalCards());
        assertEquals(5L, res.getNewCards());
        assertEquals(7L, res.getLearningCards());
        assertEquals(3L, res.getMasteredCards());
        assertEquals(4L, res.getDueReviewCards());
    }

    @Test
    @DisplayName("getUserDecks: Trả về danh sách rỗng khi user chưa có deck nào")
    void testGetUserDecks_emptyList() {
        when(flashcardDeckRepository.findAllByUserIdOrderByCreatedAtDesc(userId))
                .thenReturn(Collections.emptyList());

        List<DeckSummaryResponse> responses = flashcardDeckService.getUserDecks(userId);

        assertTrue(responses.isEmpty());
        verify(userFlashcardRepository, never()).countStatsByDeckIds(anyList(), any());
    }

    @Test
    @DisplayName("TC_VOCAB_DECK_02: createDeck tạo mới bộ thẻ thành công với đúng userId")
    void testCreateDeck_success() {
        CreateDeckRequest req = CreateDeckRequest.builder()
                .name("TOEIC 750+")
                .description("Văn phòng thương mại")
                .isPublic(true)
                .build();

        when(flashcardDeckRepository.save(any(FlashcardDeck.class))).thenAnswer(invocation -> {
            FlashcardDeck d = invocation.getArgument(0);
            d.setId(100);
            d.setCreatedAt(Instant.now());
            d.setUpdatedAt(Instant.now());
            return d;
        });

        DeckResponse res = flashcardDeckService.createDeck(req, userId);

        assertNotNull(res);
        assertEquals(100, res.getId());
        assertEquals(userId, res.getUserId());
        assertEquals("TOEIC 750+", res.getName());
        assertTrue(res.getIsPublic());
    }

    @Test
    @DisplayName("getDeckDetail: Lấy chi tiết bộ thẻ thành công khi là chủ sở hữu")
    void testGetDeckDetail_success() {
        when(flashcardDeckRepository.findById(10)).thenReturn(Optional.of(sampleDeck));

        DeckStatsProjection mockStats = mock(DeckStatsProjection.class);
        when(mockStats.getTotalCards()).thenReturn(20L);
        when(mockStats.getNewCards()).thenReturn(5L);
        when(mockStats.getLearningCards()).thenReturn(10L);
        when(mockStats.getMasteredCards()).thenReturn(5L);
        when(mockStats.getDueReviewCards()).thenReturn(2L);

        when(userFlashcardRepository.countStatsByDeckId(eq(10), any(Instant.class)))
                .thenReturn(Optional.of(mockStats));

        DeckDetailResponse res = flashcardDeckService.getDeckDetail(10, userId);

        assertNotNull(res);
        assertEquals(10, res.getId());
        assertEquals(20L, res.getTotalCards());
        assertEquals(5L, res.getMasteredCards());
    }

    @Test
    @DisplayName("getDeckDetail: Ném FLASHCARD_DECK_NOT_FOUND khi deck không tồn tại")
    void testGetDeckDetail_notFound() {
        when(flashcardDeckRepository.findById(999)).thenReturn(Optional.empty());

        AppException ex = assertThrows(AppException.class, () ->
                flashcardDeckService.getDeckDetail(999, userId));

        assertEquals(ErrorCode.FLASHCARD_DECK_NOT_FOUND, ex.getErrorCode());
    }

    @Test
    @DisplayName("getDeckDetail: Ném FORBIDDEN khi user khác truy cập deck riêng tư của người khác (IDOR)")
    void testGetDeckDetail_forbiddenForPrivateDeck() {
        sampleDeck.setIsPublic(false);
        when(flashcardDeckRepository.findById(10)).thenReturn(Optional.of(sampleDeck));

        AppException ex = assertThrows(AppException.class, () ->
                flashcardDeckService.getDeckDetail(10, otherUserId));

        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
    }

    @Test
    @DisplayName("updateDeck: Cập nhật thành công khi là chủ sở hữu")
    void testUpdateDeck_success() {
        when(flashcardDeckRepository.findById(10)).thenReturn(Optional.of(sampleDeck));
        when(flashcardDeckRepository.save(any(FlashcardDeck.class))).thenAnswer(i -> i.getArgument(0));

        UpdateDeckRequest req = UpdateDeckRequest.builder()
                .name("IELTS 8.0 Advanced")
                .description("Updated desc")
                .isPublic(true)
                .build();

        DeckResponse res = flashcardDeckService.updateDeck(10, req, userId);

        assertEquals("IELTS 8.0 Advanced", res.getName());
        assertEquals("Updated desc", res.getDescription());
        assertTrue(res.getIsPublic());
    }

    @Test
    @DisplayName("TC_VOCAB_DECK_05: updateDeck ném FORBIDDEN khi user khác sửa deck (IDOR)")
    void testUpdateDeck_forbidden() {
        when(flashcardDeckRepository.findById(10)).thenReturn(Optional.of(sampleDeck));

        UpdateDeckRequest req = UpdateDeckRequest.builder().name("Hacked").build();

        AppException ex = assertThrows(AppException.class, () ->
                flashcardDeckService.updateDeck(10, req, otherUserId));

        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
    }

    @Test
    @DisplayName("TC_VOCAB_DECK_06: deleteDeck xóa cascade thẻ liên quan và xóa deck khi là chủ sở hữu")
    void testDeleteDeck_successCascade() {
        when(flashcardDeckRepository.findById(10)).thenReturn(Optional.of(sampleDeck));

        flashcardDeckService.deleteDeck(10, userId);

        verify(userFlashcardRepository, times(1)).deleteByDeckId(10);
        verify(flashcardDeckRepository, times(1)).delete(sampleDeck);
    }

    @Test
    @DisplayName("TC_VOCAB_DECK_05: deleteDeck ném FORBIDDEN khi user khác xóa deck (IDOR)")
    void testDeleteDeck_forbidden() {
        when(flashcardDeckRepository.findById(10)).thenReturn(Optional.of(sampleDeck));

        AppException ex = assertThrows(AppException.class, () ->
                flashcardDeckService.deleteDeck(10, otherUserId));

        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
        verify(userFlashcardRepository, never()).deleteByDeckId(any());
        verify(flashcardDeckRepository, never()).delete(any());
    }
}
