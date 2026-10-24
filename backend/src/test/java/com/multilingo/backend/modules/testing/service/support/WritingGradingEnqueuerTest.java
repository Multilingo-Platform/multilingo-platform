package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.ai.grading.WritingGradingContext;
import com.multilingo.backend.modules.testing.ai.grading.WritingImageRef;
import com.multilingo.backend.modules.testing.config.WritingGradingProperties;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.WritingGradingJob;
import com.multilingo.backend.modules.testing.entity.enums.WritingGradingJobStatus;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.WritingGradingJobRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.time.Duration;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WritingGradingEnqueuerTest {

    @Mock
    private WritingGradingJobRepository jobRepository;

    @Mock
    private WritingGradingContextReader contextReader;

    @Mock
    private AttemptAnswerRepository attemptAnswerRepository;

    private WritingGradingProperties properties;
    private ObjectMapper objectMapper;
    private WritingGradingEnqueuer enqueuer;

    @BeforeEach
    void setUp() {
        properties = new WritingGradingProperties();
        properties.setEnabled(false);
        properties.setImagesEnabled(false);
        properties.setQuotaRecheckInterval(Duration.ofSeconds(60));
        objectMapper = new ObjectMapper();

        enqueuer = new WritingGradingEnqueuer(
                jobRepository,
                contextReader,
                attemptAnswerRepository,
                properties,
                objectMapper
        );
    }

    private TestAttempt createAttemptWithWriting(Integer attemptId, Integer partId, String questionId) {
        Map<String, Object> questionMap = Map.of(
                "id", questionId,
                "type", "ESSAY"
        );
        Map<String, Object> partMap = Map.of(
                "id", partId,
                "questions", List.of(questionMap)
        );
        Map<String, Object> sectionMap = Map.of(
                "skill", "WRITING",
                "parts", List.of(partMap)
        );
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(sectionMap),
                "examLanguage", "en"
        );

        return TestAttempt.builder()
                .userId(100)
                .examId(1)
                .examSnapshot(snapshot)
                .build();
    }

    @Test
    @DisplayName("enqueue method được cấu hình @Transactional(propagation = Propagation.MANDATORY)")
    void enqueue_requiresMandatoryTransaction() throws Exception {
        Method method = WritingGradingEnqueuer.class.getMethod("enqueue", TestAttempt.class, List.class);
        Transactional transactional = method.getAnnotation(Transactional.class);
        assertThat(transactional).isNotNull();
        assertThat(transactional.propagation()).isEqualTo(Propagation.MANDATORY);
    }

    @Test
    @DisplayName("enqueue: snapshot không có phần thi WRITING trả về danh sách rỗng, không tạo job")
    void enqueue_noWritingSection_returnsEmptyList() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(Map.of("skill", "READING", "parts", List.of())),
                "examLanguage", "en"
        );
        TestAttempt attempt = TestAttempt.builder().examSnapshot(snapshot).build();
        attempt.setId(10);

        List<WritingGradingJob> jobs = enqueuer.enqueue(attempt, List.of());

        assertThat(jobs).isEmpty();
        verifyNoInteractions(jobRepository);
        verifyNoInteractions(contextReader);
    }

    @Test
    @DisplayName("enqueue: bài viết >10 từ khi grading enabled -> tạo job READY")
    void enqueue_eligibleEssayGreaterThan10Words_whenGradingEnabled_createsReadyJob() {
        properties.setEnabled(true);
        TestAttempt attempt = createAttemptWithWriting(10, 30, "q1");
        attempt.setId(10);

        WritingGradingContext context = new WritingGradingContext(
                30,
                "q1",
                "Part 1 Title",
                "Part Instruction",
                null,
                "Summarize the visual chart",
                "This is a valid student essay containing definitely more than ten words for analysis.",
                "en",
                14,
                List.of(new WritingImageRef("https://cdn.example.test/chart.png"))
        );

        when(jobRepository.findByAttemptIdAndPartIdAndQuestionId(10, 30, "q1")).thenReturn(Optional.empty());
        when(contextReader.read(eq(attempt), eq(30), eq("q1"), any(), anyBoolean())).thenReturn(new ContextDecision.Eligible(context));
        when(jobRepository.save(any(WritingGradingJob.class))).thenAnswer(inv -> inv.getArgument(0));

        List<WritingGradingJob> jobs = enqueuer.enqueue(attempt, List.of());

        assertThat(jobs).hasSize(1);
        WritingGradingJob job = jobs.get(0);
        assertThat(job.getAttemptId()).isEqualTo(10);
        assertThat(job.getPartId()).isEqualTo(30);
        assertThat(job.getQuestionId()).isEqualTo("q1");
        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.READY);
        assertThat(job.getWaitReason()).isNull();
        assertThat(job.getAttemptCount()).isZero();
        assertThat(job.getImageCount()).isEqualTo(1);
        assertThat(job.getQuotaReserved()).isFalse();
        assertThat(job.getInputHash()).hasSize(64);
        assertThat(job.getContextJson()).containsEntry("rubricCode", "WRITING_EN_V1");
        assertThat(job.getContextJson()).containsEntry("promptVersion", "writing-grading-en-multilingual-feedback-v1");
        assertThat(job.getContextJson()).containsEntry("wordCount", 14);
        assertThat(job.getContextJson()).containsKey("lengthMetric");
        @SuppressWarnings("unchecked")
        Map<String, Object> lengthMetric = (Map<String, Object>) job.getContextJson().get("lengthMetric");
        assertThat(lengthMetric).containsEntry("value", 14);
        assertThat(lengthMetric).containsEntry("unit", "WORDS");
        assertThat(lengthMetric).containsEntry("policyVersion", "TV3_LENGTH_V1");

        verify(jobRepository).save(any(WritingGradingJob.class));
    }

    @Test
    @DisplayName("enqueue: bài viết >10 từ khi grading disabled -> tạo job WAITING với waitReason=FEATURE_DISABLED")
    void enqueue_eligibleEssayGreaterThan10Words_whenGradingDisabled_createsWaitingJob() {
        properties.setEnabled(false);
        TestAttempt attempt = createAttemptWithWriting(10, 30, "q1");
        attempt.setId(10);

        WritingGradingContext context = new WritingGradingContext(
                30,
                "q1",
                "en",
                "Discuss task",
                "This is a valid student essay containing definitely more than ten words for analysis.",
                14,
                List.of()
        );

        when(jobRepository.findByAttemptIdAndPartIdAndQuestionId(10, 30, "q1")).thenReturn(Optional.empty());
        when(contextReader.read(eq(attempt), eq(30), eq("q1"), any(), anyBoolean())).thenReturn(new ContextDecision.Eligible(context));
        when(jobRepository.save(any(WritingGradingJob.class))).thenAnswer(inv -> inv.getArgument(0));

        List<WritingGradingJob> jobs = enqueuer.enqueue(attempt, List.of());

        assertThat(jobs).hasSize(1);
        WritingGradingJob job = jobs.get(0);
        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.WAITING);
        assertThat(job.getWaitReason()).isEqualTo("FEATURE_DISABLED");
        assertThat(job.getNextAttemptAt()).isNotNull();
        assertThat(job.getQuotaReserved()).isFalse();
    }

    @Test
    @DisplayName("enqueue: bài viết ≤10 từ (TOO_SHORT) -> tạo job SUCCEEDED điểm 0 và merge vào aiFeedback")
    void enqueue_shortEssay10WordsOrLess_createsSucceededJob_andMergesAiFeedback() {
        TestAttempt attempt = createAttemptWithWriting(10, 30, "q1");
        attempt.setId(10);

        WritingGradingContext context = new WritingGradingContext(
                30,
                "q1",
                "en",
                "Prompt text",
                "Short essay",
                2,
                List.of()
        );

        AttemptAnswer existingAnswer = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(30)
                .userAnswers(Map.of("q1", "Short essay"))
                .build();

        when(jobRepository.findByAttemptIdAndPartIdAndQuestionId(10, 30, "q1")).thenReturn(Optional.empty());
        when(contextReader.read(eq(attempt), eq(30), eq("q1"), any(), anyBoolean())).thenReturn(new ContextDecision.Eligible(context));
        when(jobRepository.save(any(WritingGradingJob.class))).thenAnswer(inv -> inv.getArgument(0));
        when(attemptAnswerRepository.findByAttemptIdAndPartId(10, 30)).thenReturn(Optional.of(existingAnswer));

        List<WritingGradingJob> jobs = enqueuer.enqueue(attempt, List.of(existingAnswer));

        assertThat(jobs).hasSize(1);
        WritingGradingJob job = jobs.get(0);
        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.SUCCEEDED);
        assertThat(job.getCompletedAt()).isNotNull();
        assertThat(job.getQuotaReserved()).isFalse();
        assertThat(job.getResultJson()).isNotNull();
        assertThat(job.getResultJson()).containsKey("overallScore");
        assertThat(((Number) job.getResultJson().get("overallScore")).doubleValue()).isEqualTo(0.0);

        // Verify AttemptAnswer aiFeedback merged
        ArgumentCaptor<AttemptAnswer> answerCaptor = ArgumentCaptor.forClass(AttemptAnswer.class);
        verify(attemptAnswerRepository).save(answerCaptor.capture());
        AttemptAnswer savedAnswer = answerCaptor.getValue();
        assertThat(savedAnswer.getAiFeedback()).isNotNull();
        assertThat(savedAnswer.getAiFeedback()).containsEntry("schemaVersion", 1);
        @SuppressWarnings("unchecked")
        Map<String, Object> tasks = (Map<String, Object>) savedAnswer.getAiFeedback().get("tasks");
        assertThat(tasks).containsKey("q1");
    }

    @Test
    @DisplayName("enqueue: bài viết ≤10 từ nhưng chưa có dòng AttemptAnswer -> tự động tạo AttemptAnswer mới")
    void enqueue_shortEssay_answerRowAbsent_createsAttemptAnswerAndStoresFeedback() {
        TestAttempt attempt = createAttemptWithWriting(10, 30, "q1");
        attempt.setId(10);

        WritingGradingContext context = new WritingGradingContext(
                30,
                "q1",
                "en",
                "Prompt text",
                "",
                0,
                List.of()
        );

        when(jobRepository.findByAttemptIdAndPartIdAndQuestionId(10, 30, "q1")).thenReturn(Optional.empty());
        when(contextReader.read(eq(attempt), eq(30), eq("q1"), any(), anyBoolean())).thenReturn(new ContextDecision.Eligible(context));
        when(jobRepository.save(any(WritingGradingJob.class))).thenAnswer(inv -> inv.getArgument(0));
        when(attemptAnswerRepository.findByAttemptIdAndPartId(10, 30)).thenReturn(Optional.empty());
        when(attemptAnswerRepository.save(any(AttemptAnswer.class))).thenAnswer(inv -> inv.getArgument(0));

        List<WritingGradingJob> jobs = enqueuer.enqueue(attempt, List.of());

        assertThat(jobs).hasSize(1);
        assertThat(jobs.get(0).getStatus()).isEqualTo(WritingGradingJobStatus.SUCCEEDED);

        verify(attemptAnswerRepository, atLeastOnce()).save(any(AttemptAnswer.class));
    }

    @Test
    @DisplayName("enqueue: nhiều câu hỏi ESSAY trong cùng part -> merge feedback không ghi đè câu khác")
    void enqueue_multipleEssaysInSamePart_mergesFeedbackWithoutOverwritingOtherQuestion() {
        Map<String, Object> q1Map = Map.of("id", "q1", "type", "ESSAY");
        Map<String, Object> q2Map = Map.of("id", "q2", "type", "ESSAY");
        Map<String, Object> partMap = Map.of("id", 30, "questions", List.of(q1Map, q2Map));
        Map<String, Object> sectionMap = Map.of("skill", "WRITING", "parts", List.of(partMap));
        Map<String, Object> snapshot = Map.of("sections", List.of(sectionMap), "examLanguage", "en");

        TestAttempt attempt = TestAttempt.builder().examSnapshot(snapshot).build();
        attempt.setId(10);

        WritingGradingContext ctx1 = new WritingGradingContext(30, "q1", "en", "Prompt 1", "Essay 1", 2, List.of());
        WritingGradingContext ctx2 = new WritingGradingContext(30, "q2", "en", "Prompt 2", "Essay 2", 2, List.of());

        AttemptAnswer answerRecord = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(30)
                .userAnswers(Map.of("q1", "Essay 1", "q2", "Essay 2"))
                .build();

        when(jobRepository.findByAttemptIdAndPartIdAndQuestionId(10, 30, "q1")).thenReturn(Optional.empty());
        when(jobRepository.findByAttemptIdAndPartIdAndQuestionId(10, 30, "q2")).thenReturn(Optional.empty());
        when(contextReader.read(eq(attempt), eq(30), eq("q1"), any(), anyBoolean())).thenReturn(new ContextDecision.Eligible(ctx1));
        when(contextReader.read(eq(attempt), eq(30), eq("q2"), any(), anyBoolean())).thenReturn(new ContextDecision.Eligible(ctx2));
        when(jobRepository.save(any(WritingGradingJob.class))).thenAnswer(inv -> inv.getArgument(0));
        when(attemptAnswerRepository.findByAttemptIdAndPartId(10, 30)).thenReturn(Optional.of(answerRecord));

        List<WritingGradingJob> jobs = enqueuer.enqueue(attempt, List.of(answerRecord));

        assertThat(jobs).hasSize(2);
        assertThat(answerRecord.getAiFeedback()).isNotNull();
        @SuppressWarnings("unchecked")
        Map<String, Object> tasks = (Map<String, Object>) answerRecord.getAiFeedback().get("tasks");
        assertThat(tasks).containsKeys("q1", "q2");
    }

    @Test
    @DisplayName("enqueue: task bị UNAVAILABLE -> tạo job UNAVAILABLE lưu reasonCode, không provider, không quota")
    void enqueue_unavailableTask_createsUnavailableJob_withLastErrorCode() {
        TestAttempt attempt = createAttemptWithWriting(10, 30, "q1");
        attempt.setId(10);

        ContextDecision.Unavailable unavailable = new ContextDecision.Unavailable(
                "UNSUPPORTED_LANGUAGE",
                "Exam language is not supported"
        );

        when(jobRepository.findByAttemptIdAndPartIdAndQuestionId(10, 30, "q1")).thenReturn(Optional.empty());
        when(contextReader.read(eq(attempt), eq(30), eq("q1"), any(), anyBoolean())).thenReturn(unavailable);
        when(jobRepository.save(any(WritingGradingJob.class))).thenAnswer(inv -> inv.getArgument(0));

        List<WritingGradingJob> jobs = enqueuer.enqueue(attempt, List.of());

        assertThat(jobs).hasSize(1);
        WritingGradingJob job = jobs.get(0);
        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.UNAVAILABLE);
        assertThat(job.getLastErrorCode()).isEqualTo("UNSUPPORTED_LANGUAGE");
        assertThat(job.getQuotaReserved()).isFalse();
        assertThat(job.getCompletedAt()).isNotNull();
    }

    @Test
    @DisplayName("NLTV essay: real context reader creates unavailable record, not an AI grading job")
    void enqueue_nltvEssay_isUnavailableWithoutQuotaOrProviderEligibleJob() {
        Map<String, Object> question = Map.of("question_id", "w_001", "type", "ESSAY", "prompt", "Viết bài luận.");
        Map<String, Object> part = Map.of("id", 8, "questions", List.of(question));
        Map<String, Object> section = Map.of("name", "WRITING", "skill_type", "WRITING", "parts", List.of(part));
        TestAttempt attempt = TestAttempt.builder()
                .userId(100)
                .examSnapshot(Map.of("examLanguage", "vi", "sections", List.of(section)))
                .build();
        attempt.setId(68);
        WritingGradingProperties enabledProperties = new WritingGradingProperties();
        enabledProperties.setEnabled(true);
        WritingGradingEnqueuer nltvEnqueuer = new WritingGradingEnqueuer(
                jobRepository, new WritingGradingContextReader(false), attemptAnswerRepository,
                enabledProperties, objectMapper);
        when(jobRepository.findByAttemptIdAndPartIdAndQuestionId(68, 8, "w_001")).thenReturn(Optional.empty());
        when(jobRepository.save(any(WritingGradingJob.class))).thenAnswer(inv -> inv.getArgument(0));

        List<WritingGradingJob> jobs = nltvEnqueuer.enqueue(attempt, List.of());

        assertThat(jobs).hasSize(1);
        assertThat(jobs.get(0).getStatus()).isEqualTo(WritingGradingJobStatus.UNAVAILABLE);
        assertThat(jobs.get(0).getLastErrorCode()).isEqualTo("MULTILINGUAL_GRADING_DISABLED");
        assertThat(jobs.get(0).getQuotaReserved()).isFalse();
        verify(jobRepository, never()).save(argThat(job -> job.getStatus() == WritingGradingJobStatus.READY));
        verifyNoInteractions(attemptAnswerRepository);
    }

    @Test
    @DisplayName("enqueue: gọi lặp lại idempotent -> không chèn bản ghi trùng, trả về job hiện có")
    void enqueue_repeatedCall_isIdempotent_doesNotDuplicateJobs() {
        TestAttempt attempt = createAttemptWithWriting(10, 30, "q1");
        attempt.setId(10);

        WritingGradingJob existingJob = WritingGradingJob.builder()
                .attemptId(10)
                .partId(30)
                .questionId("q1")
                .status(WritingGradingJobStatus.READY)
                .build();

        when(jobRepository.findByAttemptIdAndPartIdAndQuestionId(10, 30, "q1"))
                .thenReturn(Optional.of(existingJob));

        List<WritingGradingJob> jobs = enqueuer.enqueue(attempt, List.of());

        assertThat(jobs).hasSize(1);
        assertThat(jobs.get(0)).isSameAs(existingJob);
        verify(jobRepository, never()).save(any(WritingGradingJob.class));
        verifyNoInteractions(contextReader);
    }

    @Test
    @DisplayName("enqueue: visual task khi images-enabled=false -> 0 job được tạo, lưu terminal UNAVAILABLE vào aiFeedback (Locked Decision #7)")
    void enqueue_visualTask_whenImagesDisabled_createsZeroJobs_andMergesUnavailableFeedback() {
        TestAttempt attempt = createAttemptWithWriting(10, 30, "q1");
        attempt.setId(10);

        ContextDecision.Unavailable unavailable = new ContextDecision.Unavailable(
                "VISUAL_CONTEXT_UNSUPPORTED",
                "Task contains visual context but image grading is disabled"
        );

        AttemptAnswer answerRecord = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(30)
                .userAnswers(Map.of("q1", "Valid essay containing more than ten words for evaluation."))
                .build();

        when(jobRepository.findByAttemptIdAndPartIdAndQuestionId(10, 30, "q1")).thenReturn(Optional.empty());
        when(contextReader.read(eq(attempt), eq(30), eq("q1"), any(), anyBoolean())).thenReturn(unavailable);
        when(attemptAnswerRepository.findByAttemptIdAndPartId(10, 30)).thenReturn(Optional.of(answerRecord));

        List<WritingGradingJob> jobs = enqueuer.enqueue(attempt, List.of(answerRecord));

        // Không tạo durable job
        assertThat(jobs).isEmpty();
        verify(jobRepository, never()).save(any(WritingGradingJob.class));

        // Lưu local terminal result vào aiFeedback
        assertThat(answerRecord.getAiFeedback()).isNotNull();
        assertThat(answerRecord.getAiFeedback()).containsEntry("schemaVersion", 1);
        @SuppressWarnings("unchecked")
        Map<String, Object> tasks = (Map<String, Object>) answerRecord.getAiFeedback().get("tasks");
        assertThat(tasks).containsKey("q1");
        @SuppressWarnings("unchecked")
        Map<String, Object> taskResult = (Map<String, Object>) tasks.get("q1");
        assertThat(taskResult).containsEntry("status", "UNAVAILABLE");
        assertThat(taskResult).containsEntry("reasonCode", "VISUAL_CONTEXT_UNSUPPORTED");
        assertThat(taskResult.get("score")).isNull();
        assertThat(taskResult.get("overallScore")).isNull();
    }

    @Test
    @DisplayName("enqueue: visual task khi images-enabled=true -> tạo job READY với đúng imageCount và frozen URLs")
    void enqueue_visualTask_whenImagesEnabled_createsReadyJobWithImageCount() {
        properties.setEnabled(true);
        properties.setImagesEnabled(true);

        TestAttempt attempt = createAttemptWithWriting(10, 30, "q1");
        attempt.setId(10);

        WritingGradingContext context = new WritingGradingContext(
                30,
                "q1",
                "Part 1",
                "Instruction",
                null,
                "Describe chart",
                "Valid essay with more than ten English words for image evaluation.",
                "en",
                11,
                List.of(new WritingImageRef("https://example.com/chart.png"))
        );

        when(jobRepository.findByAttemptIdAndPartIdAndQuestionId(10, 30, "q1")).thenReturn(Optional.empty());
        when(contextReader.read(eq(attempt), eq(30), eq("q1"), any(), anyBoolean())).thenReturn(new ContextDecision.Eligible(context));
        when(jobRepository.save(any(WritingGradingJob.class))).thenAnswer(inv -> inv.getArgument(0));

        List<WritingGradingJob> jobs = enqueuer.enqueue(attempt, List.of());

        assertThat(jobs).hasSize(1);
        WritingGradingJob job = jobs.get(0);
        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.READY);
        assertThat(job.getImageCount()).isEqualTo(1);
        assertThat(job.getContextJson()).containsKey("images");
        verify(jobRepository).save(any(WritingGradingJob.class));
    }
}
