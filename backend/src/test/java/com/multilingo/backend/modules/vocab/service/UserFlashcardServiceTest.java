package com.multilingo.backend.modules.vocab.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.vocab.dto.request.CreateFlashcardRequest;
import com.multilingo.backend.modules.vocab.dto.request.UpdateFlashcardRequest;
import com.multilingo.backend.modules.vocab.dto.response.FlashcardResponse;
import com.multilingo.backend.modules.vocab.entity.DictionaryWord;
import com.multilingo.backend.modules.vocab.entity.FlashcardDeck;
import com.multilingo.backend.modules.vocab.entity.UserFlashcard;
import com.multilingo.backend.modules.vocab.mapper.UserFlashcardMapper;
import com.multilingo.backend.modules.vocab.repository.DictionaryWordRepository;
import com.multilingo.backend.modules.vocab.repository.FlashcardDeckRepository;
import com.multilingo.backend.modules.vocab.repository.UserFlashcardRepository;
import com.multilingo.backend.modules.vocab.service.impl.UserFlashcardServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserFlashcardService Unit Tests")
class UserFlashcardServiceTest {

    @Mock
    private UserFlashcardRepository userFlashcardRepository;

    @Mock
    private FlashcardDeckRepository flashcardDeckRepository;

    @Mock
    private DictionaryWordRepository dictionaryWordRepository;

    @Spy
    private UserFlashcardMapper userFlashcardMapper = Mappers.getMapper(UserFlashcardMapper.class);

    @InjectMocks
    private UserFlashcardServiceImpl userFlashcardService;

    private FlashcardDeck sampleDeck;
    private UserFlashcard sampleCard;
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

