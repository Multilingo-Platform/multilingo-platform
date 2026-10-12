package com.multilingo.backend.modules.vocab.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.common.exception.GlobalExceptionHandler;
import com.multilingo.backend.modules.auth.security.JwtAuthenticationFilter;
import com.multilingo.backend.modules.vocab.dto.request.CreateQuizSessionRequest;
import com.multilingo.backend.modules.vocab.dto.request.SubmitPracticeAnswerDto;
import com.multilingo.backend.modules.vocab.dto.request.SubmitPracticeRequest;
import com.multilingo.backend.modules.vocab.dto.response.*;
import com.multilingo.backend.modules.vocab.security.VocabIdentityResolver;
import com.multilingo.backend.modules.vocab.service.QuizPracticeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collections;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(QuizPracticeController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
@ActiveProfiles("test")
@DisplayName("QuizPracticeController WebMvc Tests - UC012.4 Practice Mode")
class QuizPracticeControllerTest {

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @MockBean
    private VocabIdentityResolver identityResolver;

    @MockBean
    private QuizPracticeService quizPracticeService;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        when(identityResolver.requireUserId()).thenReturn(1);
    }

    @Test
    @DisplayName("TC_PRACTICE_CTRL_01: POST /api/v1/vocab/decks/{deckId}/practice/sessions - Khởi tạo thành công 201 Created")
    void createPracticeSession_success() throws Exception {
        CreateQuizSessionRequest req = CreateQuizSessionRequest.builder()
                .limit(5)
                .filterStatus("ALL")
                .build();

        PracticeOptionDto optA = PracticeOptionDto.builder().optionId("A").text("Quả táo").build();
        PracticeOptionDto optB = PracticeOptionDto.builder().optionId("B").text("Quả cam").build();

        PracticeQuestionSnapshotDto qDto = PracticeQuestionSnapshotDto.builder()
                .questionId(1)
                .cardId(101)
                .targetWord("apple")
                .pos("NOUN")
                .sentence("An apple a day.")
                .options(List.of(optA, optB))
                .correctOptionId("A")
                .explanation("apple nghĩa là quả táo")
                .build();

        PracticeSessionSnapshotDto response = PracticeSessionSnapshotDto.builder()
                .sessionId("test-session-uuid-123")
                .deckId(10)
                .deckName("Core Vocabulary")
                .userId(1)
                .filterStatus("ALL")
                .totalQuestions(1)
                .createdAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(1800))
                .questions(List.of(qDto))
                .build();

        when(quizPracticeService.createPracticeSession(eq(10), any(CreateQuizSessionRequest.class), eq(1)))
                .thenReturn(response);

        mockMvc.perform(post("/api/v1/vocab/decks/10/practice/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.sessionId").value("test-session-uuid-123"))
                .andExpect(jsonPath("$.data.questions[0].correctOptionId").value("A"));
    }

    @Test
    @DisplayName("TC_PRACTICE_CTRL_02: POST /api/v1/vocab/practice/sessions/{sessionId}/submit - Nộp bài thành công 200 OK")
    void submitPracticeSession_success() throws Exception {
        SubmitPracticeRequest req = SubmitPracticeRequest.builder()
                .durationSeconds(65)
                .answers(List.of(
                        SubmitPracticeAnswerDto.builder().questionId(1).selectedOptionId("A").build()
                ))
                .build();

        SubmitPracticeResponse response = SubmitPracticeResponse.builder()
                .sessionId("test-session-uuid-123")
                .totalQuestions(1)
                .correctAnswers(1)
                .accuracyPercent(new BigDecimal("100.00"))
                .xpEarned(10)
                .currentStreak(3)
                .streakIncremented(true)
                .timeSpentSeconds(65)
                .wrongAnswers(Collections.emptyList())
                .build();

        when(quizPracticeService.submitPracticeSession(eq("test-session-uuid-123"), any(SubmitPracticeRequest.class), eq(1)))
                .thenReturn(response);

        mockMvc.perform(post("/api/v1/vocab/practice/sessions/test-session-uuid-123/submit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.xpEarned").value(10))
                .andExpect(jsonPath("$.data.accuracyPercent").value(100.00))
                .andExpect(jsonPath("$.data.currentStreak").value(3));
    }

    @Test
    @DisplayName("TC_PRACTICE_CTRL_03: Nộp bài phiên đã hết hạn -> Trả về HTTP 410 GONE")
    void submitPracticeSession_expired() throws Exception {
        SubmitPracticeRequest req = SubmitPracticeRequest.builder()
                .durationSeconds(65)
                .answers(List.of(
                        SubmitPracticeAnswerDto.builder().questionId(1).selectedOptionId("A").build()
                ))
                .build();

        when(quizPracticeService.submitPracticeSession(eq("expired-session"), any(SubmitPracticeRequest.class), eq(1)))
                .thenThrow(new AppException(ErrorCode.QUIZ_SESSION_EXPIRED));

        mockMvc.perform(post("/api/v1/vocab/practice/sessions/expired-session/submit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.code").value(ErrorCode.QUIZ_SESSION_EXPIRED.getCode()));
    }

    @Test
    @DisplayName("TC_PRACTICE_CTRL_04: Nộp bài trùng session nhưng lệch payload -> Trả về HTTP 409 CONFLICT")
    void submitPracticeSession_idempotencyConflict() throws Exception {
        SubmitPracticeRequest req = SubmitPracticeRequest.builder()
                .durationSeconds(65)
                .answers(List.of(
                        SubmitPracticeAnswerDto.builder().questionId(1).selectedOptionId("A").build()
                ))
                .build();

        when(quizPracticeService.submitPracticeSession(eq("conflict-session"), any(SubmitPracticeRequest.class), eq(1)))
                .thenThrow(new AppException(ErrorCode.QUIZ_IDEMPOTENCY_CONFLICT));

        mockMvc.perform(post("/api/v1/vocab/practice/sessions/conflict-session/submit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.QUIZ_IDEMPOTENCY_CONFLICT.getCode()));
    }
}
