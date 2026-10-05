package com.multilingo.backend.modules.vocab.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.common.exception.GlobalExceptionHandler;
import com.multilingo.backend.modules.vocab.dto.request.CreateDeckRequest;
import com.multilingo.backend.modules.vocab.dto.request.UpdateDeckRequest;
import com.multilingo.backend.modules.vocab.dto.response.DeckDetailResponse;
import com.multilingo.backend.modules.vocab.dto.response.DeckResponse;
import com.multilingo.backend.modules.vocab.dto.response.DeckSummaryResponse;
import com.multilingo.backend.modules.vocab.service.FlashcardDeckService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.springframework.test.context.ActiveProfiles;
import com.multilingo.backend.modules.auth.security.JwtAuthenticationFilter;

@WebMvcTest(FlashcardDeckController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
@ActiveProfiles("test")
@DisplayName("FlashcardDeckController WebMvc Tests")
class FlashcardDeckControllerTest {

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private FlashcardDeckService flashcardDeckService;

    @Test
    @DisplayName("TC_VOCAB_DECK_01: GET /api/v1/vocab/decks - Lấy danh sách bộ thẻ thành công 200 OK")
    void getUserDecks_success() throws Exception {
        DeckSummaryResponse summary = DeckSummaryResponse.builder()
                .id(10)
                .name("IELTS Core")
                .description("Vocabulary")
                .targetLanguage("en")
                .sourceLanguage("vi")
                .isPublic(false)
                .totalCards(10L)
                .newCards(2L)
                .learningCards(5L)
                .masteredCards(3L)
                .dueReviewCards(4L)
                .build();

        when(flashcardDeckService.getUserDecks(1)).thenReturn(List.of(summary));

        mockMvc.perform(get("/api/v1/vocab/decks")
                        .header("X-User-Id", 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].id").value(10))
                .andExpect(jsonPath("$.data[0].name").value("IELTS Core"))
                .andExpect(jsonPath("$.data[0].targetLanguage").value("en"))
                .andExpect(jsonPath("$.data[0].sourceLanguage").value("vi"))
                .andExpect(jsonPath("$.data[0].totalCards").value(10));
    }

    @Test
    @DisplayName("TC_VOCAB_DECK_02 & 07: POST /api/v1/vocab/decks - Tạo bộ thẻ thành công 201 Created")
    void createDeck_success() throws Exception {
        CreateDeckRequest req = CreateDeckRequest.builder()
                .name("TOEIC for Korean")
                .description("Targeted words")
                .targetLanguage("en")
                .sourceLanguage("ko")
                .isPublic(true)
                .build();

        DeckResponse res = DeckResponse.builder()
                .id(100)
                .userId(1)
                .name("TOEIC for Korean")
                .description("Targeted words")
                .targetLanguage("en")
                .sourceLanguage("ko")
                .isPublic(true)
                .clonesCount(0)
                .createdAt(Instant.now())
                .build();

        when(flashcardDeckService.createDeck(any(CreateDeckRequest.class), eq(1))).thenReturn(res);

        mockMvc.perform(post("/api/v1/vocab/decks")
                        .header("X-User-Id", 1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(100))
                .andExpect(jsonPath("$.data.name").value("TOEIC for Korean"))
                .andExpect(jsonPath("$.data.targetLanguage").value("en"))
                .andExpect(jsonPath("$.data.sourceLanguage").value("ko"));
    }

    @Test
    @DisplayName("TC_VOCAB_DECK_03: POST /api/v1/vocab/decks - Tên rỗng trả về 422 Unprocessable Entity")
    void createDeck_emptyName_validationFailed() throws Exception {
        CreateDeckRequest req = CreateDeckRequest.builder()
                .name("   ")
                .build();

        mockMvc.perform(post("/api/v1/vocab/decks")
                        .header("X-User-Id", 1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value(1201)); // DECK_NAME_REQUIRED code
    }

    @Test
    @DisplayName("TC_VOCAB_DECK_01: GET /api/v1/vocab/decks/{id} - Lấy chi tiết bộ thẻ thành công 200 OK")
    void getDeckDetail_success() throws Exception {
        DeckDetailResponse detail = DeckDetailResponse.builder()
                .id(10)
                .userId(1)
                .name("IELTS Core")
                .targetLanguage("en")
                .sourceLanguage("vi")
                .totalCards(15L)
                .build();

        when(flashcardDeckService.getDeckDetail(10, 1)).thenReturn(detail);

        mockMvc.perform(get("/api/v1/vocab/decks/10")
                        .header("X-User-Id", 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(10))
                .andExpect(jsonPath("$.data.name").value("IELTS Core"));
    }

    @Test
    @DisplayName("TC_VOCAB_DECK_05: GET /api/v1/vocab/decks/{id} - Chặn IDOR trả về 403 Forbidden")
    void getDeckDetail_forbidden() throws Exception {
        when(flashcardDeckService.getDeckDetail(10, 2))
                .thenThrow(new AppException(ErrorCode.FORBIDDEN));

        mockMvc.perform(get("/api/v1/vocab/decks/10")
                        .header("X-User-Id", 2))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    @DisplayName("TC_VOCAB_DECK_05: PUT /api/v1/vocab/decks/{id} - Cập nhật bộ thẻ thành công 200 OK")
    void updateDeck_success() throws Exception {
        UpdateDeckRequest req = UpdateDeckRequest.builder()
                .name("Updated Deck Name")
                .description("Updated Description")
                .targetLanguage("en")
                .sourceLanguage("vi")
                .isPublic(true)
                .build();

        DeckResponse res = DeckResponse.builder()
                .id(10)
                .userId(1)
                .name("Updated Deck Name")
                .build();

        when(flashcardDeckService.updateDeck(eq(10), any(UpdateDeckRequest.class), eq(1))).thenReturn(res);

        mockMvc.perform(put("/api/v1/vocab/decks/10")
                        .header("X-User-Id", 1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.name").value("Updated Deck Name"));
    }

    @Test
    @DisplayName("TC_VOCAB_DECK_06: DELETE /api/v1/vocab/decks/{id} - Xóa bộ thẻ thành công 200 OK")
    void deleteDeck_success() throws Exception {
        doNothing().when(flashcardDeckService).deleteDeck(10, 1);

        mockMvc.perform(delete("/api/v1/vocab/decks/10")
                        .header("X-User-Id", 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(flashcardDeckService, times(1)).deleteDeck(10, 1);
    }
}
