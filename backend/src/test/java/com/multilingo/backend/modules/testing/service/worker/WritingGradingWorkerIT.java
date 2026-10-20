package com.multilingo.backend.modules.testing.service.worker;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.FixtureAdaptersTestConfig;
import com.multilingo.backend.modules.analytics.entity.UserQuota;
import com.multilingo.backend.modules.analytics.repository.UserQuotaRepository;
import com.multilingo.backend.modules.analytics.service.UserQuotaReservationService;
import com.multilingo.backend.modules.testing.ai.gemini.*;
import com.multilingo.backend.modules.testing.ai.media.FetchedImage;
import com.multilingo.backend.modules.testing.ai.media.ImageFetcher;
import com.multilingo.backend.modules.testing.config.WritingGradingProperties;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.WritingGradingJob;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.entity.enums.WritingGradingJobStatus;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.repository.WritingGradingJobRepository;
import com.multilingo.backend.modules.testing.service.scheduler.WritingGradingDispatcher;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@SpringBootTest(properties = "spring.main.allow-bean-definition-overriding=true")
@Import(FixtureAdaptersTestConfig.class)
@ActiveProfiles("test")
public class WritingGradingWorkerIT {

    @MockBean
    private GeminiClient geminiClient;

    @MockBean
    private ImageFetcher imageFetcher;

    @Autowired
    private WritingGradingWorker worker;

    @Autowired
    private WritingGradingDispatcher dispatcher;

    @Autowired
    private WritingGradingJobRepository jobRepository;

    @Autowired
    private TestAttemptRepository testAttemptRepository;

    @Autowired
    private AttemptAnswerRepository attemptAnswerRepository;

    @Autowired
    private UserQuotaRepository userQuotaRepository;

    @Autowired
    private WritingGradingProperties properties;

    @Autowired
    private GeminiProperties geminiProperties;

    @Autowired
    private ObjectMapper objectMapper;

    private Integer testUserId = 9999;
    private TestAttempt testAttempt;
    private UserQuota testQuota;

    @BeforeEach
    void setUp() {
        properties.setEnabled(true);
        properties.setImagesEnabled(false);
        properties.setDispatcherEnabled(false);

        if (geminiProperties != null) {
            geminiProperties.setEnabled(true);
            geminiProperties.setRequestTimeout(Duration.ofSeconds(30));
        }

        testQuota = UserQuota.builder()
                .userId(testUserId)
                .featureCode(UserQuotaReservationService.GRADING_FEATURE_CODE)
                .maxLimit(10)
                .usedCount(0)
                .resetDate(Instant.now().plusSeconds(86400))
                .build();
        testQuota = userQuotaRepository.save(testQuota);

        testAttempt = TestAttempt.builder()
                .userId(testUserId)
                .examId(1)
                .testMode(TestMode.MOCK_TEST)
                .testScope(TestScope.FULL_EXAM)
                .status(AttemptStatus.AI_GRADING)
                .startTime(Instant.now().minusSeconds(100))
                .build();
        testAttempt = testAttemptRepository.save(testAttempt);
    }

    @AfterEach
    void tearDown() {
        properties.setEnabled(false);
        properties.setImagesEnabled(false);
        properties.setDispatcherEnabled(false);
        if (geminiProperties != null) {
            geminiProperties.setEnabled(true);
        }
        jobRepository.deleteAll();
        attemptAnswerRepository.deleteAll();
        testAttemptRepository.deleteAll();
        userQuotaRepository.deleteAll();
    }

    private WritingGradingJob createTextJob(Integer partId, String questionId, String essay, int wordCount) {
        Map<String, Object> contextJson = new LinkedHashMap<>();
        contextJson.put("partId", partId);
        contextJson.put("questionId", questionId);
        contextJson.put("taskPrompt", "Write an essay about technology.");
        contextJson.put("originalText", essay);
        contextJson.put("learningLanguage", "en");
        contextJson.put("wordCount", wordCount);
        contextJson.put("images", List.of());

        WritingGradingJob job = WritingGradingJob.builder()
                .attemptId(testAttempt.getId())
                .partId(partId)
                .questionId(questionId)
                .contextJson(contextJson)
                .inputHash("hash-" + questionId)
                .status(WritingGradingJobStatus.READY)
                .attemptCount(0)
                .quotaReserved(false)
                .imageCount(0)
                .build();
        job = jobRepository.save(job);

        // Tạo hoặc cập nhật AttemptAnswer tương ứng cho partId này
        AttemptAnswer answer = attemptAnswerRepository.findByAttemptIdAndPartId(testAttempt.getId(), partId)
                .orElseGet(() -> AttemptAnswer.builder()
                        .attempt(testAttempt)
                        .partId(partId)
                        .userAnswers(new LinkedHashMap<>())
                        .aiFeedback(new LinkedHashMap<>())
                        .build());
        Map<String, Object> answers = new LinkedHashMap<>(answer.getUserAnswers());
        answers.put(questionId, essay);
        answer.setUserAnswers(answers);
        attemptAnswerRepository.save(answer);

        return job;
    }

