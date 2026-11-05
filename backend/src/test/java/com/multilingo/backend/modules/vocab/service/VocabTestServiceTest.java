package com.multilingo.backend.modules.vocab.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.config.VocabTestProperties;
import com.multilingo.backend.modules.gamification.dto.StudyActivityRecord;
import com.multilingo.backend.modules.gamification.dto.StudyActivitySummary;
import com.multilingo.backend.modules.gamification.service.StudyActivityService;
import com.multilingo.backend.modules.vocab.dto.request.AutoSaveProgressRequest;
import com.multilingo.backend.modules.vocab.dto.request.GenerateVocabTestRequest;
import com.multilingo.backend.modules.vocab.dto.request.SubmitVocabTestRequest;
import com.multilingo.backend.modules.vocab.dto.request.VocabTestAnswerItemDto;
import com.multilingo.backend.modules.vocab.dto.response.*;
import com.multilingo.backend.modules.vocab.entity.FlashcardDeck;
import com.multilingo.backend.modules.vocab.entity.UserFlashcard;
import com.multilingo.backend.modules.vocab.entity.VocabTestAttempt;
import com.multilingo.backend.modules.vocab.repository.FlashcardDeckRepository;
import com.multilingo.backend.modules.vocab.repository.UserFlashcardRepository;
import com.multilingo.backend.modules.vocab.repository.VocabTestAttemptRepository;
import com.multilingo.backend.modules.vocab.service.impl.VocabTestServiceImpl;
import com.multilingo.backend.modules.vocab.service.quiz.QuizQuestionGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("VocabTestService Unit Tests - Refactored Clean CBT Test Service")
class VocabTestServiceTest {

    @Mock
    private VocabTestAttemptRepository vocabTestAttemptRepository;

    @Mock
    private FlashcardDeckRepository flashcardDeckRepository;

    @Mock
    private UserFlashcardRepository userFlashcardRepository;

    @Spy
    private QuizQuestionGenerator quizQuestionGenerator = new QuizQuestionGenerator();

    @Mock
    private VocabTestProperties vocabTestProperties;

