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
import com.multilingo.backend.modules.vocab.service.quiz.TestProgressHasher;
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
@DisplayName("VocabTestService Unit Tests - Full Lifecycle, CAS & Gamification")
class VocabTestServiceTest {

    @Mock
    private VocabTestAttemptRepository vocabTestAttemptRepository;

    @Mock
    private FlashcardDeckRepository flashcardDeckRepository;

    @Mock
    private UserFlashcardRepository userFlashcardRepository;

    @Mock
    private VocabTestProperties vocabTestProperties;

    @Spy
    private TestProgressHasher testProgressHasher = new TestProgressHasher();

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

        // Kiểm tra DTO không chứa trường đáp án
        for (VocabTestQuestionDto q : result.getQuestions()) {
            assertThat(q.getWord()).isNotBlank();
            assertThat(q.getOptions()).hasSize(4);
        }

        // Đảm bảo attempt được lưu với status IN_PROGRESS
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
    @DisplayName("saveProgress: Cập nhật version thành công qua CAS khi expectedVersion khớp")
    void saveProgress_cas_success() {
        when(vocabTestProperties.getSubmissionGraceSeconds()).thenReturn(10);
        when(vocabTestAttemptRepository.updateAnswersProgressCas(
                eq("token-cas-1"), eq(1), eq(0), anyString(), anyString(), any(Instant.class), any(Instant.class)
        )).thenReturn(1);

        AutoSaveProgressRequest request = AutoSaveProgressRequest.builder()
                .expectedVersion(0)
                .answers(List.of(VocabTestAnswerItemDto.builder().questionNumber(1).selectedKey("A").build()))
                .build();

        AutoSaveProgressResponse response = vocabTestService.saveProgress("token-cas-1", 1, request);
        assertThat(response.getProgressVersion()).isEqualTo(1);
    }

    @Test
    @DisplayName("saveProgress: Báo lỗi xung đột 409 khi expectedVersion không khớp")
    void saveProgress_cas_conflict_409() {
        when(vocabTestProperties.getSubmissionGraceSeconds()).thenReturn(10);
        when(vocabTestAttemptRepository.updateAnswersProgressCas(anyString(), anyInt(), anyInt(), anyString(), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(0);

        Instant now = Instant.now();
        VocabTestAttempt attempt = VocabTestAttempt.builder()
                .userId(1)
                .testToken("token-cas-fail")
                .status("IN_PROGRESS")
                .progressVersion(2) // DB đã ở version 2
                .expiresAt(now.plusSeconds(300))
                .progressHash("different-hash")
                .build();

        when(vocabTestAttemptRepository.findByTestToken("token-cas-fail")).thenReturn(Optional.of(attempt));

        AutoSaveProgressRequest request = AutoSaveProgressRequest.builder()
                .expectedVersion(0) // Client gửi version 0 cũ
                .answers(List.of(VocabTestAnswerItemDto.builder().questionNumber(1).selectedKey("B").build()))
                .build();

        assertThatThrownBy(() -> vocabTestService.saveProgress("token-cas-fail", 1, request))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode()).isEqualTo(ErrorCode.VOCAB_TEST_VERSION_CONFLICT));
    }

    @Test
    @DisplayName("submitTest: Chấm điểm thành công, tính thang điểm 100, cộng 20 XP và duy trì streak")
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
                .currentStreak(5)
                .streakIncrement(1)
                .build();
        when(studyActivityService.recordActivity(any(StudyActivityRecord.class))).thenReturn(mockSummary);

        SubmitVocabTestRequest request = SubmitVocabTestRequest.builder()
                .expectedVersion(1)
                .answers(List.of(
                        VocabTestAnswerItemDto.builder().questionNumber(1).selectedKey("A").build(), // Đúng
                        VocabTestAnswerItemDto.builder().questionNumber(2).selectedKey("C").build()  // Sai
                ))
                .build();

        VocabTestResultResponse result = vocabTestService.submitTest("token-submit-1", 1, request);

        assertThat(result).isNotNull();
        assertThat(result.getScore()).isEqualTo(50); // 1/2 câu = 50%
        assertThat(result.getCorrectCount()).isEqualTo(1);
        assertThat(result.getTotalQuestions()).isEqualTo(2);
        assertThat(result.getXpEarned()).isEqualTo(20);
        assertThat(result.getStatus()).isEqualTo("COMPLETED");
        assertThat(result.getCurrentStreak()).isEqualTo(5);
        assertThat(result.isStreakIncremented()).isTrue();