    private WritingGradingJob createVisualJob(Integer partId, String questionId, String essay, int wordCount, String imageUrl) {
        Map<String, Object> imgRef = new LinkedHashMap<>();
        imgRef.put("url", imageUrl);

        Map<String, Object> contextJson = new LinkedHashMap<>();
        contextJson.put("partId", partId);
        contextJson.put("questionId", questionId);
        contextJson.put("taskPrompt", "Describe the chart.");
        contextJson.put("originalText", essay);
        contextJson.put("learningLanguage", "en");
        contextJson.put("wordCount", wordCount);
        contextJson.put("images", List.of(imgRef));

        WritingGradingJob job = WritingGradingJob.builder()
                .attemptId(testAttempt.getId())
                .partId(partId)
                .questionId(questionId)
                .contextJson(contextJson)
                .inputHash("hash-" + questionId)
                .status(WritingGradingJobStatus.READY)
                .attemptCount(0)
                .quotaReserved(false)
                .imageCount(1)
                .build();
        job = jobRepository.save(job);

        AttemptAnswer answer = attemptAnswerRepository.findByAttemptIdAndPartId(testAttempt.getId(), partId)
                .orElseGet(() -> AttemptAnswer.builder()
                        .attempt(testAttempt)
                        .partId(partId)
                        .userAnswers(new LinkedHashMap<>())
                        .aiFeedback(new LinkedHashMap<>())
                        .build());
        Map<String, Object> answers = new LinkedHashMap<>(answer.getUserAnswers());
        answers.put(questionId, essay);
        answer.setUserAnswers(answers);
        attemptAnswerRepository.save(answer);

        return job;
    }

    private String validTextOnlyJsonResponse(String essay) {
        return """
                {
                  "feedbackLanguage": "vi",
                  "criteria": [
                    {"code": "TR", "score": 7.0, "feedback": "Ý tưởng phản hồi tốt."},
                    {"code": "CC", "score": 7.0, "feedback": "Mạch lạc rõ ràng."},
                    {"code": "LR", "score": 6.5, "feedback": "Từ vựng tương đối phong phú."},
                    {"code": "GRA", "score": 6.5, "feedback": "Ngữ pháp chính xác."}
                  ],
                  "overallFeedback": "Bài viết đạt yêu cầu rất tốt.",
                  "correctedEssay": "%s",
                  "corrections": []
                }
                """.formatted(essay);
    }

    private String validVisualJsonResponse(String essay, String visualObservations) {
        return """
                {
                  "feedbackLanguage": "vi",
                  "visualObservations": "%s",
                  "criteria": [
                    {"code": "TR", "score": 7.5, "feedback": "Mô tả số liệu chính xác theo biểu đồ."},
                    {"code": "CC", "score": 7.0, "feedback": "Bố cục logic."},
                    {"code": "LR", "score": 7.0, "feedback": "Từ vựng học thuật tốt."},
                    {"code": "GRA", "score": 7.5, "feedback": "Cấu trúc câu đa dạng."}
                  ],
                  "overallFeedback": "Phân tích biểu đồ xuất sắc.",
                  "correctedEssay": "%s",
                  "corrections": []
                }
                """.formatted(visualObservations, essay);
    }

