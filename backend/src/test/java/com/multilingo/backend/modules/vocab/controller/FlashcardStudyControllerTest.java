package com.multilingo.backend.modules.vocab.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.common.exception.GlobalExceptionHandler;
import com.multilingo.backend.modules.vocab.dto.request.FinishStudySessionRequest;
import com.multilingo.backend.modules.vocab.dto.request.ReviewCardRequest;
import com.multilingo.backend.modules.vocab.dto.response.CardReviewResponse;
import com.multilingo.backend.modules.vocab.dto.response.FlashcardStudyCardDto;
import com.multilingo.backend.modules.vocab.dto.response.StudySessionResponse;
import com.multilingo.backend.modules.vocab.dto.response.StudySessionSummaryResponse;
import com.multilingo.backend.modules.vocab.service.FlashcardStudyService;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(FlashcardStudyController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
@DisplayName("FlashcardStudyController WebMvc Tests - UC012.2 SRS")
class FlashcardStudyControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private FlashcardStudyService flashcardStudyService;

    @Test
    @DisplayName("GET /api/v1/vocab/decks/{deckId}/study-session - Thành công 200 OK")
    void getStudySession_success() throws Exception {
        FlashcardStudyCardDto cardDto = FlashcardStudyCardDto.builder()
                .id(101)
                .customWord("ubiquitous")
                .phonetic("/juːˈbɪk.wɪ.təs/")
                .pos("adj")
                .maskedSentence("Smartphones have become _______ in daily modern life.")
                .customMeaning("có mặt khắp nơi")
                .fullSentence("Smartphones have become ubiquitous in daily modern life.")
                .reviewCount(2)
                .status("LEARNING")
                .build();

        StudySessionResponse response = StudySessionResponse.builder()
                .deckId(1)
                .deckName("IELTS 3000")
                .targetLanguage("en")
                .sourceLanguage("vi")
                .totalSessionCards(1)
                .cards(List.of(cardDto))
                .build();

        when(flashcardStudyService.getStudySession(eq(1), eq(1))).thenReturn(response);

        mockMvc.perform(get("/api/v1/vocab/decks/1/study-session")
                        .header("X-User-Id", 1)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.deckId").value(1))
                .andExpect(jsonPath("$.data.deckName").value("IELTS 3000"))
                .andExpect(jsonPath("$.data.totalSessionCards").value(1))
                .andExpect(jsonPath("$.data.cards[0].customWord").value("ubiquitous"))
                .andExpect(jsonPath("$.data.cards[0].maskedSentence").value("Smartphones have become _______ in daily modern life."));

        verify(flashcardStudyService).getStudySession(1, 1);
    }

    @Test
    @DisplayName("GET /api/v1/vocab/decks/{deckId}/study-session - Ném 400 Bad Request khi bộ thẻ rỗng")
    void getStudySession_emptyDeck_throws400() throws Exception {
        when(flashcardStudyService.getStudySession(eq(2), eq(1)))
                .thenThrow(new AppException(ErrorCode.DECK_EMPTY));

        mockMvc.perform(get("/api/v1/vocab/decks/2/study-session")
                        .header("X-User-Id", 1))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(1212))
                .andExpect(jsonPath("$.message").value(ErrorCode.DECK_EMPTY.getMessage()));
    }

    @Test
    @DisplayName("GET /api/v1/vocab/decks/{deckId}/study-session - 404 Not Found khi không tìm thấy bộ thẻ")
    void getStudySession_notFound_throws404() throws Exception {
        when(flashcardStudyService.getStudySession(eq(999), eq(1)))
                .thenThrow(new AppException(ErrorCode.FLASHCARD_DECK_NOT_FOUND));

        mockMvc.perform(get("/api/v1/vocab/decks/999/study-session")
                        .header("X-User-Id", 1))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(1208));
    }

    @Test
    @DisplayName("POST /api/v1/vocab/cards/{cardId}/review - Đánh giá REMEMBERED thành công 200 OK")
    void reviewCard_remembered_success() throws Exception {
        ReviewCardRequest request = ReviewCardRequest.builder()
                .rating("REMEMBERED")
                .build();

        CardReviewResponse response = CardReviewResponse.builder()
                .cardId(101)
                .status("LEARNING")
                .reviewCount(3)
                .intervalDays(7)
                .easeFactor(new BigDecimal("2.50"))
                .nextReviewDate(Instant.now())
                .build();

        when(flashcardStudyService.reviewCard(eq(101), eq(1), any(ReviewCardRequest.class)))
                .thenReturn(response);

        mockMvc.perform(post("/api/v1/vocab/cards/101/review")
                        .header("X-User-Id", 1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.cardId").value(101))
                .andExpect(jsonPath("$.data.reviewCount").value(3))
                .andExpect(jsonPath("$.data.intervalDays").value(7))
                .andExpect(jsonPath("$.data.status").value("LEARNING"));
    }

    @Test
    @DisplayName("POST /api/v1/vocab/cards/{cardId}/review - Rating không hợp lệ ném 400 Bad Request")
    void reviewCard_invalidRating_throws400() throws Exception {
        ReviewCardRequest request = ReviewCardRequest.builder()
                .rating("UNKNOWN")
                .build();

        when(flashcardStudyService.reviewCard(eq(101), eq(1), any(ReviewCardRequest.class)))
                .thenThrow(new AppException(ErrorCode.INVALID_SRS_RATING));

        mockMvc.perform(post("/api/v1/vocab/cards/101/review")
                        .header("X-User-Id", 1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(1213));
    }

    @Test
    @DisplayName("POST /api/v1/vocab/cards/{cardId}/review - Rating để trống trả về lỗi validation 422")
    void reviewCard_blankRating_validationError() throws Exception {
        ReviewCardRequest request = ReviewCardRequest.builder()
                .rating("")
                .build();

        // Base Architecture quy định MethodArgumentNotValidException trả về 422 UNPROCESSABLE_ENTITY
        mockMvc.perform(post("/api/v1/vocab/cards/101/review")
                        .header("X-User-Id", 1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value(422));
    }

    @Test
    @DisplayName("POST /api/v1/vocab/decks/{deckId}/finish-session - Hoàn tất phiên học thành công 200 OK")
    void finishSession_success() throws Exception {
        FinishStudySessionRequest request = FinishStudySessionRequest.builder()
                .cardsReviewed(10)
                .cardsRemembered(8)
                .cardsForgotten(2)
                .durationSeconds(120)
                .build();

        StudySessionSummaryResponse summary = StudySessionSummaryResponse.builder()
                .earnedXp(26)
                .currentStreak(4)
                .totalMasteredCards(5)
                .cardsReviewed(10)
                .build();

        when(flashcardStudyService.finishSession(eq(1), eq(1), any(FinishStudySessionRequest.class)))
                .thenReturn(summary);

        mockMvc.perform(post("/api/v1/vocab/decks/1/finish-session")
                        .header("X-User-Id", 1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.earnedXp").value(26))
                .andExpect(jsonPath("$.data.currentStreak").value(4))
                .andExpect(jsonPath("$.data.totalMasteredCards").value(5))
                .andExpect(jsonPath("$.data.cardsReviewed").value(10));
    }

    @Test
    @DisplayName("POST /api/v1/vocab/decks/{deckId}/finish-session - Số thẻ ôn bị null hoặc âm báo lỗi validation 422")
    void finishSession_invalidInput_validationError() throws Exception {
        FinishStudySessionRequest request = FinishStudySessionRequest.builder()
                .cardsReviewed(-1)
                .build();

        // Base Architecture: Validation failed trả về 422 UNPROCESSABLE_ENTITY
        mockMvc.perform(post("/api/v1/vocab/decks/1/finish-session")
                        .header("X-User-Id", 1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value(422));
    }
}
