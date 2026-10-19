package com.multilingo.backend.modules.testing.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.adapter.ExamAdapter;
import com.multilingo.backend.modules.testing.adapter.GradingAdapter;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.dto.response.ExamReviewResponse;
import com.multilingo.backend.modules.testing.dto.response.ReviewPartStatsDto;
import com.multilingo.backend.modules.testing.dto.response.ReviewQuestionDto;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.grading.ObjectiveGradingService;
import com.multilingo.backend.modules.testing.grading.dto.GradingKey;
import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;
import com.multilingo.backend.modules.testing.grading.impl.ObjectiveGradingServiceImpl;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.service.impl.TestAttemptServiceImpl;
import com.multilingo.backend.modules.testing.service.support.AttemptGradingInputFactory;
import com.multilingo.backend.modules.testing.service.support.AttemptResultSummaryMapper;
import com.multilingo.backend.modules.testing.service.support.AttemptReviewMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class TestAttemptReviewServiceTest {

    private final TestAttemptRepository testAttemptRepository = mock(TestAttemptRepository.class);
    private final AttemptAnswerRepository attemptAnswerRepository = mock(AttemptAnswerRepository.class);
    private final ExamAdapter examAdapter = mock(ExamAdapter.class);
    private final IdentityAdapter identityAdapter = mock(IdentityAdapter.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final GradingAdapter gradingAdapter = mock(GradingAdapter.class);
    private final ObjectiveGradingService gradingService = new ObjectiveGradingServiceImpl();
    private final PlatformTransactionManager transactionManager = mock(PlatformTransactionManager.class);
    private final EntityManager entityManager = mock(EntityManager.class);
    private final AttemptGradingInputFactory gradingInputFactory = new AttemptGradingInputFactory();
    private final AttemptResultSummaryMapper summaryMapper = new AttemptResultSummaryMapper(objectMapper);
    private final AttemptReviewMapper reviewMapper = new AttemptReviewMapper(objectMapper);

    private TestAttemptServiceImpl service;

    private static final Integer CURRENT_USER_ID = 100;

    @BeforeEach
    void setUp() {
        when(identityAdapter.getCurrentUserId()).thenReturn(CURRENT_USER_ID);

        service = new TestAttemptServiceImpl(
                testAttemptRepository,
                attemptAnswerRepository,
                examAdapter,
                identityAdapter,
                objectMapper,
                gradingAdapter,
                gradingService,
                transactionManager,
                entityManager,
                gradingInputFactory,
                summaryMapper,
                reviewMapper,
                mock(com.multilingo.backend.modules.testing.service.support.WritingGradingEnqueuer.class),
                new com.multilingo.backend.modules.testing.service.support.WritingGradingAttemptStateResolver()
        );
    }

    @Test
    void getAttemptReview_whenAttemptNotFoundOrNotOwned_throwsForbidden() {
        Integer attemptId = 999;
        Integer partId = 1;

        when(testAttemptRepository.findByIdAndUserId(attemptId, CURRENT_USER_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getAttemptReview(attemptId, partId))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> {
                    AppException appEx = (AppException) ex;
                    assertThat(appEx.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
                });
    }

    @Test
    void getAttemptReview_whenAttemptInProgress_throwsInvalidRequest() {
        Integer attemptId = 1;
        Integer partId = 1;

        TestAttempt attempt = TestAttempt.builder()
                .userId(CURRENT_USER_ID)
                .status(AttemptStatus.IN_PROGRESS)
                .deadline(Instant.now().plusSeconds(3600)) // Not expired yet
                .examSnapshot(createSampleSnapshot(1))
                .build();
        attempt.setId(attemptId);

        when(testAttemptRepository.findByIdAndUserId(attemptId, CURRENT_USER_ID))
                .thenReturn(Optional.of(attempt));

        assertThatThrownBy(() -> service.getAttemptReview(attemptId, partId))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> {
                    AppException appEx = (AppException) ex;
                    assertThat(appEx.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);
                });
    }

    @Test
    void getAttemptReview_whenPartIdNotInScope_throwsResourceNotFound() {
        Integer attemptId = 2;
        Integer requestedPartId = 999; // Not in snapshot

        TestAttempt attempt = TestAttempt.builder()
                .userId(CURRENT_USER_ID)
                .status(AttemptStatus.COMPLETED)
                .examSnapshot(createSampleSnapshot(1)) // only part 1
                .build();
        attempt.setId(attemptId);

        when(testAttemptRepository.findByIdAndUserId(attemptId, CURRENT_USER_ID))
                .thenReturn(Optional.of(attempt));

        assertThatThrownBy(() -> service.getAttemptReview(attemptId, requestedPartId))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> {
                    AppException appEx = (AppException) ex;
                    assertThat(appEx.getErrorCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND);
                });
    }

    @Test
    void getAttemptReview_whenValidCompletedAttempt_returnsTypedReviewResponse() {
        Integer attemptId = 3;
        Integer partId = 1;

        TestAttempt attempt = TestAttempt.builder()
                .userId(CURRENT_USER_ID)
                .status(AttemptStatus.COMPLETED)
                .examSnapshot(createSampleSnapshot(partId))
                .resultSummary("{\"partResults\":{\"1\":{\"q1\":{\"questionId\":\"q1\",\"verdict\":\"CORRECT\",\"score\":1.00},\"q2\":{\"questionId\":\"q2\",\"verdict\":\"WRONG\",\"score\":0.00}}}}")
                .build();
        attempt.setId(attemptId);

        AttemptAnswer answer = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(partId)
                .userAnswers(Map.of("q1", "A", "q2", "C"))
                .build();

        when(testAttemptRepository.findByIdAndUserId(attemptId, CURRENT_USER_ID))
                .thenReturn(Optional.of(attempt));
        when(attemptAnswerRepository.findByAttemptIdAndPartId(attemptId, partId))
                .thenReturn(Optional.of(answer));

        ExamReviewResponse response = service.getAttemptReview(attemptId, partId);

        assertThat(response).isNotNull();
        assertThat(response.getAttemptId()).isEqualTo(attemptId);
        assertThat(response.getPartId()).isEqualTo(partId);
        assertThat(response.getPartTitle()).isEqualTo("Part 1 - Reading Passage 1");
        assertThat(response.getSkill()).isEqualTo("READING");

        // Verify structured part stats
        ReviewPartStatsDto stats = response.getPartStats();
        assertThat(stats).isNotNull();
        assertThat(stats.getTotalQuestions()).isEqualTo(2);
        assertThat(stats.getCorrectCount()).isEqualTo(1);
        assertThat(stats.getIncorrectCount()).isEqualTo(1);
        assertThat(stats.getScore()).isEqualByComparingTo("1.00");
        assertThat(stats.getAccuracy()).isEqualByComparingTo("50.00");

        // Verify questions
        assertThat(response.getQuestions()).hasSize(2);
        ReviewQuestionDto q1 = response.getQuestions().get(0);
        assertThat(q1.getQuestionId()).isEqualTo("q1");
        assertThat(q1.getVerdict()).isEqualTo("CORRECT");
        assertThat(q1.getCorrectAnswer()).isEqualTo("A");
        assertThat(q1.getExplanation()).isEqualTo("Explanation for Q1");

        // Verify legacy backward compatibility fields
        assertThat(response.getUserAnswers()).containsEntry("q1", "A");
        assertThat(response.getIsCorrectFlags()).containsEntry("q1", true);
        assertThat(response.getIsCorrectFlags()).containsEntry("q2", false);
        assertThat(response.getPartResult()).isNotNull();
    }

    @Test
    void getAttemptReview_neverLeaksInternalSecrets() {
        Integer attemptId = 4;
        Integer partId = 1;

        Map<String, Object> part = new LinkedHashMap<>();
        part.put("id", partId);
        part.put("title", "Part 1");
        part.put("ai_prompt_context", "CRITICAL_SECRET_PROMPT");
        part.put("grading_key", "CRITICAL_SECRET_KEY");
        part.put("questions", List.of(
                Map.of(
                        "question_id", "q1",
                        "type", "SINGLE_CHOICE",
                        "correct_answer", "A",
                        "ai_feedback", "SECRET_FEEDBACK",
                        "options", List.of(Map.of("id", "A", "text", "Apple"))
                )
        ));

        Map<String, Object> secretSnapshot = Map.of(
                "sections", List.of(
                        Map.of("name", "Reading", "parts", List.of(part))
                )
        );

        TestAttempt attempt = TestAttempt.builder()
                .userId(CURRENT_USER_ID)
                .status(AttemptStatus.COMPLETED)
                .examSnapshot(secretSnapshot)
                .build();
        attempt.setId(attemptId);

        when(testAttemptRepository.findByIdAndUserId(attemptId, CURRENT_USER_ID))
                .thenReturn(Optional.of(attempt));
        when(attemptAnswerRepository.findByAttemptIdAndPartId(attemptId, partId))
                .thenReturn(Optional.empty());

        ExamReviewResponse response = service.getAttemptReview(attemptId, partId);

        assertThat(response.getExamData()).isInstanceOf(Map.class);
        Map<String, Object> examData = (Map<String, Object>) response.getExamData();
        assertThat(examData).doesNotContainKey("ai_prompt_context");
        assertThat(examData).doesNotContainKey("grading_key");
        assertThat(examData).doesNotContainKey("ai_feedback");
    }

    @Test
    void getAttemptReview_legacyAttemptMissingKeys_usesFallbackKeyGracefully() {
        Integer attemptId = 5;
        Integer examId = 1001;
        Integer partId = 1;

        // Legacy snapshot: has questions, but NO correct_answer or explanation
        Map<String, Object> legacySnapshot = new LinkedHashMap<>();
        legacySnapshot.put("sections", List.of(
                Map.of(
                        "name", "Reading",
                        "parts", List.of(
                                Map.of(
                                        "id", partId,
                                        "title", "Legacy Part 1",
                                        "questions", List.of(
                                                Map.of(
                                                        "question_id", "q_legacy",
                                                        "type", "SINGLE_CHOICE",
                                                        "options", List.of(
                                                                Map.of("id", "A", "text", "Option A"),
                                                                Map.of("id", "B", "text", "Option B")
                                                        )
                                                )
                                        )
                                )
                        )
                )
        ));

        TestAttempt attempt = TestAttempt.builder()
                .examId(examId)
                .userId(CURRENT_USER_ID)
                .status(AttemptStatus.COMPLETED)
                .examSnapshot(legacySnapshot)
                .build();
        attempt.setId(attemptId);

        when(testAttemptRepository.findByIdAndUserId(attemptId, CURRENT_USER_ID))
                .thenReturn(Optional.of(attempt));

        PartGradingKey legacyKey = new PartGradingKey();
        legacyKey.setPartId(partId);
        GradingKey gk = new GradingKey();
        gk.setQuestionId("q_legacy");
        gk.setCorrect("B");
        legacyKey.setAnswers(Map.of("q_legacy", gk));

        when(gradingAdapter.loadPartKeys(examId))
                .thenReturn(Map.of(partId, legacyKey));

        ExamReviewResponse response = service.getAttemptReview(attemptId, partId);

        assertThat(response.getQuestions()).hasSize(1);
        ReviewQuestionDto q = response.getQuestions().get(0);
        assertThat(q.getCorrectAnswer()).isEqualTo("B");
        assertThat(q.getExplanation()).isNull(); // Legacy has no explanation
        assertThat(q.getOptions().get(0).getIsCorrect()).isFalse();
        assertThat(q.getOptions().get(1).getIsCorrect()).isTrue();

        verify(gradingAdapter).loadPartKeys(examId);
    }

    @Test
    void getAttemptReview_writingOnlyPart_neverCallsGradingAdapter_evenIfAdapterThrows() {
        Integer attemptId = 5;
        Integer partId = 99;
        Integer examId = 202;

        Map<String, Object> essayQuestion = new LinkedHashMap<>();
        essayQuestion.put("question_id", "essay_1");
        essayQuestion.put("type", "ESSAY");
        essayQuestion.put("prompt", "Write about technology");

        Map<String, Object> writingPart = new LinkedHashMap<>();
        writingPart.put("id", partId);
        writingPart.put("title", "Writing Task 1");
        writingPart.put("questions", List.of(essayQuestion));

        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of("name", "WRITING", "parts", List.of(writingPart))
                )
        );

        TestAttempt attempt = TestAttempt.builder()
                .userId(CURRENT_USER_ID)
                .examId(examId)
                .status(AttemptStatus.AI_GRADING)
                .examSnapshot(snapshot)
                .build();
        attempt.setId(attemptId);

        when(testAttemptRepository.findByIdAndUserId(attemptId, CURRENT_USER_ID))
                .thenReturn(Optional.of(attempt));

        when(attemptAnswerRepository.findByAttemptIdAndPartId(attemptId, partId))
                .thenReturn(Optional.of(AttemptAnswer.builder()
                        .attempt(attempt)
                        .partId(partId)
                        .userAnswers(Map.of("essay_1", "My submitted essay text"))
                        .build()));

        // Even if GradingAdapter throws an error, it should NEVER be called for Writing parts
        when(gradingAdapter.loadPartKeys(any())).thenThrow(new RuntimeException("TV2 offline"));

        ExamReviewResponse response = service.getAttemptReview(attemptId, partId);

        assertThat(response).isNotNull();
        assertThat(response.getQuestions()).hasSize(1);
        ReviewQuestionDto essayDto = response.getQuestions().get(0);
        assertThat(essayDto.getVerdict()).isEqualTo("PENDING");
        assertThat(essayDto.getScore()).isNull();

        verify(gradingAdapter, never()).loadPartKeys(any());
    }

    private Map<String, Object> createSampleSnapshot(Integer partId) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        Map<String, Object> part = new LinkedHashMap<>();
        part.put("id", partId);
        part.put("title", "Part " + partId + " - Reading Passage 1");

        Map<String, Object> q1 = new LinkedHashMap<>();
        q1.put("question_id", "q1");
        q1.put("type", "SINGLE_CHOICE");
        q1.put("correct_answer", "A");
        q1.put("explanation", "Explanation for Q1");
        q1.put("options", List.of(
                Map.of("id", "A", "text", "Apple"),
                Map.of("id", "B", "text", "Banana")
        ));

        Map<String, Object> q2 = new LinkedHashMap<>();
        q2.put("question_id", "q2");
        q2.put("type", "SINGLE_CHOICE");
        q2.put("correct_answer", "B");
        q2.put("explanation", "Explanation for Q2");
        q2.put("options", List.of(
                Map.of("id", "A", "text", "Cat"),
                Map.of("id", "B", "text", "Dog")
        ));

        part.put("questions", List.of(q1, q2));

        snapshot.put("sections", List.of(
                Map.of(
                        "name", "Reading",
                        "parts", List.of(part)
                )
        ));
        return snapshot;
    }
}
