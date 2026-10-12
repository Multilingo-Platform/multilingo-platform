package com.multilingo.backend.modules.vocab.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.config.PracticeProperties;
import com.multilingo.backend.modules.vocab.dto.request.CreateQuizSessionRequest;
import com.multilingo.backend.modules.vocab.dto.request.SubmitPracticeAnswerDto;
import com.multilingo.backend.modules.vocab.dto.request.SubmitPracticeRequest;
import com.multilingo.backend.modules.vocab.dto.response.*;
import com.multilingo.backend.modules.vocab.entity.FlashcardDeck;
import com.multilingo.backend.modules.vocab.entity.PracticeCompletionReceipt;
import com.multilingo.backend.modules.vocab.entity.UserFlashcard;
import com.multilingo.backend.modules.vocab.repository.FlashcardDeckRepository;
import com.multilingo.backend.modules.vocab.repository.PracticeCompletionReceiptRepository;
import com.multilingo.backend.modules.vocab.repository.UserFlashcardRepository;
import com.multilingo.backend.modules.vocab.service.impl.QuizPracticeServiceImpl;
import com.multilingo.backend.modules.vocab.service.quiz.PracticePayloadHasher;
import com.multilingo.backend.modules.vocab.service.quiz.QuizQuestionGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("QuizPracticeService Unit Tests - UC012.4 Practice Redis + Receipt")
class QuizPracticeServiceTest {

    @Mock
    private FlashcardDeckRepository deckRepository;

    @Mock
    private UserFlashcardRepository flashcardRepository;

    @Mock
    private PracticeCompletionReceiptRepository receiptRepository;

    @Mock
    private PracticeCompletionWriter completionWriter;

    @Mock
    private QuizQuestionGenerator questionGenerator;

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    private PracticePayloadHasher payloadHasher;
    private PracticeProperties practiceProperties;
    private ObjectMapper objectMapper;

    private QuizPracticeServiceImpl quizPracticeService;

    private FlashcardDeck dummyDeck;
    private List<UserFlashcard> dummyCards;

    @BeforeEach
    void setUp() {
        payloadHasher = new PracticePayloadHasher();
        practiceProperties = new PracticeProperties();
        practiceProperties.setSessionValidity(Duration.ofMinutes(30));

        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());

        quizPracticeService = new QuizPracticeServiceImpl(
                deckRepository,
                flashcardRepository,
                receiptRepository,
                completionWriter,
                questionGenerator,
                payloadHasher,
                practiceProperties,
                redisTemplate,
                objectMapper
        );

        dummyDeck = FlashcardDeck.builder()
                .userId(1)
                .name("Core Vocabulary")
                .targetLanguage("en")
                .sourceLanguage("vi")
                .build();
        dummyDeck.setId(10);