    @Mock
    private StudyActivityService studyActivityService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper().registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());

    @InjectMocks
    private VocabTestServiceImpl vocabTestService;

    private FlashcardDeck mockDeck;
    private List<UserFlashcard> mockCards;

    @BeforeEach
    void setUp() {
        mockDeck = FlashcardDeck.builder()
                .name("Core Vocabulary")
                .targetLanguage("EN")
                .sourceLanguage("VI")
                .build();
        mockDeck.setId(10);

        mockCards = List.of(
                UserFlashcard.builder().deck(mockDeck).userId(1).customWord("apple").customMeaning("quả táo").build(),
                UserFlashcard.builder().deck(mockDeck).userId(1).customWord("banana").customMeaning("quả chuối").build(),
                UserFlashcard.builder().deck(mockDeck).userId(1).customWord("orange").customMeaning("quả cam").build(),
                UserFlashcard.builder().deck(mockDeck).userId(1).customWord("grape").customMeaning("quả nho").build(),
                UserFlashcard.builder().deck(mockDeck).userId(1).customWord("lemon").customMeaning("quả chanh").build()
        );
        for (int i = 0; i < mockCards.size(); i++) {
            mockCards.get(i).setId(100 + i);
        }
    }

    @Test
    @DisplayName("generateTest: Sinh đề thi thành công, giấu kín đáp án đúng và lời giải trong DTO trả về")
    void generateTest_success_zero_answer_exposure() {
        when(flashcardDeckRepository.findByIdAndUserId(10, 1)).thenReturn(Optional.of(mockDeck));
        when(userFlashcardRepository.findAllByDeckIdAndUserIdOrderByCreatedAtDesc(10, 1)).thenReturn(mockCards);
        when(vocabTestProperties.getSecondsPerQuestion()).thenReturn(60);

        GenerateVocabTestRequest request = GenerateVocabTestRequest.builder().limit(5).build();
        VocabTestExamDto result = vocabTestService.generateTest(10, 1, request);

        assertThat(result).isNotNull();
        assertThat(result.getTestToken()).startsWith("test-");
        assertThat(result.getTotalQuestions()).isEqualTo(5);
        assertThat(result.getTimeLimitSeconds()).isEqualTo(300);
        assertThat(result.getQuestions()).hasSize(5);

        for (VocabTestQuestionDto q : result.getQuestions()) {
            assertThat(q.getWord()).isNotBlank();
            assertThat(q.getOptions()).hasSize(4);
        }

        verify(vocabTestAttemptRepository).save(argThat(attempt ->
                attempt.getStatus().equals("IN_PROGRESS") &&
                attempt.getProgressVersion() == 0 &&
                attempt.getQuestionsSnapshot().contains("apple")
        ));
    }

    @Test
    @DisplayName("generateTest: Thất bại khi bộ thẻ có dưới 4 từ vựng")
    void generateTest_fails_when_insufficient_cards() {
        when(flashcardDeckRepository.findByIdAndUserId(10, 1)).thenReturn(Optional.of(mockDeck));
        when(userFlashcardRepository.findAllByDeckIdAndUserIdOrderByCreatedAtDesc(10, 1)).thenReturn(mockCards.subList(0, 3));

        assertThatThrownBy(() -> vocabTestService.generateTest(10, 1, new GenerateVocabTestRequest()))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode()).isEqualTo(ErrorCode.VOCAB_TEST_INSUFFICIENT_CARDS));
    }

    @Test
    @DisplayName("resumeTest: Khôi phục bài thi thành công khi F5")
    void resumeTest_success() {
        Instant now = Instant.now();
        VocabTestAttempt attempt = VocabTestAttempt.builder()
                .userId(1)
                .deckId(10)
                .deckNameSnapshot("Core Vocabulary")
                .testToken("token-resume-1")
                .status("IN_PROGRESS")
                .progressVersion(2)
                .totalQuestions(5)
                .timeLimitSeconds(300)
                .startedAt(now.minusSeconds(60))
                .expiresAt(now.plusSeconds(240))
                .questionsSnapshot("[{\"questionNumber\":1,\"cardId\":100,\"word\":\"apple\",\"options\":[{\"key\":\"A\",\"text\":\"quả táo\"}],\"correctKey\":\"A\",\"explanation\":\"Giải thích\"}]")
                .answersProgress("[{\"questionNumber\":1,\"selectedKey\":\"A\",\"flagged\":false}]")
                .build();

        when(vocabTestAttemptRepository.findByTestToken("token-resume-1")).thenReturn(Optional.of(attempt));
        when(vocabTestProperties.getSubmissionGraceSeconds()).thenReturn(10);

        VocabTestResumeResponse response = vocabTestService.resumeTest("token-resume-1", 1);
        assertThat(response.getTestToken()).isEqualTo("token-resume-1");
        assertThat(response.getProgressVersion()).isEqualTo(2);
        assertThat(response.getQuestions()).hasSize(1);
        assertThat(response.getSavedAnswers()).hasSize(1);
        assertThat(response.getSavedAnswers().get(0).getSelectedKey()).isEqualTo("A");
        assertThat(response.isDeadlinePassed()).isFalse();
    }

    @Test
    @DisplayName("saveProgress: Lưu tiến độ câu trả lời vào database mượt mà")
    void saveProgress_success() {
        Instant now = Instant.now();
        VocabTestAttempt attempt = VocabTestAttempt.builder()
                .userId(1)
                .testToken("token-save-1")
                .status("IN_PROGRESS")
                .progressVersion(0)
                .expiresAt(now.plusSeconds(300))
                .answersProgress("[]")
                .build();

        when(vocabTestAttemptRepository.findByTestToken("token-save-1")).thenReturn(Optional.of(attempt));
        when(vocabTestProperties.getSubmissionGraceSeconds()).thenReturn(10);

        AutoSaveProgressRequest request = AutoSaveProgressRequest.builder()
                .expectedVersion(0)
                .answers(List.of(VocabTestAnswerItemDto.builder().questionNumber(1).selectedKey("A").build()))
                .build();

        AutoSaveProgressResponse response = vocabTestService.saveProgress("token-save-1", 1, request);
        assertThat(response.getProgressVersion()).isEqualTo(1);
        verify(vocabTestAttemptRepository).save(attempt);
    }

    @Test
    @DisplayName("saveProgress: Báo lỗi khi bài thi đã hoàn thành")
    void saveProgress_alreadyFinished() {
        VocabTestAttempt attempt = VocabTestAttempt.builder()
                .userId(1)
                .testToken("token-finished")
                .status("COMPLETED")
                .build();

        when(vocabTestAttemptRepository.findByTestToken("token-finished")).thenReturn(Optional.of(attempt));

        AutoSaveProgressRequest request = AutoSaveProgressRequest.builder().expectedVersion(1).build();
        assertThatThrownBy(() -> vocabTestService.saveProgress("token-finished", 1, request))
                .isInstanceOf(AppException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.VOCAB_TEST_ALREADY_FINISHED);
    }

    @Test
    @DisplayName("submitTest: Chấm điểm thành công, tính thang điểm 100, cộng 20 XP và lưu streak")
    void submitTest_success_awards_xp_and_streak() {
        Instant now = Instant.now();
        String questionsJson = "[" +
                "{\"questionNumber\":1,\"cardId\":100,\"word\":\"apple\",\"correctKey\":\"A\"}," +
                "{\"questionNumber\":2,\"cardId\":101,\"word\":\"banana\",\"correctKey\":\"B\"}" +
                "]";

        VocabTestAttempt attempt = VocabTestAttempt.builder()
                .userId(1)
                .deckId(10)
                .deckNameSnapshot("Core Vocabulary")
                .testToken("token-submit-1")
                .status("IN_PROGRESS")
                .progressVersion(1)
                .totalQuestions(2)
                .timeLimitSeconds(120)
                .startedAt(now.minusSeconds(50))
                .expiresAt(now.plusSeconds(70))
                .questionsSnapshot(questionsJson)
                .answersProgress("[]")
                .build();

        when(vocabTestAttemptRepository.findForUpdateByTestToken("token-submit-1")).thenReturn(Optional.of(attempt));
        when(vocabTestProperties.getSubmissionGraceSeconds()).thenReturn(10);

        StudyActivitySummary mockSummary = StudyActivitySummary.builder()
                .currentStreak(3)
                .streakIncrement(1)
                .build();
        when(studyActivityService.recordActivity(any(StudyActivityRecord.class))).thenReturn(mockSummary);

        SubmitVocabTestRequest request = SubmitVocabTestRequest.builder()
                .expectedVersion(1)
                .answers(List.of(
                        VocabTestAnswerItemDto.builder().questionNumber(1).selectedKey("A").build(),
                        VocabTestAnswerItemDto.builder().questionNumber(2).selectedKey("C").build() // Sai
                ))
                .build();

        VocabTestResultResponse result = vocabTestService.submitTest("token-submit-1", 1, request);

        assertThat(result).isNotNull();
        assertThat(result.getScore()).isEqualTo(50); // 1/2 đúng = 50%
        assertThat(result.getCorrectCount()).isEqualTo(1);
        assertThat(result.getTotalQuestions()).isEqualTo(2);
        assertThat(result.getXpEarned()).isEqualTo(20);
        assertThat(result.getCurrentStreak()).isEqualTo(3);
        assertThat(result.isStreakIncremented()).isTrue();
        assertThat(result.getStatus()).isEqualTo("COMPLETED");

        verify(vocabTestAttemptRepository).save(argThat(a ->
                a.getStatus().equals("COMPLETED") && a.getScore() == 50
        ));
    }

    @Test
    @DisplayName("reviewAnswers: Trả về chi tiết đáp án và giải thích")
    void reviewAnswers_success() {
        VocabTestAttempt attempt = VocabTestAttempt.builder()
                .userId(1)
                .deckId(10)
                .deckNameSnapshot("Core Vocabulary")
                .testToken("token-review-1")
                .status("COMPLETED")
                .score(100)
                .correctCount(1)
                .totalQuestions(1)
                .xpEarned(20)
                .timeSpentSeconds(30)
                .startedAt(Instant.now().minusSeconds(60))
                .submittedAt(Instant.now())
                .questionsSnapshot("[{\"questionNumber\":1,\"cardId\":100,\"word\":\"apple\",\"correctKey\":\"A\",\"explanation\":\"Quả táo thơm ngon\"}]")
                .answersProgress("[{\"questionNumber\":1,\"selectedKey\":\"A\"}]")
                .build();

        when(vocabTestAttemptRepository.findByTestToken("token-review-1")).thenReturn(Optional.of(attempt));

        VocabTestReviewDetailDto review = vocabTestService.reviewAnswers("token-review-1", 1);
        assertThat(review).isNotNull();
        assertThat(review.getScore()).isEqualTo(100);
        assertThat(review.getReviewItems()).hasSize(1);
        assertThat(review.getReviewItems().get(0).isCorrect()).isTrue();
        assertThat(review.getReviewItems().get(0).getExplanation()).isEqualTo("Quả táo thơm ngon");
    }
}
