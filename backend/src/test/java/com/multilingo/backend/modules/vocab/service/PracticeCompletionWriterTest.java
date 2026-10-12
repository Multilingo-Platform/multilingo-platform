package com.multilingo.backend.modules.vocab.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.config.PracticeProperties;
import com.multilingo.backend.modules.gamification.dto.StudyActivityRecord;
import com.multilingo.backend.modules.gamification.dto.StudyActivitySummary;
import com.multilingo.backend.modules.gamification.service.StudyActivityService;
import com.multilingo.backend.modules.vocab.dto.request.SubmitPracticeAnswerDto;
import com.multilingo.backend.modules.vocab.dto.request.SubmitPracticeRequest;
import com.multilingo.backend.modules.vocab.dto.response.*;
import com.multilingo.backend.modules.vocab.entity.PracticeCompletionReceipt;
import com.multilingo.backend.modules.vocab.repository.PracticeCompletionReceiptRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("PracticeCompletionWriter Unit Tests - Transaction & Idempotency Boundary")
class PracticeCompletionWriterTest {

    @Mock
    private PracticeCompletionReceiptRepository receiptRepository;

    @Mock
    private StudyActivityService studyActivityService;

    @Mock
    private StringRedisTemplate redisTemplate;

    private PracticeProperties practiceProperties;
    private ObjectMapper objectMapper;
    private PracticeCompletionWriter writer;

    @BeforeEach
    void setUp() {
        practiceProperties = new PracticeProperties();
        practiceProperties.setSessionValidity(Duration.ofMinutes(30));
        practiceProperties.setReceiptRetention(Duration.ofHours(24));
        practiceProperties.setCompletionTransactionTimeout(Duration.ofSeconds(30));
        practiceProperties.setCleanupSafetyMargin(Duration.ofMinutes(1));

        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());

        com.multilingo.backend.modules.vocab.mapper.QuizPracticeMapper quizPracticeMapper =
                org.mapstruct.factory.Mappers.getMapper(com.multilingo.backend.modules.vocab.mapper.QuizPracticeMapper.class);