        dummyCards = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            UserFlashcard c = UserFlashcard.builder()
                    .userId(1)
                    .customWord("word" + i)
                    .customMeaning("nghĩa" + i)
                    .status("NEW")
                    .build();
            c.setId(100 + i);
            dummyCards.add(c);
        }
    }

    @Test
    @DisplayName("TC_PRACTICE_01: Tạo phiên thành công - Lưu snapshot Redis và trả về đề kèm đáp án đúng")
    void createPracticeSession_success() {
        when(deckRepository.findById(10)).thenReturn(Optional.of(dummyDeck));
        when(flashcardRepository.findAllByDeckIdAndUserIdOrderByCreatedAtDesc(10, 1)).thenReturn(dummyCards);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        List<PracticeQuestionSnapshotDto> questions = List.of(
                PracticeQuestionSnapshotDto.builder()
                        .questionId(1)
                        .cardId(100)
                        .targetWord("word0")
                        .correctOptionId("A")
                        .options(List.of(PracticeOptionDto.builder().optionId("A").text("nghĩa0").build()))
                        .build(),
                PracticeQuestionSnapshotDto.builder()
                        .questionId(2)
                        .cardId(101)
                        .targetWord("word1")
                        .correctOptionId("B")
                        .options(List.of(PracticeOptionDto.builder().optionId("B").text("nghĩa1").build()))
                        .build(),
                PracticeQuestionSnapshotDto.builder()
                        .questionId(3)
                        .cardId(102)
                        .targetWord("word2")
                        .correctOptionId("C")
                        .options(List.of(PracticeOptionDto.builder().optionId("C").text("nghĩa2").build()))
                        .build(),
                PracticeQuestionSnapshotDto.builder()
                        .questionId(4)
                        .cardId(103)
                        .targetWord("word3")
                        .correctOptionId("D")
                        .options(List.of(PracticeOptionDto.builder().optionId("D").text("nghĩa3").build()))
                        .build()
        );

        when(questionGenerator.generatePracticeQuestions(anyList(), anyString(), anyInt(), any(Random.class)))
                .thenReturn(questions);

        CreateQuizSessionRequest req = CreateQuizSessionRequest.builder().limit(10).filterStatus("ALL").build();
        PracticeSessionSnapshotDto snapshot = quizPracticeService.createPracticeSession(10, req, 1);

        assertThat(snapshot).isNotNull();
        assertThat(snapshot.getSessionId()).isNotEmpty();
        assertThat(snapshot.getDeckId()).isEqualTo(10);
        assertThat(snapshot.getTotalQuestions()).isEqualTo(4);
        assertThat(snapshot.getQuestions().get(0).getCorrectOptionId()).isEqualTo("A");

        verify(valueOperations).set(startsWith("practice:session:"), anyString(), eq(Duration.ofMinutes(30)));
    }

    @Test
    @DisplayName("TC_PRACTICE_02: Tạo phiên thất bại khi deckId không thuộc về userId -> Ném FORBIDDEN (403)")
    void createPracticeSession_forbidden() {
        FlashcardDeck otherDeck = FlashcardDeck.builder().userId(99).name("Other Deck").build();
        otherDeck.setId(10);
        when(deckRepository.findById(10)).thenReturn(Optional.of(otherDeck));

        CreateQuizSessionRequest req = new CreateQuizSessionRequest();
        assertThatThrownBy(() -> quizPracticeService.createPracticeSession(10, req, 1))
                .isInstanceOf(AppException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);
    }

    @Test
    @DisplayName("TC_PRACTICE_03: Nộp bài thành công - Ủy thác cho CompletionWriter và nhận cố định +10 XP")
    void submitPracticeSession_success() throws Exception {
        String sessionId = "sess-uuid-123";
        SubmitPracticeRequest req = SubmitPracticeRequest.builder()
                .durationSeconds(45)
                .answers(List.of(
                        SubmitPracticeAnswerDto.builder().questionId(1).selectedOptionId("A").build()
                ))
                .build();

        PracticeSessionSnapshotDto snapshot = PracticeSessionSnapshotDto.builder()
                .sessionId(sessionId)
                .userId(1)
                .deckId(10)
                .totalQuestions(1)
                .expiresAt(Instant.now().plusSeconds(600))
                .questions(List.of(
                        PracticeQuestionSnapshotDto.builder()
                                .questionId(1)
                                .targetWord("apple")
                                .correctOptionId("A")
                                .options(List.of(PracticeOptionDto.builder().optionId("A").text("Táo").build()))
                                .build()
                ))
                .build();

        when(receiptRepository.findByUserIdAndSessionId(1, sessionId)).thenReturn(Optional.empty());
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("practice:session:" + sessionId)).thenReturn(objectMapper.writeValueAsString(snapshot));

        SubmitPracticeResponse expectedResponse = SubmitPracticeResponse.builder()
                .sessionId(sessionId)
                .totalQuestions(1)
                .correctAnswers(1)
                .accuracyPercent(new BigDecimal("100.00"))
                .xpEarned(10)
                .currentStreak(2)
                .streakIncremented(true)
                .timeSpentSeconds(45)
                .wrongAnswers(Collections.emptyList())
                .build();

        when(completionWriter.record(eq(1), any(PracticeSessionSnapshotDto.class), eq(req), anyString()))
                .thenReturn(expectedResponse);

        SubmitPracticeResponse result = quizPracticeService.submitPracticeSession(sessionId, req, 1);

        assertThat(result).isNotNull();
        assertThat(result.getXpEarned()).isEqualTo(10);
        assertThat(result.getCorrectAnswers()).isEqualTo(1);
        verify(completionWriter).record(eq(1), any(PracticeSessionSnapshotDto.class), eq(req), anyString());
    }

    @Test
    @DisplayName("TC_PRACTICE_04: Nộp bài lặp với cùng payload -> Idempotent Replay trả kết quả cũ mà không gọi Writer")
    void submitPracticeSession_idempotentReplay() throws Exception {
        String sessionId = "sess-uuid-123";
        SubmitPracticeRequest req = SubmitPracticeRequest.builder()
                .durationSeconds(45)
                .answers(List.of(
                        SubmitPracticeAnswerDto.builder().questionId(1).selectedOptionId("A").build()
                ))
                .build();

        String canonicalHash = payloadHasher.computeCanonicalHash(sessionId, 45, req.getAnswers());

        SubmitPracticeResponse cachedResponse = SubmitPracticeResponse.builder()
                .sessionId(sessionId)
                .totalQuestions(1)
                .correctAnswers(1)
                .xpEarned(10)
                .build();

        PracticeCompletionReceipt receipt = PracticeCompletionReceipt.builder()
                .userId(1)
                .sessionId(sessionId)
                .requestHash(canonicalHash)
                .resultJson(objectMapper.writeValueAsString(cachedResponse))
                .build();

        when(receiptRepository.findByUserIdAndSessionId(1, sessionId)).thenReturn(Optional.of(receipt));

        SubmitPracticeResponse result = quizPracticeService.submitPracticeSession(sessionId, req, 1);

        assertThat(result).isNotNull();
        assertThat(result.getSessionId()).isEqualTo(sessionId);
        verifyNoInteractions(completionWriter);
        verifyNoInteractions(redisTemplate);
    }

    @Test
    @DisplayName("TC_PRACTICE_05: Nộp lại cùng sessionId nhưng khác payload -> Ném QUIZ_IDEMPOTENCY_CONFLICT (409)")
    void submitPracticeSession_hashConflict() {
        String sessionId = "sess-uuid-123";
        SubmitPracticeRequest req = SubmitPracticeRequest.builder()
                .durationSeconds(45)
                .answers(List.of(
                        SubmitPracticeAnswerDto.builder().questionId(1).selectedOptionId("B").build() // Khác đáp án
                ))
                .build();

        PracticeCompletionReceipt receipt = PracticeCompletionReceipt.builder()
                .userId(1)
                .sessionId(sessionId)
                .requestHash("different-saved-hash")
                .resultJson("{}")
                .build();

        when(receiptRepository.findByUserIdAndSessionId(1, sessionId)).thenReturn(Optional.of(receipt));

        assertThatThrownBy(() -> quizPracticeService.submitPracticeSession(sessionId, req, 1))
                .isInstanceOf(AppException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.QUIZ_IDEMPOTENCY_CONFLICT);

        verifyNoInteractions(completionWriter);
    }

    @Test
    @DisplayName("TC_PRACTICE_06: Nộp bài khi Redis key đã hết hạn / không có snapshot -> Ném QUIZ_SESSION_EXPIRED (410)")
    void submitPracticeSession_expired() {
        String sessionId = "expired-sess";
        SubmitPracticeRequest req = SubmitPracticeRequest.builder()
                .durationSeconds(30)
                .answers(List.of(
                        SubmitPracticeAnswerDto.builder().questionId(1).selectedOptionId("A").build()
                ))
                .build();

        when(receiptRepository.findByUserIdAndSessionId(1, sessionId)).thenReturn(Optional.empty());
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("practice:session:" + sessionId)).thenReturn(null);

        assertThatThrownBy(() -> quizPracticeService.submitPracticeSession(sessionId, req, 1))
                .isInstanceOf(AppException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.QUIZ_SESSION_EXPIRED);
    }

    @Test
    @DisplayName("TC_PRACTICE_07: Nộp bài nhưng có câu chưa chọn đáp án (selectedOptionId null hoặc blank) -> Ném QUIZ_INVALID_REQUEST")
    void submitPracticeSession_missingSelectedOption_throwsQuizInvalidRequest() throws Exception {
        String sessionId = "sess-missing-option";
        PracticeSessionSnapshotDto snapshot = PracticeSessionSnapshotDto.builder()
                .sessionId(sessionId)
                .userId(1)
                .deckId(10)
                .expiresAt(Instant.now().plusSeconds(600))
                .totalQuestions(1)
                .questions(List.of(
                        PracticeQuestionSnapshotDto.builder()
                                .questionId(1)
                                .targetWord("apple")
                                .correctOptionId("A")
                                .options(List.of(PracticeOptionDto.builder().optionId("A").text("Táo").build()))
                                .build()
                ))
                .build();

        SubmitPracticeRequest req = SubmitPracticeRequest.builder()
                .durationSeconds(20)
                .answers(List.of(
                        SubmitPracticeAnswerDto.builder().questionId(1).selectedOptionId(null).build()
                ))
                .build();

        when(receiptRepository.findByUserIdAndSessionId(1, sessionId)).thenReturn(Optional.empty());
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("practice:session:" + sessionId)).thenReturn(objectMapper.writeValueAsString(snapshot));

        assertThatThrownBy(() -> quizPracticeService.submitPracticeSession(sessionId, req, 1))
                .isInstanceOf(AppException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.QUIZ_INVALID_REQUEST);
    }
}
