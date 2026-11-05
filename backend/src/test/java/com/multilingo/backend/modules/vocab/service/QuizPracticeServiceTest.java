package com.multilingo.backend.modules.vocab.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.config.PracticeProperties;
import com.multilingo.backend.modules.gamification.dto.StudyActivityRecord;
import com.multilingo.backend.modules.gamification.dto.StudyActivitySummary;
import com.multilingo.backend.modules.gamification.service.StudyActivityService;
import com.multilingo.backend.modules.vocab.constant.QuizPracticeConstants;
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
@DisplayName("QuizPracticeService Unit Tests - Refactored Clean Practice Service")
class QuizPracticeServiceTest {

    @Mock
    private FlashcardDeckRepository deckRepository;

    @Mock
    private UserFlashcardRepository flashcardRepository;

    @Mock
    private PracticeCompletionReceiptRepository receiptRepository;

    @Mock
    private QuizQuestionGenerator questionGenerator;

    @Mock
    private StudyActivityService studyActivityService;

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    private PracticeProperties practiceProperties;
    private ObjectMapper objectMapper;
    private QuizPracticeServiceImpl quizPracticeService;

    private FlashcardDeck dummyDeck;
    private List<UserFlashcard> dummyCards;

    @BeforeEach
    void setUp() {
        practiceProperties = new PracticeProperties();
        practiceProperties.setSessionValidity(Duration.ofMinutes(30));

        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());

        quizPracticeService = new QuizPracticeServiceImpl(
                deckRepository,
                flashcardRepository,
                receiptRepository,
                questionGenerator,
                studyActivityService,
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
    @DisplayName("TC_PRACTICE_01: Tạo phiên thành công - Lưu snapshot Redis và trả về đề")
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

        when(questionGenerator.generatePracticeQuestions(eq(dummyCards), anyString(), anyInt(), any()))
                .thenReturn(questions);

        PracticeSessionSnapshotDto result = quizPracticeService.createPracticeSession(
                10, new CreateQuizSessionRequest(4, "ALL"), 1);

        assertThat(result).isNotNull();
        assertThat(result.getSessionId()).isNotBlank();
        assertThat(result.getDeckName()).isEqualTo("Core Vocabulary");
        assertThat(result.getTotalQuestions()).isEqualTo(4);
        verify(valueOperations).set(anyString(), anyString(), any(Duration.class));
    }

    @Test
    @DisplayName("TC_PRACTICE_02: IDOR khi tạo phiên bài của người khác -> Ném FORBIDDEN")
    void createPracticeSession_idorForbidden() {
        when(deckRepository.findById(10)).thenReturn(Optional.of(dummyDeck));

        assertThatThrownBy(() -> quizPracticeService.createPracticeSession(
                10, new CreateQuizSessionRequest(4, "ALL"), 999))
                .isInstanceOf(AppException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);
    }

    @Test
    @DisplayName("TC_PRACTICE_03: Nộp bài luyện tập thành công - Chấm điểm, cộng cố định 10 XP và lưu receipt")
    void submitPracticeSession_success() throws Exception {
        String sessionId = "sess-123";
        Instant now = Instant.now();

        PracticeSessionSnapshotDto snapshot = PracticeSessionSnapshotDto.builder()
                .sessionId(sessionId)
                .deckId(10)
                .userId(1)
                .totalQuestions(2)
                .createdAt(now)
                .expiresAt(now.plusSeconds(1800))
                .questions(List.of(
                        PracticeQuestionSnapshotDto.builder()
                                .questionId(1)
                                .cardId(100)
                                .targetWord("apple")
                                .correctOptionId("A")
                                .options(List.of(
                                        PracticeOptionDto.builder().optionId("A").text("quả táo").build(),
                                        PracticeOptionDto.builder().optionId("B").text("quả chuối").build()
                                ))
                                .build(),
                        PracticeQuestionSnapshotDto.builder()
                                .questionId(2)
                                .cardId(101)
                                .targetWord("banana")
                                .correctOptionId("B")
                                .options(List.of(
                                        PracticeOptionDto.builder().optionId("A").text("quả táo").build(),
                                        PracticeOptionDto.builder().optionId("B").text("quả chuối").build()
                                ))
                                .build()
                ))
                .build();

        when(receiptRepository.findByUserIdAndSessionId(1, sessionId)).thenReturn(Optional.empty());
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(QuizPracticeConstants.REDIS_SESSION_KEY_PREFIX + sessionId))
                .thenReturn(objectMapper.writeValueAsString(snapshot));