    @Test
    @DisplayName("IT: Text-only worker end-to-end -> Gemini gọi ngoài transaction, job SUCCEEDED, attempt COMPLETED, quota trừ 1")
    void workerProcess_textOnly_endToEnd_geminiCalledOutsideTransaction_andJobSucceeds() {
        String essay = "Learning a foreign language opens many doors and creates wonderful opportunities for every young individual.";
        WritingGradingJob job = createTextJob(1, "q-1", essay, 16);

        AtomicBoolean txActiveDuringGemini = new AtomicBoolean(true);
        when(geminiClient.generate(any(GeminiGenerationRequest.class))).thenAnswer(invocation -> {
            txActiveDuringGemini.set(TransactionSynchronizationManager.isActualTransactionActive());
            return new GeminiGenerationResult(
                    validTextOnlyJsonResponse(essay),
                    new GeminiGenerationResult.Usage(100, 150, 250)
            );
        });

        worker.process(job.getId());

        assertThat(txActiveDuringGemini.get()).isFalse();

        WritingGradingJob updatedJob = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(updatedJob.getStatus()).isEqualTo(WritingGradingJobStatus.SUCCEEDED);
        assertThat(updatedJob.getCompletedAt()).isNotNull();
        assertThat(updatedJob.getResultJson()).isNotNull();
        assertThat(updatedJob.getQuotaReserved()).isTrue();
        assertThat(updatedJob.getAttemptCount()).isEqualTo(1);

        TestAttempt updatedAttempt = testAttemptRepository.findById(testAttempt.getId()).orElseThrow();
        assertThat(updatedAttempt.getStatus()).isEqualTo(AttemptStatus.COMPLETED);

        AttemptAnswer updatedAnswer = attemptAnswerRepository.findByAttemptId(testAttempt.getId()).getFirst();
        assertThat(updatedAnswer.getAiFeedback()).isNotNull();
        assertThat(updatedAnswer.getAiFeedback().get("schemaVersion")).isEqualTo(1);

        UserQuota updatedQuota = userQuotaRepository.findById(testQuota.getId()).orElseThrow();
        assertThat(updatedQuota.getUsedCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("IT: Visual worker end-to-end -> ImageFetcher và Gemini gọi ngoài transaction, job SUCCEEDED, digests đính kèm")
    void workerProcess_withImages_endToEnd_imageFetcherAndGeminiCalledOutsideTransaction_andJobSucceeds() {
        properties.setImagesEnabled(true);
        String essay = "The bar chart illustrates the trend of energy consumption across three major sectors over ten years.";
        String imageUrl = "https://example.com/chart-test.png";
        WritingGradingJob job = createVisualJob(1, "q-visual-1", essay, 17, imageUrl);

        AtomicBoolean txActiveDuringFetch = new AtomicBoolean(true);
        when(imageFetcher.fetch(imageUrl)).thenAnswer(invocation -> {
            txActiveDuringFetch.set(TransactionSynchronizationManager.isActualTransactionActive());
            return new FetchedImage("image/png", new byte[]{0x12, 0x34, 0x56, 0x78});
        });

        AtomicBoolean txActiveDuringGemini = new AtomicBoolean(true);
        when(geminiClient.generate(any(GeminiGenerationRequest.class))).thenAnswer(invocation -> {
            txActiveDuringGemini.set(TransactionSynchronizationManager.isActualTransactionActive());
            return new GeminiGenerationResult(
                    validVisualJsonResponse(essay, "Biểu đồ cột thể hiện mức tiêu thụ năng lượng theo 3 ngành."),
                    new GeminiGenerationResult.Usage(120, 200, 320)
            );
        });

        worker.process(job.getId());

        assertThat(txActiveDuringFetch.get()).isFalse();
        assertThat(txActiveDuringGemini.get()).isFalse();

        WritingGradingJob updatedJob = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(updatedJob.getStatus()).isEqualTo(WritingGradingJobStatus.SUCCEEDED);
        assertThat(updatedJob.getCompletedAt()).isNotNull();

        UserQuota updatedQuota = userQuotaRepository.findById(testQuota.getId()).orElseThrow();
        assertThat(updatedQuota.getUsedCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("IT: Gemini lỗi tạm thời (TIMEOUT) -> job chuyển RETRY_WAIT, giữ nguyên quota reservation")
    void workerProcess_whenGeminiThrowsRetryable_jobStatusTransitionsToRetryWait_quotaKeptReserved() {
        String essay = "This essay has more than ten words to be eligible for automatic grading by AI.";
        WritingGradingJob job = createTextJob(1, "q-retry", essay, 14);

        when(geminiClient.generate(any())).thenThrow(
                new GeminiClientException(GeminiClientException.Kind.TIMEOUT, "Gemini gateway timeout")
        );

        worker.process(job.getId());

        WritingGradingJob updatedJob = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(updatedJob.getStatus()).isEqualTo(WritingGradingJobStatus.RETRY_WAIT);
        assertThat(updatedJob.getAttemptCount()).isEqualTo(1);
        assertThat(updatedJob.getQuotaReserved()).isTrue();
        assertThat(updatedJob.getNextAttemptAt()).isAfter(Instant.now());

        // Quota vẫn được giữ, không bị refund
        UserQuota updatedQuota = userQuotaRepository.findById(testQuota.getId()).orElseThrow();
        assertThat(updatedQuota.getUsedCount()).isEqualTo(1);

        TestAttempt updatedAttempt = testAttemptRepository.findById(testAttempt.getId()).orElseThrow();
        assertThat(updatedAttempt.getStatus()).isEqualTo(AttemptStatus.AI_GRADING);
    }

    @Test
    @DisplayName("IT: Gemini lỗi vĩnh viễn (AUTHENTICATION) -> job FAILED, hoàn trả quota, attempt GRADING_FAILED")
    void workerProcess_whenGeminiThrowsTerminal_jobStatusTransitionsToFailed_quotaRefunded() {
        String essay = "This essay has more than ten words to be eligible for automatic grading by AI.";
        WritingGradingJob job = createTextJob(1, "q-fail", essay, 14);

        when(geminiClient.generate(any())).thenThrow(
                new GeminiClientException(GeminiClientException.Kind.AUTHENTICATION, "API key invalid")
        );

        worker.process(job.getId());

        WritingGradingJob updatedJob = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(updatedJob.getStatus()).isEqualTo(WritingGradingJobStatus.FAILED);
        assertThat(updatedJob.getQuotaReserved()).isFalse();
        assertThat(updatedJob.getLastErrorCode()).isEqualTo("AUTHENTICATION");

        // Quota đã được refund
        UserQuota updatedQuota = userQuotaRepository.findById(testQuota.getId()).orElseThrow();
        assertThat(updatedQuota.getUsedCount()).isZero();

        TestAttempt updatedAttempt = testAttemptRepository.findById(testAttempt.getId()).orElseThrow();
        assertThat(updatedAttempt.getStatus()).isEqualTo(AttemptStatus.GRADING_FAILED);
    }

    @Test
    @DisplayName("IT: Bài thi ngắn (<= 10 từ) -> short-circuit điểm 0, không gọi Gemini, job SUCCEEDED, attempt COMPLETED")
    void workerProcess_whenShortEssay_shortCircuitsWithoutCallingGemini_andSucceedsWithZeroScore() {
        String essay = "Too short essay.";
        WritingGradingJob job = createTextJob(1, "q-short", essay, 3);

        worker.process(job.getId());

        verifyNoInteractions(geminiClient);

        WritingGradingJob updatedJob = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(updatedJob.getStatus()).isEqualTo(WritingGradingJobStatus.SUCCEEDED);

        TestAttempt updatedAttempt = testAttemptRepository.findById(testAttempt.getId()).orElseThrow();
        assertThat(updatedAttempt.getStatus()).isEqualTo(AttemptStatus.COMPLETED);
    }

    @Test
    @DisplayName("IT: Dispatcher tick end-to-end -> điều phối batch due jobs qua executor và hoàn thành")
    void dispatcher_tick_endToEnd_dispatchesJobsAndExecutesViaWorker() throws Exception {
        properties.setDispatcherEnabled(true);
        properties.setConcurrency(2);
        properties.setBatchSize(10);

        String essay1 = "First valid essay with more than ten words submitted by student one.";
        String essay2 = "Second valid essay with more than ten words submitted by student two.";
        WritingGradingJob job1 = createTextJob(1, "q-batch-1", essay1, 12);
        WritingGradingJob job2 = createTextJob(1, "q-batch-2", essay2, 12);

        when(geminiClient.generate(any(GeminiGenerationRequest.class))).thenAnswer(invocation -> {
            GeminiGenerationRequest req = invocation.getArgument(0);
            String essay = req.userText().contains(essay1) ? essay1 : essay2;
            return new GeminiGenerationResult(
                    validTextOnlyJsonResponse(essay),
                    new GeminiGenerationResult.Usage(100, 150, 250)
            );
        });

        dispatcher.tick();

        // Chờ các tác vụ bất đồng bộ trong executor hoàn tất
        long deadline = System.currentTimeMillis() + 8000;
        while (System.currentTimeMillis() < deadline) {
            WritingGradingJob j1 = jobRepository.findById(job1.getId()).orElseThrow();
            WritingGradingJob j2 = jobRepository.findById(job2.getId()).orElseThrow();
            if (j1.getStatus() == WritingGradingJobStatus.SUCCEEDED && j2.getStatus() == WritingGradingJobStatus.SUCCEEDED) {
                break;
            }
            Thread.sleep(100);
        }

        WritingGradingJob updatedJob1 = jobRepository.findById(job1.getId()).orElseThrow();
        WritingGradingJob updatedJob2 = jobRepository.findById(job2.getId()).orElseThrow();
        assertThat(updatedJob1.getStatus()).isEqualTo(WritingGradingJobStatus.SUCCEEDED);
        assertThat(updatedJob2.getStatus()).isEqualTo(WritingGradingJobStatus.SUCCEEDED);
    }
}
