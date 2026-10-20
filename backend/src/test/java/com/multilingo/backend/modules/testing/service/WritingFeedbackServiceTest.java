package com.multilingo.backend.modules.testing.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.ai.grading.WritingGrade;
import com.multilingo.backend.modules.testing.dto.response.WritingFeedbackResponse;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.WritingGradingJob;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.WritingGradingJobStatus;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.repository.WritingGradingJobRepository;
import com.multilingo.backend.modules.testing.service.impl.WritingFeedbackServiceImpl;
import com.multilingo.backend.modules.testing.service.support.WritingFeedbackMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WritingFeedbackServiceTest {

    @Mock
    private TestAttemptRepository testAttemptRepository;

    @Mock
    private AttemptAnswerRepository attemptAnswerRepository;

    @Mock
    private WritingGradingJobRepository jobRepository;

    @Mock
    private IdentityAdapter identityAdapter;

    private ObjectMapper objectMapper;
    private WritingFeedbackMapper feedbackMapper;
    private WritingFeedbackServiceImpl service;

    private Integer ownerId = 100;
    private Integer attemptId = 1;
    private Integer writingPartId = 201;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        feedbackMapper = new WritingFeedbackMapper(objectMapper);
        service = new WritingFeedbackServiceImpl(
                testAttemptRepository,
                attemptAnswerRepository,
                jobRepository,
                identityAdapter,
                feedbackMapper
        );
    }

    private TestAttempt createAttempt(Integer id, Integer userId, AttemptStatus status, Map<String, Object> snapshot) {
        TestAttempt attempt = TestAttempt.builder()
                .userId(userId)
                .status(status)
                .examSnapshot(snapshot)
                .build();
        attempt.setId(id);
        return attempt;
    }

    private WritingGradingJob createJob(Integer id, Integer attemptId, Integer partId, String questionId,
                                        WritingGradingJobStatus status, String waitReason, String errorCode) {
        WritingGradingJob job = WritingGradingJob.builder()
                .attemptId(attemptId)
                .partId(partId)
                .questionId(questionId)
                .status(status)
                .waitReason(waitReason)
                .lastErrorCode(errorCode)
                .build();
        job.setId(id);
        return job;
    }

    private Map<String, Object> createSnapshot(Integer partId, String questionType, String questionId) {
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("question_id", questionId);
        question.put("type", questionType);
        question.put("label", "Essay Task 1");

        Map<String, Object> group = new LinkedHashMap<>();
        group.put("questions", List.of(question));

        Map<String, Object> part = new LinkedHashMap<>();
        part.put("part_id", partId);
        part.put("title", "Writing Part 1");
        part.put("question_groups", List.of(group));

        Map<String, Object> section = new LinkedHashMap<>();
        section.put("name", "WRITING");
        section.put("parts", List.of(part));

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("examLanguage", "en");
        snapshot.put("sections", List.of(section));
        return snapshot;
    }

    @Test
    @DisplayName("Invalid attemptId (<= 0 hoặc null) ném AppException INVALID_REQUEST")
    void invalidAttemptId_throwsInvalidRequest() {
        assertThatThrownBy(() -> service.getWritingFeedback(0, 1))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.INVALID_REQUEST);

        assertThatThrownBy(() -> service.getWritingFeedback(null, 1))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.INVALID_REQUEST);
    }

    @Test
    @DisplayName("Invalid partId (<= 0 hoặc null) ném AppException INVALID_REQUEST")
    void invalidPartId_throwsInvalidRequest() {
        assertThatThrownBy(() -> service.getWritingFeedback(1, 0))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.INVALID_REQUEST);

        assertThatThrownBy(() -> service.getWritingFeedback(1, -5))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.INVALID_REQUEST);
    }

    @Test
    @DisplayName("Attempt không tồn tại ném AppException FORBIDDEN (403 theo convention)")
    void attemptNotFound_throwsForbidden() {
        when(identityAdapter.getCurrentUserId()).thenReturn(ownerId);
        when(testAttemptRepository.findById(attemptId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getWritingFeedback(attemptId, writingPartId))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.FORBIDDEN);
    }

    @Test
    @DisplayName("Người gọi không sở hữu bài thi ném AppException FORBIDDEN (403)")
    void nonOwner_throwsForbidden() {
        when(identityAdapter.getCurrentUserId()).thenReturn(999); // Caller is 999
        TestAttempt attempt = createAttempt(attemptId, ownerId, AttemptStatus.COMPLETED, null);
        when(testAttemptRepository.findById(attemptId)).thenReturn(Optional.of(attempt));

        assertThatThrownBy(() -> service.getWritingFeedback(attemptId, writingPartId))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.FORBIDDEN);
    }

    @Test
    @DisplayName("Bài thi còn IN_PROGRESS ném AppException INVALID_REQUEST (400, không lazy-finalize)")
    void inProgressAttempt_throwsInvalidRequest() {
        when(identityAdapter.getCurrentUserId()).thenReturn(ownerId);
        TestAttempt attempt = createAttempt(attemptId, ownerId, AttemptStatus.IN_PROGRESS, null);
        when(testAttemptRepository.findById(attemptId)).thenReturn(Optional.of(attempt));

        assertThatThrownBy(() -> service.getWritingFeedback(attemptId, writingPartId))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.INVALID_REQUEST);
    }

    @Test
    @DisplayName("Part không nằm trong exam snapshot ném AppException RESOURCE_NOT_FOUND (404)")
    void partNotInSnapshot_throwsResourceNotFound() {
        when(identityAdapter.getCurrentUserId()).thenReturn(ownerId);
        TestAttempt attempt = createAttempt(attemptId, ownerId, AttemptStatus.COMPLETED,
                createSnapshot(writingPartId, "ESSAY", "q1"));
        when(testAttemptRepository.findById(attemptId)).thenReturn(Optional.of(attempt));

        assertThatThrownBy(() -> service.getWritingFeedback(attemptId, 999)) // Part 999 not in snapshot
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.RESOURCE_NOT_FOUND);
    }

    @Test
    @DisplayName("Part trong snapshot nhưng không chứa câu hỏi ESSAY ném AppException RESOURCE_NOT_FOUND (404)")
    void partWithoutEssayQuestions_throwsResourceNotFound() {
        when(identityAdapter.getCurrentUserId()).thenReturn(ownerId);
        TestAttempt attempt = createAttempt(attemptId, ownerId, AttemptStatus.COMPLETED,
                createSnapshot(writingPartId, "SINGLE_CHOICE", "q1")); // Not ESSAY
        when(testAttemptRepository.findById(attemptId)).thenReturn(Optional.of(attempt));

        assertThatThrownBy(() -> service.getWritingFeedback(attemptId, writingPartId))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.RESOURCE_NOT_FOUND);
    }

    @Test
    @DisplayName("Attempt cũ không có job và không có aiFeedback trả UNAVAILABLE với LEGACY_NO_JOB")
    void legacyAttemptWithoutJob_returnsUnavailable() {
        when(identityAdapter.getCurrentUserId()).thenReturn(ownerId);
        TestAttempt attempt = createAttempt(attemptId, ownerId, AttemptStatus.COMPLETED,
                createSnapshot(writingPartId, "ESSAY", "q1"));
        when(testAttemptRepository.findById(attemptId)).thenReturn(Optional.of(attempt));
        when(attemptAnswerRepository.findByAttemptIdAndPartId(attemptId, writingPartId)).thenReturn(Optional.empty());
        when(jobRepository.findAllByAttemptIdAndPartId(attemptId, writingPartId)).thenReturn(List.of());

        WritingFeedbackResponse response = service.getWritingFeedback(attemptId, writingPartId);

        assertThat(response.attemptId()).isEqualTo(attemptId);
        assertThat(response.partId()).isEqualTo(writingPartId);
        assertThat(response.partStatus()).isEqualTo("UNAVAILABLE");
        assertThat(response.tasks()).hasSize(1);

        WritingFeedbackResponse.TaskFeedback task = response.tasks().getFirst();
        assertThat(task.questionId()).isEqualTo("q1");
        assertThat(task.status()).isEqualTo("UNAVAILABLE");
        assertThat(task.reasonCode()).isEqualTo("LEGACY_NO_JOB");
        assertThat(task.overall()).isNull();
        assertThat(task.maxScore()).isNull();
    }

    @Test
    @DisplayName("Bài thi có aiFeedback thành công trả về DONE với điểm số, criteria và diff")
    void succeededAiFeedback_returnsDoneWithScoreAndDetails() {
        when(identityAdapter.getCurrentUserId()).thenReturn(ownerId);
        TestAttempt attempt = createAttempt(attemptId, ownerId, AttemptStatus.COMPLETED,
                createSnapshot(writingPartId, "ESSAY", "q1"));
        when(testAttemptRepository.findById(attemptId)).thenReturn(Optional.of(attempt));

        WritingGrade grade = new WritingGrade(
                WritingGrade.DEFAULT_RUBRIC,
                "vi",
                BigDecimal.valueOf(7.5),
                List.of(
                        new WritingGrade.CriterionGrade("TR", BigDecimal.valueOf(7.5), "Tốt"),
                        new WritingGrade.CriterionGrade("CC", BigDecimal.valueOf(7.0), "Mạch lạc"),
                        new WritingGrade.CriterionGrade("LR", BigDecimal.valueOf(7.5), "Từ vựng tốt"),
                        new WritingGrade.CriterionGrade("GRA", BigDecimal.valueOf(8.0), "Ngữ pháp chuẩn")
                ),
                "Bài viết hoàn thành tốt.",
                "Original essay submitted by learner with more than ten words in this submission.",
                List.of(),
                List.of(new WritingGrade.DiffSegment(WritingGrade.DiffType.EQUAL, "Original essay submitted by learner with more than ten words in this submission."))
        );

        Map<String, Object> gradeMap = objectMapper.convertValue(grade, Map.class);
        Map<String, Object> aiFeedback = Map.of(
                "schemaVersion", 1,
                "tasks", Map.of("q1", gradeMap)
        );

        AttemptAnswer answer = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(writingPartId)
                .userAnswers(Map.of("q1", "Original essay submitted by learner with more than ten words in this submission."))
                .aiFeedback(aiFeedback)
                .build();

        when(attemptAnswerRepository.findByAttemptIdAndPartId(attemptId, writingPartId)).thenReturn(Optional.of(answer));
        when(jobRepository.findAllByAttemptIdAndPartId(attemptId, writingPartId)).thenReturn(List.of());

        WritingFeedbackResponse response = service.getWritingFeedback(attemptId, writingPartId);

        assertThat(response.partStatus()).isEqualTo("DONE");
        assertThat(response.tasks()).hasSize(1);

        WritingFeedbackResponse.TaskFeedback task = response.tasks().getFirst();
        assertThat(task.questionId()).isEqualTo("q1");
        assertThat(task.status()).isEqualTo("DONE");
        assertThat(task.overall()).isEqualTo(BigDecimal.valueOf(7.5));
        assertThat(task.maxScore()).isEqualTo(BigDecimal.valueOf(9.0));
        assertThat(task.criteria()).hasSize(4);
        assertThat(task.reasonCode()).isNull();
        assertThat(task.displayMessage()).isEqualTo("Chấm điểm hoàn tất.");
    }

    @Test
    @DisplayName("Bài thi quá ngắn (<= 10 từ) trả DONE với overall 0.0, criteria 0.0 và reasonCode TOO_SHORT")
    void shortEssay_returnsDoneWithZeroScoreAndTooShortReason() {
        when(identityAdapter.getCurrentUserId()).thenReturn(ownerId);
        TestAttempt attempt = createAttempt(attemptId, ownerId, AttemptStatus.COMPLETED,
                createSnapshot(writingPartId, "ESSAY", "q1"));
        when(testAttemptRepository.findById(attemptId)).thenReturn(Optional.of(attempt));

        String shortText = "Short text.";
        WritingGrade tooShortGrade = WritingGrade.tooShort(shortText);
        Map<String, Object> gradeMap = objectMapper.convertValue(tooShortGrade, Map.class);
        Map<String, Object> aiFeedback = Map.of(
                "schemaVersion", 1,
                "tasks", Map.of("q1", gradeMap)
        );

        AttemptAnswer answer = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(writingPartId)
                .userAnswers(Map.of("q1", shortText))
                .aiFeedback(aiFeedback)
                .build();

        when(attemptAnswerRepository.findByAttemptIdAndPartId(attemptId, writingPartId)).thenReturn(Optional.of(answer));
        when(jobRepository.findAllByAttemptIdAndPartId(attemptId, writingPartId)).thenReturn(List.of());

        WritingFeedbackResponse response = service.getWritingFeedback(attemptId, writingPartId);

        assertThat(response.partStatus()).isEqualTo("DONE");
        assertThat(response.tasks()).hasSize(1);

        WritingFeedbackResponse.TaskFeedback task = response.tasks().getFirst();
        assertThat(task.status()).isEqualTo("DONE");
        assertThat(task.overall()).isEqualTo(BigDecimal.ZERO);
        assertThat(task.maxScore()).isEqualTo(BigDecimal.valueOf(9.0));
        assertThat(task.reasonCode()).isEqualTo("TOO_SHORT");
        assertThat(task.originalText()).isEqualTo(shortText);
        assertThat(task.correctedEssay()).isEqualTo(shortText);
        assertThat(task.criteria()).allMatch(c -> c.score().compareTo(BigDecimal.ZERO) == 0);
    }

    @Test
    @DisplayName("Dữ liệu feedback bị malformed không thể thành DONE mà fail-closed sang FAILED")
    void malformedAiFeedback_failsClosedToFailed() {
        when(identityAdapter.getCurrentUserId()).thenReturn(ownerId);
        TestAttempt attempt = createAttempt(attemptId, ownerId, AttemptStatus.COMPLETED,
                createSnapshot(writingPartId, "ESSAY", "q1"));
        when(testAttemptRepository.findById(attemptId)).thenReturn(Optional.of(attempt));

        // Corrupted grade: missing criteria, score > 9.0
        Map<String, Object> corruptedGrade = Map.of(
                "overallScore", 15.0, // Invalid score
                "criteria", List.of()
        );
        Map<String, Object> aiFeedback = Map.of(
                "schemaVersion", 1,
                "tasks", Map.of("q1", corruptedGrade)
        );

        AttemptAnswer answer = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(writingPartId)
                .userAnswers(Map.of("q1", "Some valid long essay text here."))
                .aiFeedback(aiFeedback)
                .build();

        when(attemptAnswerRepository.findByAttemptIdAndPartId(attemptId, writingPartId)).thenReturn(Optional.of(answer));
        when(jobRepository.findAllByAttemptIdAndPartId(attemptId, writingPartId)).thenReturn(List.of());

        WritingFeedbackResponse response = service.getWritingFeedback(attemptId, writingPartId);

        assertThat(response.partStatus()).isEqualTo("FAILED");
        WritingFeedbackResponse.TaskFeedback task = response.tasks().getFirst();
        assertThat(task.status()).isEqualTo("FAILED");
        assertThat(task.reasonCode()).isEqualTo("MALFORMED_FEEDBACK");
        assertThat(task.overall()).isNull();
        assertThat(task.maxScore()).isNull();
    }

    @Test
    @DisplayName("Job ở trạng thái WAITING trả về status QUEUED với lý do waitReason")
    void waitingJob_returnsQueuedWithWaitReason() {
        when(identityAdapter.getCurrentUserId()).thenReturn(ownerId);
        TestAttempt attempt = createAttempt(attemptId, ownerId, AttemptStatus.AI_GRADING_QUEUED,
                createSnapshot(writingPartId, "ESSAY", "q1"));
        when(testAttemptRepository.findById(attemptId)).thenReturn(Optional.of(attempt));

        WritingGradingJob job = createJob(10, attemptId, writingPartId, "q1",
                WritingGradingJobStatus.WAITING, "PROVIDER_DISABLED", null);

        when(attemptAnswerRepository.findByAttemptIdAndPartId(attemptId, writingPartId)).thenReturn(Optional.empty());
        when(jobRepository.findAllByAttemptIdAndPartId(attemptId, writingPartId)).thenReturn(List.of(job));

        WritingFeedbackResponse response = service.getWritingFeedback(attemptId, writingPartId);

        assertThat(response.partStatus()).isEqualTo("QUEUED");
        WritingFeedbackResponse.TaskFeedback task = response.tasks().getFirst();
        assertThat(task.status()).isEqualTo("QUEUED");
        assertThat(task.reasonCode()).isEqualTo("PROVIDER_DISABLED");
        assertThat(task.overall()).isNull();
    }

    @Test
    @DisplayName("Nhiều task ESSAY trong cùng một part được trả về theo đúng thứ tự trong snapshot")
    void multipleEssayTasks_preservesSnapshotOrder() {
        Map<String, Object> q1 = Map.of("question_id", "q1", "type", "ESSAY", "label", "Task 1");
        Map<String, Object> q2 = Map.of("question_id", "q2", "type", "ESSAY", "label", "Task 2");

        Map<String, Object> group = Map.of("questions", List.of(q1, q2));
        Map<String, Object> part = Map.of("part_id", writingPartId, "title", "Writing Part", "question_groups", List.of(group));
        Map<String, Object> section = Map.of("name", "WRITING", "parts", List.of(part));
        Map<String, Object> snapshot = Map.of("examLanguage", "en", "sections", List.of(section));

        when(identityAdapter.getCurrentUserId()).thenReturn(ownerId);
        TestAttempt attempt = createAttempt(attemptId, ownerId, AttemptStatus.AI_GRADING, snapshot);
        when(testAttemptRepository.findById(attemptId)).thenReturn(Optional.of(attempt));

        WritingGradingJob j1 = createJob(11, attemptId, writingPartId, "q1", WritingGradingJobStatus.RUNNING, null, null);
        WritingGradingJob j2 = createJob(12, attemptId, writingPartId, "q2", WritingGradingJobStatus.READY, null, null);

        when(attemptAnswerRepository.findByAttemptIdAndPartId(attemptId, writingPartId)).thenReturn(Optional.empty());
        // Trả về danh sách lộn xộn (j2 trước j1) để kiểm tra mapper sắp xếp theo snapshot
        when(jobRepository.findAllByAttemptIdAndPartId(attemptId, writingPartId)).thenReturn(List.of(j2, j1));

        WritingFeedbackResponse response = service.getWritingFeedback(attemptId, writingPartId);

        assertThat(response.tasks()).hasSize(2);
        assertThat(response.tasks().get(0).questionId()).isEqualTo("q1");
        assertThat(response.tasks().get(1).questionId()).isEqualTo("q2");
        assertThat(response.partStatus()).isEqualTo("PENDING");
    }
}