        StudyActivitySummary mockStudySummary = StudyActivitySummary.builder()
                .currentStreak(5)
                .streakIncrement(1)
                .build();
        when(studyActivityService.recordActivity(any(StudyActivityRecord.class))).thenReturn(mockStudySummary);

        // Nộp câu 1 đúng ("A"), câu 2 sai ("A" thay vì "B")
        SubmitPracticeRequest request = SubmitPracticeRequest.builder()
                .durationSeconds(45)
                .answers(List.of(
                        SubmitPracticeAnswerDto.builder().questionId(1).selectedOptionId("A").build(),
                        SubmitPracticeAnswerDto.builder().questionId(2).selectedOptionId("A").build()
                ))
                .build();

        SubmitPracticeResponse response = quizPracticeService.submitPracticeSession(sessionId, request, 1);

        assertThat(response).isNotNull();
        assertThat(response.getTotalQuestions()).isEqualTo(2);
        assertThat(response.getCorrectAnswers()).isEqualTo(1);
        assertThat(response.getAccuracyPercent()).isEqualByComparingTo(new BigDecimal("50.00"));
        assertThat(response.getXpEarned()).isEqualTo(QuizPracticeConstants.PRACTICE_COMPLETION_XP); // 10 XP
        assertThat(response.getCurrentStreak()).isEqualTo(5);
        assertThat(response.getWrongAnswers()).hasSize(1);
        assertThat(response.getWrongAnswers().get(0).getQuestionId()).isEqualTo(2);

        verify(receiptRepository).save(any(PracticeCompletionReceipt.class));
        verify(redisTemplate).delete(QuizPracticeConstants.REDIS_SESSION_KEY_PREFIX + sessionId);
    }

    @Test
    @DisplayName("TC_PRACTICE_04: Idempotency khi nộp lại phiên đã hoàn thành -> Trả kết quả cũ từ DB receipt")
    void submitPracticeSession_idempotentReturn() throws Exception {
        String sessionId = "sess-123";

        SubmitPracticeResponse cachedResponse = SubmitPracticeResponse.builder()
                .sessionId(sessionId)
                .totalQuestions(4)
                .correctAnswers(4)
                .accuracyPercent(new BigDecimal("100.00"))
                .xpEarned(10)
                .build();

        PracticeCompletionReceipt receipt = PracticeCompletionReceipt.builder()
                .userId(1)
                .sessionId(sessionId)
                .resultJson(objectMapper.writeValueAsString(cachedResponse))
                .build();

        when(receiptRepository.findByUserIdAndSessionId(1, sessionId)).thenReturn(Optional.of(receipt));

        SubmitPracticeRequest request = SubmitPracticeRequest.builder().durationSeconds(10).build();
        SubmitPracticeResponse response = quizPracticeService.submitPracticeSession(sessionId, request, 1);

        assertThat(response).isNotNull();
        assertThat(response.getSessionId()).isEqualTo(sessionId);
        assertThat(response.getCorrectAnswers()).isEqualTo(4);
        verifyNoInteractions(redisTemplate);
    }

    @Test
    @DisplayName("TC_PRACTICE_05: Phiên hết hạn trên Redis -> Ném QUIZ_SESSION_EXPIRED")
    void submitPracticeSession_expired() {
        String sessionId = "sess-expired";
        when(receiptRepository.findByUserIdAndSessionId(1, sessionId)).thenReturn(Optional.empty());
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(QuizPracticeConstants.REDIS_SESSION_KEY_PREFIX + sessionId)).thenReturn(null);

        SubmitPracticeRequest request = SubmitPracticeRequest.builder().durationSeconds(10).build();
        assertThatThrownBy(() -> quizPracticeService.submitPracticeSession(sessionId, request, 1))
                .isInstanceOf(AppException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.QUIZ_SESSION_EXPIRED);
    }
}