        writer = new PracticeCompletionWriter(
                receiptRepository,
                studyActivityService,
                practiceProperties,
                redisTemplate,
                objectMapper,
                quizPracticeMapper,
                new com.multilingo.backend.modules.vocab.service.quiz.QuizScorer()
        );
    }

    @Test
    @DisplayName("TC_WRITER_01: Ghi nhận thành công lần đầu - Reserve được receipt, cộng +10 XP, floor phút")
    void record_success() {
        String sessionId = "sess-123";
        Integer userId = 1;
        String requestHash = "canonical-hash-abc";

        PracticeQuestionSnapshotDto q1 = PracticeQuestionSnapshotDto.builder()
                .questionId(1)
                .cardId(101)
                .targetWord("ubiquitous")
                .options(List.of(
                        PracticeOptionDto.builder().optionId("A").text("Hiếm gặp").build(),
                        PracticeOptionDto.builder().optionId("B").text("Phổ biến").build()
                ))
                .correctOptionId("B")
                .build();

        PracticeSessionSnapshotDto snapshot = PracticeSessionSnapshotDto.builder()
                .sessionId(sessionId)
                .userId(userId)
                .deckId(10)
                .totalQuestions(1)
                .expiresAt(Instant.now().plusSeconds(600))
                .questions(List.of(q1))
                .build();

        SubmitPracticeRequest request = SubmitPracticeRequest.builder()
                .durationSeconds(125) // 2 phút 5 giây -> floor = 2 phút
                .answers(List.of(
                        SubmitPracticeAnswerDto.builder().questionId(1).selectedOptionId("B").build()
                ))
                .build();

        when(receiptRepository.reserveReceipt(eq(userId), eq(sessionId), eq(requestHash), anyString(), any(Instant.class), any(Instant.class), any(Instant.class), any(Instant.class)))
                .thenReturn(1);

        StudyActivitySummary summary = StudyActivitySummary.builder()
                .currentStreak(4)
                .streakIncrement(1)
                .build();

        when(studyActivityService.recordActivity(any(StudyActivityRecord.class))).thenReturn(summary);

        SubmitPracticeResponse response = writer.record(userId, snapshot, request, requestHash);

        assertThat(response).isNotNull();
        assertThat(response.getSessionId()).isEqualTo(sessionId);
        assertThat(response.getCorrectAnswers()).isEqualTo(1);
        assertThat(response.getXpEarned()).isEqualTo(10);
        assertThat(response.getCurrentStreak()).isEqualTo(4);
        assertThat(response.getStreakIncremented()).isTrue();
        assertThat(response.getTimeSpentSeconds()).isEqualTo(125);
        assertThat(response.getWrongAnswers()).isEmpty();

        // Kiểm tra recordActivity nhận đúng studyMinutes = 2 (floor của 125/60), cardsReviewed = 0 (không làm tăng SRS), questionsAnswered = 1
        verify(studyActivityService).recordActivity(argThat(r ->
                r.getStudyMinutes() == 2 && r.getXpEarned() == 10 && "PRACTICE".equals(r.getActivityType())
                        && r.getCardsReviewed() == 0 && r.getQuestionsAnswered() == 1
        ));
        verify(receiptRepository).updateResultJson(eq(userId), eq(sessionId), anyString(), any(Instant.class));
    }

    @Test
    @DisplayName("TC_WRITER_02: Trùng receipt khi concurrency - Trả kết quả cũ nếu cùng hash")
    void record_concurrencyReplay() throws Exception {
        String sessionId = "sess-123";
        Integer userId = 1;
        String requestHash = "canonical-hash-abc";

        PracticeSessionSnapshotDto snapshot = PracticeSessionSnapshotDto.builder()
                .sessionId(sessionId)
                .userId(userId)
                .expiresAt(Instant.now().plusSeconds(600))
                .build();

        SubmitPracticeRequest request = SubmitPracticeRequest.builder()
                .durationSeconds(60)
                .answers(List.of(SubmitPracticeAnswerDto.builder().questionId(1).selectedOptionId("A").build()))
                .build();

        when(receiptRepository.reserveReceipt(anyInt(), anyString(), anyString(), anyString(), any(), any(), any(), any()))
                .thenReturn(0);

        SubmitPracticeResponse existingResult = SubmitPracticeResponse.builder()
                .sessionId(sessionId)
                .totalQuestions(1)
                .correctAnswers(1)
                .xpEarned(10)
                .build();

        PracticeCompletionReceipt receipt = PracticeCompletionReceipt.builder()
                .userId(userId)
                .sessionId(sessionId)
                .requestHash(requestHash)
                .resultJson(objectMapper.writeValueAsString(existingResult))
                .build();

        when(receiptRepository.findByUserIdAndSessionId(userId, sessionId)).thenReturn(Optional.of(receipt));

        SubmitPracticeResponse response = writer.record(userId, snapshot, request, requestHash);

        assertThat(response).isNotNull();
        assertThat(response.getSessionId()).isEqualTo(sessionId);
        verifyNoInteractions(studyActivityService);
    }

    @Test
    @DisplayName("TC_WRITER_03: Trùng receipt nhưng khác hash - Ném QUIZ_IDEMPOTENCY_CONFLICT (409)")
    void record_concurrencyHashMismatch() {
        String sessionId = "sess-123";
        Integer userId = 1;
        String requestHash = "canonical-hash-abc";

        PracticeSessionSnapshotDto snapshot = PracticeSessionSnapshotDto.builder()
                .sessionId(sessionId)
                .userId(userId)
                .expiresAt(Instant.now().plusSeconds(600))
                .build();

        SubmitPracticeRequest request = SubmitPracticeRequest.builder()
                .durationSeconds(60)
                .answers(List.of(SubmitPracticeAnswerDto.builder().questionId(1).selectedOptionId("A").build()))
                .build();

        when(receiptRepository.reserveReceipt(anyInt(), anyString(), anyString(), anyString(), any(), any(), any(), any()))
                .thenReturn(0);

        PracticeCompletionReceipt receipt = PracticeCompletionReceipt.builder()
                .userId(userId)
                .sessionId(sessionId)
                .requestHash("different-saved-hash")
                .resultJson("{}")
                .build();

        when(receiptRepository.findByUserIdAndSessionId(userId, sessionId)).thenReturn(Optional.of(receipt));

        assertThatThrownBy(() -> writer.record(userId, snapshot, request, requestHash))
                .isInstanceOf(AppException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.QUIZ_IDEMPOTENCY_CONFLICT);

        verifyNoInteractions(studyActivityService);
    }

    @Test
    @DisplayName("Mixed answers retain rounded accuracy and wrong-answer details")
    void record_mixedAnswersPreserveResult() throws Exception {
        String sessionId = "mixed-session";
        List<PracticeQuestionSnapshotDto> questions = java.util.stream.IntStream.rangeClosed(1, 3)
                .mapToObj(id -> PracticeQuestionSnapshotDto.builder()
                        .questionId(id).cardId(100 + id).targetWord("word" + id)
                        .correctOptionId("B")
                        .options(List.of(new PracticeOptionDto("A", "wrong"),
                                new PracticeOptionDto("B", "meaning" + id)))
                        .build())
                .toList();
        PracticeSessionSnapshotDto snapshot = PracticeSessionSnapshotDto.builder()
                .sessionId(sessionId).userId(1).totalQuestions(3)
                .expiresAt(Instant.now().plusSeconds(600)).questions(questions).build();
        SubmitPracticeRequest request = SubmitPracticeRequest.builder().durationSeconds(59)
                .answers(List.of(
                        SubmitPracticeAnswerDto.builder().questionId(3).selectedOptionId(" b ").build(),
                        SubmitPracticeAnswerDto.builder().questionId(1).selectedOptionId("B").build(),
                        SubmitPracticeAnswerDto.builder().questionId(2).selectedOptionId("a").build()))
                .build();
        when(receiptRepository.reserveReceipt(anyInt(), anyString(), anyString(), anyString(),
                any(), any(), any(), any())).thenReturn(1);
        when(studyActivityService.recordActivity(any())).thenReturn(
                StudyActivitySummary.builder().currentStreak(4).streakIncrement(0).build());

        SubmitPracticeResponse response = writer.record(1, snapshot, request, "mixed-hash");

        assertThat(response.getCorrectAnswers()).isEqualTo(2);
        assertThat(response.getAccuracyPercent()).isEqualByComparingTo("66.67");
        assertThat(response.getXpEarned()).isEqualTo(10);
        assertThat(response.getStreakIncremented()).isFalse();
        assertThat(response.getWrongAnswers()).hasSize(1);
        assertThat(response.getWrongAnswers().getFirst().getQuestionId()).isEqualTo(2);
        assertThat(response.getWrongAnswers().getFirst().getSelectedOptionId()).isEqualTo("a");
        assertThat(response.getWrongAnswers().getFirst().getCorrectMeaning()).isEqualTo("meaning2");
        org.mockito.ArgumentCaptor<String> savedJson = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(receiptRepository).updateResultJson(eq(1), eq(sessionId), savedJson.capture(), any());
        SubmitPracticeResponse persisted = objectMapper.readValue(savedJson.getValue(), SubmitPracticeResponse.class);
        assertThat(persisted).usingRecursiveComparison().isEqualTo(response);
    }
}
