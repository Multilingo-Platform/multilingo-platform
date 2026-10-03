package com.multilingo.backend.modules.vocab.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.common.exception.GlobalExceptionHandler;
import com.multilingo.backend.modules.vocab.dto.request.CreateFlashcardRequest;
import com.multilingo.backend.modules.vocab.dto.request.UpdateFlashcardRequest;
import com.multilingo.backend.modules.vocab.dto.response.FlashcardResponse;
import com.multilingo.backend.modules.vocab.service.UserFlashcardService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(UserFlashcardController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
@DisplayName("UserFlashcardController WebMvc Tests")
class UserFlashcardControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private UserFlashcardService userFlashcardService;

    @Test
    @DisplayName("TC_VOCAB_CARD_01 & 02: GET /api/v1/vocab/decks/{deckId}/cards - Lấy danh sách thẻ từ vựng 200 OK")
    void getCardsInDeck_success() throws Exception {
        FlashcardResponse card = FlashcardResponse.builder()
                .id(100)
                .deckId(10)
                .wordId(1)
                .customWord("apple")
                .customMeaning("사과")
                .phonetic("/ˈæp.əl/")
                .pos("noun")
                .languageCode("en")
                .defaultMeaning(Map.of("ko", "사과", "vi", "Quả táo"))
                .status("NEW")
                .reviewCount(0)
                .easeFactor(new BigDecimal("2.50"))
                .intervalDays(0)
                .nextReviewDate(Instant.now())
                .build();

        when(userFlashcardService.getCardsInDeck(10, "apple", "NEW", 1))
                .thenReturn(List.of(card));

        mockMvc.perform(get("/api/v1/vocab/decks/10/cards")
                        .param("keyword", "apple")
                        .param("status", "NEW")
                        .header("X-User-Id", 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].id").value(100))
                .andExpect(jsonPath("$.data[0].customWord").value("apple"))
                .andExpect(jsonPath("$.data[0].customMeaning").value("사과"))
                .andExpect(jsonPath("$.data[0].phonetic").value("/ˈæp.əl/"))
                .andExpect(jsonPath("$.data[0].pos").value("noun"))
                .andExpect(jsonPath("$.data[0].languageCode").value("en"));
    }

    @Test
    @DisplayName("TC_VOCAB_CARD_03: POST /api/v1/vocab/decks/{deckId}/cards - Thêm thẻ từ vựng thành công 201 Created")
    void addCard_success() throws Exception {
        CreateFlashcardRequest req = CreateFlashcardRequest.builder()
                .customWord("ephemeral")
                .customMeaning("phù du")
                .exampleSentence("Beauty is ephemeral.")
                .build();

        FlashcardResponse res = FlashcardResponse.builder()
                .id(101)
                .deckId(10)
                .customWord("ephemeral")
                .customMeaning("phù du")
                .status("NEW")
                .build();

        when(userFlashcardService.addCard(eq(10), any(CreateFlashcardRequest.class), eq(1)))
                .thenReturn(res);

        mockMvc.perform(post("/api/v1/vocab/decks/10/cards")
                        .header("X-User-Id", 1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(101))
                .andExpect(jsonPath("$.data.customWord").value("ephemeral"))
                .andExpect(jsonPath("$.data.status").value("NEW"));
    }

    @Test
    @DisplayName("POST /api/v1/vocab/decks/{deckId}/cards - customWord rỗng trả về 422 Unprocessable Entity")
    void addCard_emptyWord_validationFailed() throws Exception {
        CreateFlashcardRequest req = CreateFlashcardRequest.builder()
                .customWord("   ")
                .customMeaning("phù du")
                .build();

        mockMvc.perform(post("/api/v1/vocab/decks/10/cards")
                        .header("X-User-Id", 1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value(1204)); // FLASHCARD_WORD_REQUIRED code
    }

    @Test
    @DisplayName("TC_VOCAB_CARD_05: POST /api/v1/vocab/decks/{deckId}/cards - Trùng từ ném 409 Conflict")
    void addCard_duplicateWord_conflict() throws Exception {
        CreateFlashcardRequest req = CreateFlashcardRequest.builder()
                .customWord("ubiquitous")
                .customMeaning("phổ biến")
                .build();

        when(userFlashcardService.addCard(eq(10), any(CreateFlashcardRequest.class), eq(1)))
                .thenThrow(new AppException(ErrorCode.FLASHCARD_WORD_DUPLICATE));

        mockMvc.perform(post("/api/v1/vocab/decks/10/cards")
                        .header("X-User-Id", 1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(1210)); // FLASHCARD_WORD_DUPLICATE
    }

    @Test
    @DisplayName("TC_VOCAB_CARD_07: POST /api/v1/vocab/decks/{deckId}/cards - Chặn IDOR trả về 403 Forbidden")
    void addCard_forbidden() throws Exception {
        CreateFlashcardRequest req = CreateFlashcardRequest.builder()
                .customWord("hack")
                .customMeaning("nghĩa")
                .build();

        when(userFlashcardService.addCard(eq(10), any(CreateFlashcardRequest.class), eq(2)))
                .thenThrow(new AppException(ErrorCode.FORBIDDEN));

        mockMvc.perform(post("/api/v1/vocab/decks/10/cards")
                        .header("X-User-Id", 2)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    @DisplayName("PUT /api/v1/vocab/cards/{cardId} - Cập nhật thẻ thành công 200 OK")
    void updateCard_success() throws Exception {
        UpdateFlashcardRequest req = UpdateFlashcardRequest.builder()
                .customWord("ephemeral updated")
                .customMeaning("nghĩa mới")
                .build();

        FlashcardResponse res = FlashcardResponse.builder()
                .id(101)
                .customWord("ephemeral updated")
                .customMeaning("nghĩa mới")
                .build();

        when(userFlashcardService.updateCard(eq(101), any(UpdateFlashcardRequest.class), eq(1)))
                .thenReturn(res);

        mockMvc.perform(put("/api/v1/vocab/cards/101")
                        .header("X-User-Id", 1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.customWord").value("ephemeral updated"));
    }

    @Test
    @DisplayName("TC_VOCAB_CARD_06: DELETE /api/v1/vocab/cards/{cardId} - Xóa thẻ thành công 200 OK")
    void deleteCard_success() throws Exception {
        doNothing().when(userFlashcardService).deleteCard(101, 1);

        mockMvc.perform(delete("/api/v1/vocab/cards/101")
                        .header("X-User-Id", 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(userFlashcardService, times(1)).deleteCard(101, 1);
    }
}