        sampleCard = UserFlashcard.builder()
                .userId(userId)
                .deck(sampleDeck)
                .customWord("Ubiquitous")
                .customMeaning("Có mặt ở khắp mọi nơi")
                .exampleSentence("Smartphones are ubiquitous.")
                .status("NEW")
                .reviewCount(0)
                .easeFactor(new BigDecimal("2.50"))
                .intervalDays(0)
                .nextReviewDate(Instant.now())
                .build();
        sampleCard.setId(100);
        sampleCard.setCreatedAt(Instant.now());
    }

    @Test
    @DisplayName("TC_VOCAB_CARD_01 & 02: getCardsInDeck tìm kiếm và lọc thẻ thành công cho chủ sở hữu")
    void testGetCardsInDeck_success() {
        when(flashcardDeckRepository.findById(10)).thenReturn(Optional.of(sampleDeck));
        when(userFlashcardRepository.searchCards(eq(10), eq(userId), eq("ubi"), eq("NEW")))
                .thenReturn(List.of(sampleCard));

        List<FlashcardResponse> results = userFlashcardService.getCardsInDeck(10, "ubi", "NEW", userId);

        assertEquals(1, results.size());
        FlashcardResponse cardRes = results.get(0);
        assertEquals(100, cardRes.getId());
        assertEquals(10, cardRes.getDeckId());
        assertEquals("Ubiquitous", cardRes.getCustomWord());
        assertEquals("NEW", cardRes.getStatus());
    }

    @Test
    @DisplayName("getCardsInDeck: Ném FLASHCARD_DECK_NOT_FOUND khi deck không tồn tại")
    void testGetCardsInDeck_deckNotFound() {
        when(flashcardDeckRepository.findById(999)).thenReturn(Optional.empty());

        AppException ex = assertThrows(AppException.class, () ->
                userFlashcardService.getCardsInDeck(999, null, null, userId));

        assertEquals(ErrorCode.FLASHCARD_DECK_NOT_FOUND, ex.getErrorCode());
    }

    @Test
    @DisplayName("getCardsInDeck: Ném FORBIDDEN khi user khác xem deck riêng tư (IDOR)")
    void testGetCardsInDeck_forbiddenForPrivateDeck() {
        sampleDeck.setIsPublic(false);
        when(flashcardDeckRepository.findById(10)).thenReturn(Optional.of(sampleDeck));

        AppException ex = assertThrows(AppException.class, () ->
                userFlashcardService.getCardsInDeck(10, null, null, otherUserId));

        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
    }

    @Test
    @DisplayName("TC_VOCAB_CARD_03: addCard tạo mới thẻ thành công với các giá trị SRS mặc định")
    void testAddCard_success() {
        when(flashcardDeckRepository.findById(10)).thenReturn(Optional.of(sampleDeck));
        when(userFlashcardRepository.existsByDeckIdAndCustomWordIgnoreCase(10, "Ephemeral"))
                .thenReturn(false);

        CreateFlashcardRequest req = CreateFlashcardRequest.builder()
                .customWord("  Ephemeral  ")
                .customMeaning("Phù du, chóng tàn")
                .exampleSentence("Fame can be ephemeral.")
                .build();

        when(userFlashcardRepository.save(any(UserFlashcard.class))).thenAnswer(invocation -> {
            UserFlashcard card = invocation.getArgument(0);
            card.setId(101);
            card.setCreatedAt(Instant.now());
            return card;
        });

        FlashcardResponse res = userFlashcardService.addCard(10, req, userId);

        assertNotNull(res);
        assertEquals(101, res.getId());
        assertEquals("Ephemeral", res.getCustomWord());
        assertEquals("NEW", res.getStatus());
        assertEquals(new BigDecimal("2.50"), res.getEaseFactor());
        assertEquals(0, res.getIntervalDays());
        assertEquals(0, res.getReviewCount());
        assertNotNull(res.getNextReviewDate());
    }

    @Test
    @DisplayName("TC_VOCAB_CARD_07: addCard ném FORBIDDEN khi user cố thêm thẻ vào deck người khác (IDOR)")
    void testAddCard_forbidden() {
        when(flashcardDeckRepository.findById(10)).thenReturn(Optional.of(sampleDeck));

        CreateFlashcardRequest req = CreateFlashcardRequest.builder()
                .customWord("Test")
                .customMeaning("Nghĩa")
                .build();

        AppException ex = assertThrows(AppException.class, () ->
                userFlashcardService.addCard(10, req, otherUserId));

        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
        verify(userFlashcardRepository, never()).save(any());
    }

    @Test
    @DisplayName("TC_VOCAB_CARD_05: addCard ném FLASHCARD_WORD_DUPLICATE khi từ vựng đã tồn tại trong deck")
    void testAddCard_duplicateWord() {
        when(flashcardDeckRepository.findById(10)).thenReturn(Optional.of(sampleDeck));
        when(userFlashcardRepository.existsByDeckIdAndCustomWordIgnoreCase(10, "ubiquitous"))
                .thenReturn(true);

        CreateFlashcardRequest req = CreateFlashcardRequest.builder()
                .customWord("ubiquitous")
                .customMeaning("Trùng lặp")
                .build();

        AppException ex = assertThrows(AppException.class, () ->
                userFlashcardService.addCard(10, req, userId));

        assertEquals(ErrorCode.FLASHCARD_WORD_DUPLICATE, ex.getErrorCode());
        verify(userFlashcardRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateCard: Cập nhật thông tin thẻ thành công cho chủ sở hữu")
    void testUpdateCard_success() {
        when(userFlashcardRepository.findById(100)).thenReturn(Optional.of(sampleCard));
        when(userFlashcardRepository.save(any(UserFlashcard.class))).thenAnswer(i -> i.getArgument(0));

        UpdateFlashcardRequest req = UpdateFlashcardRequest.builder()
                .customWord("Ubiquitous Updated")
                .customMeaning("Nghĩa mới")
                .exampleSentence("New example")
                .build();

        FlashcardResponse res = userFlashcardService.updateCard(100, req, userId);

        assertEquals("Ubiquitous Updated", res.getCustomWord());
        assertEquals("Nghĩa mới", res.getCustomMeaning());
    }

    @Test
    @DisplayName("TC_VOCAB_CARD_07: updateCard ném FORBIDDEN khi user khác sửa thẻ (IDOR)")
    void testUpdateCard_forbidden() {
        when(userFlashcardRepository.findById(100)).thenReturn(Optional.of(sampleCard));

        UpdateFlashcardRequest req = UpdateFlashcardRequest.builder()
                .customWord("Hacked")
                .customMeaning("Nghĩa")
                .build();

        AppException ex = assertThrows(AppException.class, () ->
                userFlashcardService.updateCard(100, req, otherUserId));

        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
    }

    @Test
    @DisplayName("TC_VOCAB_CARD_08: addCard tự động lấy nghĩa từ DictionaryWord theo sourceLanguage của deck")
    void testAddCard_autoExtractMeaning_fromDictionaryWord() {
        sampleDeck.setSourceLanguage("ko");
        when(flashcardDeckRepository.findById(10)).thenReturn(Optional.of(sampleDeck));
        when(userFlashcardRepository.existsByDeckIdAndCustomWordIgnoreCase(10, "apple"))
                .thenReturn(false);

        DictionaryWord dictWord = DictionaryWord.builder()
                .word("apple")
                .languageCode("en")
                .phonetic("/ˈæp.əl/")
                .pos("noun")
                .defaultMeaning(java.util.Map.of("ko", "사과", "vi", "Quả táo"))
                .build();
        dictWord.setId(1);

        when(dictionaryWordRepository.findById(1)).thenReturn(Optional.of(dictWord));

        CreateFlashcardRequest req = CreateFlashcardRequest.builder()
                .customWord("apple")
                .customMeaning(null)
                .wordId(1)
                .build();

        when(userFlashcardRepository.save(any(UserFlashcard.class))).thenAnswer(invocation -> {
            UserFlashcard card = invocation.getArgument(0);
            card.setId(102);
            card.setCreatedAt(Instant.now());
            return card;
        });

        FlashcardResponse res = userFlashcardService.addCard(10, req, userId);

        assertNotNull(res);
        assertEquals(102, res.getId());
        assertEquals("apple", res.getCustomWord());
        assertEquals("사과", res.getCustomMeaning());
        assertEquals("/ˈæp.əl/", res.getPhonetic());
        assertEquals("noun", res.getPos());
        assertEquals("en", res.getLanguageCode());
    }

    @Test
    @DisplayName("TC_VOCAB_CARD_04: addCard ném FLASHCARD_MEANING_REQUIRED khi không nhập nghĩa và không có wordId")
    void testAddCard_missingMeaningAndWordId_throwsException() {
        when(flashcardDeckRepository.findById(10)).thenReturn(Optional.of(sampleDeck));
        when(userFlashcardRepository.existsByDeckIdAndCustomWordIgnoreCase(10, "test"))
                .thenReturn(false);

        CreateFlashcardRequest req = CreateFlashcardRequest.builder()
                .customWord("test")
                .customMeaning("   ")
                .wordId(null)
                .build();

        AppException ex = assertThrows(AppException.class, () ->
                userFlashcardService.addCard(10, req, userId));

        assertEquals(ErrorCode.FLASHCARD_MEANING_REQUIRED, ex.getErrorCode());
    }

    @Test
    @DisplayName("TC_VOCAB_CARD_06: deleteCard xóa thẻ thành công cho chủ sở hữu")
    void testDeleteCard_success() {
        when(userFlashcardRepository.findById(100)).thenReturn(Optional.of(sampleCard));

        userFlashcardService.deleteCard(100, userId);

        verify(userFlashcardRepository, times(1)).delete(sampleCard);
    }

    @Test
    @DisplayName("TC_VOCAB_CARD_07: deleteCard ném FORBIDDEN khi user khác xóa thẻ (IDOR)")
    void testDeleteCard_forbidden() {
        when(userFlashcardRepository.findById(100)).thenReturn(Optional.of(sampleCard));

        AppException ex = assertThrows(AppException.class, () ->
                userFlashcardService.deleteCard(100, otherUserId));

        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
        verify(userFlashcardRepository, never()).delete(any());
    }
}