        verify(studyActivityService).recordActivity(argThat(record ->
                record.getUserId().equals(1) &&
                record.getXpEarned().equals(20) &&
                record.getQualifiesForStreak().equals(true)
        ));
    }

    @Test
    @DisplayName("submitTest: Bài thi bỏ trắng 0 câu trả lời -> 0 điểm, 0 XP và không tính streak")
    void submitTest_empty_answers_no_xp_no_streak() {
        Instant now = Instant.now();
        String questionsJson = "[{\"questionNumber\":1,\"correctKey\":\"A\"}]";

        VocabTestAttempt attempt = VocabTestAttempt.builder()
                .userId(1)
                .deckId(10)
                .deckNameSnapshot("Core Vocabulary")
                .testToken("token-empty-1")
                .status("IN_PROGRESS")
                .progressVersion(0)
                .totalQuestions(1)
                .timeLimitSeconds(60)
                .startedAt(now.minusSeconds(10))
                .expiresAt(now.plusSeconds(50))
                .questionsSnapshot(questionsJson)
                .build();

        when(vocabTestAttemptRepository.findForUpdateByTestToken("token-empty-1")).thenReturn(Optional.of(attempt));
        when(vocabTestProperties.getSubmissionGraceSeconds()).thenReturn(10);

        SubmitVocabTestRequest request = SubmitVocabTestRequest.builder()
                .expectedVersion(0)
                .answers(List.of()) // Trống
                .build();

        VocabTestResultResponse result = vocabTestService.submitTest("token-empty-1", 1, request);
        assertThat(result.getScore()).isEqualTo(0);
        assertThat(result.getXpEarned()).isEqualTo(0);

        verify(studyActivityService).recordActivity(argThat(record ->
                record.getXpEarned().equals(0) &&
                record.getQualifiesForStreak().equals(false)
        ));
    }

    @Test
    @DisplayName("reviewAnswers: Thành công sau khi bài thi kết thúc; chặn xem đáp án khi còn IN_PROGRESS")
    void reviewAnswers_lifecycle_access_control() {
        Instant now = Instant.now();
        String questionsJson = "[{\"questionNumber\":1,\"cardId\":100,\"word\":\"apple\",\"options\":[{\"key\":\"A\",\"text\":\"quả táo\"}],\"correctKey\":\"A\",\"explanation\":\"Apple là quả táo\"}]";

        VocabTestAttempt inProgress = VocabTestAttempt.builder()
                .userId(1)
                .testToken("token-in-progress")
                .status("IN_PROGRESS")
                .build();

        when(vocabTestAttemptRepository.findByTestToken("token-in-progress")).thenReturn(Optional.of(inProgress));

        // 1. Còn IN_PROGRESS -> Chặn 400
        assertThatThrownBy(() -> vocabTestService.reviewAnswers("token-in-progress", 1))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode()).isEqualTo(ErrorCode.VOCAB_TEST_STILL_IN_PROGRESS));

        // 2. Đã COMPLETED -> Mở đáp án và lời giải
        VocabTestAttempt completed = VocabTestAttempt.builder()
                .userId(1)
                .deckId(10)
                .deckNameSnapshot("Core Vocabulary")
                .testToken("token-completed")
                .status("COMPLETED")
                .score(100)
                .correctCount(1)
                .totalQuestions(1)
                .xpEarned(20)
                .timeSpentSeconds(30)
                .startedAt(now.minusSeconds(30))
                .submittedAt(now)
                .questionsSnapshot(questionsJson)
                .answersProgress("[{\"questionNumber\":1,\"selectedKey\":\"A\"}]")
                .build();

        when(vocabTestAttemptRepository.findByTestToken("token-completed")).thenReturn(Optional.of(completed));

        VocabTestReviewDetailDto review = vocabTestService.reviewAnswers("token-completed", 1);
        assertThat(review.getReviewItems()).hasSize(1);
        assertThat(review.getReviewItems().get(0).getCorrectKey()).isEqualTo("A");
        assertThat(review.getReviewItems().get(0).isCorrect()).isTrue();
        assertThat(review.getReviewItems().get(0).getExplanation()).contains("Apple là quả táo");
    }
}
