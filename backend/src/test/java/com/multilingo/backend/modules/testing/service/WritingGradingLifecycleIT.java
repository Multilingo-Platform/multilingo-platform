package com.multilingo.backend.modules.testing.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.analytics.entity.UserQuota;
import com.multilingo.backend.modules.analytics.repository.UserQuotaRepository;
import com.multilingo.backend.modules.analytics.service.UserQuotaReservationService;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.entity.ExamPart;
import com.multilingo.backend.modules.exam.entity.ExamSection;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamSectionRepository;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.ai.gemini.*;
import com.multilingo.backend.modules.testing.ai.grading.WritingGrade;
import com.multilingo.backend.modules.testing.config.WritingGradingProperties;
import com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest;
import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.dto.request.SubmitAttemptRequest;
import com.multilingo.backend.modules.testing.dto.response.ExamResultResponse;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;
import com.multilingo.backend.modules.testing.dto.response.WritingFeedbackResponse;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.WritingGradingJob;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.SubmitReason;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.entity.enums.WritingGradingJobStatus;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.repository.WritingGradingJobRepository;
import com.multilingo.backend.modules.testing.service.support.Claim;
import com.multilingo.backend.modules.testing.service.support.ClaimDecision;
import com.multilingo.backend.modules.testing.service.support.WritingGradingTransactionCoordinator;
import com.multilingo.backend.modules.testing.service.worker.WritingGradingWorker;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.concurrent.*;
import java.security.MessageDigest;
import com.multilingo.backend.modules.testing.ai.media.ImageFetcher;
import com.multilingo.backend.modules.testing.ai.media.FetchedImage;
import com.multilingo.backend.modules.testing.ai.media.ImageFetchException;
import org.junit.jupiter.params.provider.CsvSource;
import com.multilingo.backend.modules.testing.ai.grading.WritingGradingImageLoader;
import com.multilingo.backend.modules.testing.ai.grading.WritingGradingGenerator;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

@AutoConfigureMockMvc
@WithMockUser(username = "1", roles = "USER")
@SpringBootTest
@ActiveProfiles("test")
public class WritingGradingLifecycleIT {

    @Autowired
    private TestAttemptService testAttemptService;

    @Autowired
    private WritingFeedbackService writingFeedbackService;

    @Autowired
    private WritingGradingWorker worker;

    @Autowired
    private WritingGradingTransactionCoordinator coordinator;

    @Autowired
    private TestAttemptRepository testAttemptRepository;

    @Autowired
    private AttemptAnswerRepository attemptAnswerRepository;

    @Autowired
    private WritingGradingJobRepository jobRepository;

    @Autowired
    private ExamRepository examRepository;

    @Autowired
    private ExamSectionRepository examSectionRepository;

    @Autowired
    private ExamPartRepository examPartRepository;

    @Autowired
    private UserQuotaRepository userQuotaRepository;

    @Autowired
    private WritingGradingProperties gradingProperties;

    @Autowired
    private GeminiProperties geminiProperties;

    @Autowired
    private ObjectMapper objectMapper;

    @SpyBean
    private IdentityAdapter identityAdapter;

    @MockBean
    private GeminiClient geminiClient;

    @Autowired private MockMvc mockMvc;
    @Autowired private WritingGradingImageLoader imageLoader;
    @Autowired private WritingGradingGenerator generator;
    @MockBean private ImageFetcher imageFetcher;

    private final List<Integer> createdAttemptIds = new ArrayList<>();
    private final List<Integer> createdExamIds = new ArrayList<>();
    private final Integer ownerId = 1;

    public record SeededExam(Exam exam, ExamPart readingPart, ExamPart writingPart) {}

    @BeforeEach
    void setUp() {
        reset(geminiClient, imageFetcher);
        when(identityAdapter.getCurrentUserId()).thenReturn(ownerId);
        gradingProperties.setEnabled(true);
        gradingProperties.setImagesEnabled(false);
        gradingProperties.setDispatcherEnabled(false);

        if (geminiProperties != null) {
            geminiProperties.setEnabled(true);
            geminiProperties.setRequestTimeout(java.time.Duration.ofSeconds(30));
        }

        try {
            userQuotaRepository.deleteAll(userQuotaRepository.findAllByUserIdAndFeatureCode(ownerId, UserQuotaReservationService.GRADING_FEATURE_CODE));
        } catch (Exception ignored) {}

        UserQuota quota = UserQuota.builder()
                .userId(ownerId)
                .featureCode(UserQuotaReservationService.GRADING_FEATURE_CODE)
                .maxLimit(100)
                .usedCount(0)
                .resetDate(Instant.now().plusSeconds(86400).truncatedTo(ChronoUnit.SECONDS))
                .build();
        userQuotaRepository.save(quota);
    }

    @AfterEach
    void tearDown() {
        reset(geminiClient);
        gradingProperties.setEnabled(false);
        gradingProperties.setImagesEnabled(false);
        gradingProperties.setDispatcherEnabled(false);
        if (geminiProperties != null) {
            geminiProperties.setEnabled(false);
        }

        try {
            userQuotaRepository.deleteAll(userQuotaRepository.findAllByUserIdAndFeatureCode(ownerId, UserQuotaReservationService.GRADING_FEATURE_CODE));
        } catch (Exception ignored) {}

        for (Integer attemptId : createdAttemptIds) {
            try {
                jobRepository.deleteAll(jobRepository.findAllByAttemptId(attemptId));
                attemptAnswerRepository.deleteAll(attemptAnswerRepository.findByAttemptId(attemptId));
                testAttemptRepository.deleteById(attemptId);
            } catch (Exception ignored) {}
        }
        createdAttemptIds.clear();

        for (Integer examId : createdExamIds) {
            try {
                List<ExamSection> sections = examSectionRepository.findByExam_Id(examId);
                for (ExamSection s : sections) {
                    examPartRepository.deleteAll(examPartRepository.findBySection_Id(s.getId()));
                }
                examSectionRepository.deleteAll(sections);
                examRepository.deleteById(examId);
            } catch (Exception ignored) {}
        }
        createdExamIds.clear();
    }

    private SeededExam seedExam(String code, String language, int writingTasksCount) {
        Exam exam = Exam.builder()
                .code(code)
                .title("Lifecycle Test Exam " + code)
                .type("IELTS")
                .examLanguage(language)
                .durationMinutes(60)
                .isPublished(true)
                .build();
        exam = examRepository.save(exam);
        createdExamIds.add(exam.getId());

        // 1. Reading Section (Objective)
        ExamSection rSection = ExamSection.builder()
                .exam(exam)
                .skillType("READING")
                .title("Reading Section")
                .durationMinutes(30)
                .orderIndex(1)
                .build();
        rSection = examSectionRepository.save(rSection);

        Map<String, Object> rPartData = Map.of(
                "title", "Reading Part 1",
                "question_groups", List.of(
                        Map.of(
                                "instruction", "Choose correct answer",
                                "questions", List.of(
                                        Map.of("question_id", "q_read_1", "type", "SINGLE_CHOICE", "correct_answer", "A")
                                )
                        )
                )
        );
        ExamPart rPart = ExamPart.builder()
                .section(rSection)
                .partNumber(1)
                .contentData(rPartData)
                .build();
        rPart = examPartRepository.save(rPart);

        // 2. Writing Section
        ExamSection wSection = ExamSection.builder()
                .exam(exam)
                .skillType("WRITING")
                .title("Writing Section")
                .durationMinutes(30)
                .orderIndex(2)
                .build();
        wSection = examSectionRepository.save(wSection);

        List<Map<String, Object>> questions = new ArrayList<>();
        for (int i = 1; i <= writingTasksCount; i++) {
            questions.add(Map.of(
                    "question_id", "essay_task_" + i,
                    "type", "ESSAY",
                    "prompt", "Task " + i + " prompt: Discuss global technological challenges."
            ));
        }

        Map<String, Object> wPartData = Map.of(
                "title", "Writing Tasks Part",
                "question_groups", List.of(
                        Map.of(
                                "instruction", "Answer the essay prompts",
                                "questions", questions
                        )
                )
        );
        ExamPart wPart = ExamPart.builder()
                .section(wSection)
                .partNumber(1)
                .contentData(wPartData)
                .build();
        wPart = examPartRepository.save(wPart);

        return new SeededExam(exam, rPart, wPart);
    }

    private String validJsonResponse(String essay, double score) {
        return """
                {
                  "feedbackLanguage": "vi",
                  "criteria": [
                    {"code": "TR", "score": %.1f, "feedback": "Ý tưởng phản hồi rất tốt."},
                    {"code": "CC", "score": %.1f, "feedback": "Bố cục lạc quan, liên kết tự nhiên."},
                    {"code": "LR", "score": %.1f, "feedback": "Từ vựng phong phú và chính xác."},
                    {"code": "GRA", "score": %.1f, "feedback": "Ngữ pháp linh hoạt và ít lỗi."}
                  ],
                  "overallFeedback": "Bài viết toàn diện, phát triển ý tưởng rất thuyết phục.",
                  "correctedEssay": "%s",
                  "corrections": []
                }
                """.formatted(score, score, score, score, essay);
    }

    @Test
    @DisplayName("AC-01, AC-08: Full production pipeline from submit -> worker processing -> feedback GET with objective invariance")
    void fullLifecycle_create_submit_worker_feedback() throws Exception {
        SeededExam seeded = seedExam("LC_FULL_01", "en", 1);
        Exam exam = seeded.exam();
        ExamPart readingPart = seeded.readingPart();
        ExamPart writingPart = seeded.writingPart();

        // 1. Create Attempt
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        // 2. Autosave Answers
        testAttemptService.autosaveAnswers(attemptId, AutosaveAnswersRequest.builder()
                .version(1)
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(readingPart.getId())
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder().questionId("q_read_1").answer("A").build()
                                ))
                                .build()
                ))
                .build());

        String essayText = "Artificial intelligence and automation will transform modern workplace dynamics in unprecedented ways globally.";
        testAttemptService.autosaveAnswers(attemptId, AutosaveAnswersRequest.builder()
                .version(2)
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(writingPart.getId())
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder().questionId("essay_task_1").answer(essayText).build()
                                ))
                                .build()
                ))
                .build());

        // 3. Submit Attempt
        testAttemptService.submitAttempt(attemptId, SubmitAttemptRequest.builder().reason(SubmitReason.MANUAL).build());

        TestAttempt attemptAfterSubmit = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(attemptAfterSubmit.getStatus()).isEqualTo(AttemptStatus.AI_GRADING);

        List<WritingGradingJob> jobs = jobRepository.findAllByAttemptId(attemptId);
        assertThat(jobs).hasSize(1);
        WritingGradingJob job = jobs.get(0);
        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.READY);

        // Capture /result before worker
        ExamResultResponse resultBefore = testAttemptService.getAttemptResult(attemptId);
        assertThat(resultBefore.getResultSummary().getObjective().getTotal()).isEqualTo(1);
        assertThat(resultBefore.getResultSummary().getObjective().getCorrect()).isEqualTo(1);
        assertThat(resultBefore.getResultSummary().getWriting().getStatus()).isEqualTo("PENDING");

        // 4. Mock Gemini and Execute Worker
        when(geminiClient.generate(any(GeminiGenerationRequest.class)))
                .thenReturn(new GeminiGenerationResult(
                        validJsonResponse(essayText, 7.5),
                        new GeminiGenerationResult.Usage(100, 200, 300)
                ));

        worker.process(job.getId());

        // 5. Verify Post-Worker State
        WritingGradingJob finishedJob = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(finishedJob.getStatus()).isEqualTo(WritingGradingJobStatus.SUCCEEDED);
        assertHttpDone(attemptId, writingPart.getId(), essayText, 7.5);
        assertThat(finishedJob.getQuotaReserved()).isTrue();

        TestAttempt completedAttempt = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(completedAttempt.getStatus()).isEqualTo(AttemptStatus.COMPLETED);

        // 6. Verify Writing Feedback API
        WritingFeedbackResponse feedback = writingFeedbackService.getWritingFeedback(attemptId, writingPart.getId());
        assertThat(feedback.attemptStatus()).isEqualTo("COMPLETED");
        assertThat(feedback.partStatus()).isEqualTo("DONE");
        assertThat(feedback.tasks()).hasSize(1);

        WritingFeedbackResponse.TaskFeedback task = feedback.tasks().get(0);
        assertThat(task.questionId()).isEqualTo("essay_task_1");
        assertThat(task.status()).isEqualTo("DONE");
        assertThat(task.overall()).isEqualByComparingTo(BigDecimal.valueOf(7.5));
        assertThat(task.originalText()).isEqualTo(essayText);
        assertThat(task.criteria()).hasSize(4);
        assertThat(task.overallFeedback()).contains("Bài viết toàn diện");

        // 7. Verify /result Objective Invariance
        ExamResultResponse resultAfter = testAttemptService.getAttemptResult(attemptId);
        assertThat(resultAfter.getResultSummary().getObjective())
                .usingRecursiveComparison()
                .isEqualTo(resultBefore.getResultSummary().getObjective());
        assertThat(resultAfter.getResultSummary().getWriting().getTasks().get(0).getScore()).isNull();
    }

    @Test
    @DisplayName("AC-01, AC-04: Frozen attempt snapshot is completely isolated from post-creation database exam changes")
    void snapshotImmutability_examSourceChangeAfterAttemptCreation() {
        SeededExam seeded = seedExam("LC_SNAP_01", "en", 1);
        Exam exam = seeded.exam();
        ExamPart writingPart = seeded.writingPart();

        // 1. Create Attempt
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        // 2. Mutate Exam in database AFTER creation
        exam.setTitle("MUTATED_TITLE_ATTACK");
        exam.setExamLanguage("fr");
        examRepository.save(exam);

        Map<String, Object> mutatedPartData = new HashMap<>(writingPart.getContentData());
        mutatedPartData.put("title", "MUTATED_PART_TITLE");
        writingPart.setContentData(mutatedPartData);
        examPartRepository.save(writingPart);

        // 3. Autosave and Submit
        String essayText = "High quality educational resources must remain accessible to students regardless of socioeconomic barriers.";
        testAttemptService.autosaveAnswers(attemptId, AutosaveAnswersRequest.builder()
                .version(1)
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(writingPart.getId())
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder().questionId("essay_task_1").answer(essayText).build()
                                ))
                                .build()
                ))
                .build());

        testAttemptService.submitAttempt(attemptId, SubmitAttemptRequest.builder().reason(SubmitReason.MANUAL).build());

        // 4. Capture request sent to Gemini
        ArgumentCaptor<GeminiGenerationRequest> requestCaptor = ArgumentCaptor.forClass(GeminiGenerationRequest.class);
        when(geminiClient.generate(requestCaptor.capture()))
                .thenReturn(new GeminiGenerationResult(
                        validJsonResponse(essayText, 7.0),
                        new GeminiGenerationResult.Usage(100, 100, 200)
                ));

        WritingGradingJob job = jobRepository.findAllByAttemptId(attemptId).get(0);
        worker.process(job.getId());

        // Verify captured prompt uses frozen snapshot values, not mutated DB values
        GeminiGenerationRequest sentRequest = requestCaptor.getValue();
        assertThat(sentRequest.userText()).contains("Writing Tasks Part");
        assertThat(sentRequest.userText()).doesNotContain("MUTATED_PART_TITLE");
        assertThat(sentRequest.userText()).contains("\"learningLanguage\":\"en\"");
        assertThat(sentRequest.userText()).doesNotContain("\"learningLanguage\":\"fr\"");

        WritingGradingJob finishedJob = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(finishedJob.getStatus()).isEqualTo(WritingGradingJobStatus.SUCCEEDED);
    }

    @Test
    @DisplayName("AC-05, AC-06: Worker handles transient error with backoff in RETRY_WAIT, subsequent run succeeds without double reservation")
    void workerRetry_transientError_retryWait_andSubsequentSuccess() {
        SeededExam seeded = seedExam("LC_RETRY_01", "en", 1);
        Exam exam = seeded.exam();
        ExamPart writingPart = seeded.writingPart();

        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        String essayText = "Environmental protection requires international agreements with binding enforcement mechanisms and active collaboration across all developed nations worldwide.";
        testAttemptService.autosaveAnswers(attemptId, AutosaveAnswersRequest.builder()
                .version(1)
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(writingPart.getId())
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder().questionId("essay_task_1").answer(essayText).build()
                                ))
                                .build()
                ))
                .build());

        testAttemptService.submitAttempt(attemptId, SubmitAttemptRequest.builder().reason(SubmitReason.MANUAL).build());

        WritingGradingJob job = jobRepository.findAllByAttemptId(attemptId).get(0);

        // 1. First run: Transient failure from provider
        reset(geminiClient);
        when(geminiClient.generate(any()))
                .thenThrow(new GeminiClientException(GeminiClientException.Kind.RATE_LIMITED, "Provider network timeout"));

        worker.process(job.getId());

        WritingGradingJob retryJob = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(retryJob.getStatus()).isEqualTo(WritingGradingJobStatus.RETRY_WAIT);
        assertThat(retryJob.getAttemptCount()).isEqualTo(1);
        assertThat(retryJob.getQuotaReserved()).isTrue();
        assertThat(retryJob.getNextAttemptAt()).isAfter(Instant.now());

        TestAttempt attemptInRetry = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(attemptInRetry.getStatus()).isEqualTo(AttemptStatus.AI_GRADING);

        // 2. Advance nextAttemptAt to simulate timer elapsed
        retryJob.setNextAttemptAt(Instant.now().minusSeconds(1));
        jobRepository.save(retryJob);

        // 3. Second run: Success
        reset(geminiClient);
        when(geminiClient.generate(any()))
                .thenReturn(new GeminiGenerationResult(
                        validJsonResponse(essayText, 8.0),
                        new GeminiGenerationResult.Usage(100, 100, 200)
                ));

        worker.process(job.getId());

        WritingGradingJob successfulJob = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(successfulJob.getStatus()).isEqualTo(WritingGradingJobStatus.SUCCEEDED);
        assertThat(successfulJob.getAttemptCount()).isEqualTo(2);
        assertThat(successfulJob.getQuotaReserved()).isTrue();

        TestAttempt finalAttempt = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(finalAttempt.getStatus()).isEqualTo(AttemptStatus.COMPLETED);
    }

    @Test
    @DisplayName("AC-05, AC-07: Expired lease and stale callback are fenced and cannot overwrite recovered job")
    void staleCallback_leaseExpired_fencingPreventsOverwrite() throws Exception {
        SeededExam seeded = seedExam("LC_FENCE_01", "en", 1);
        Exam exam = seeded.exam();
        ExamPart writingPart = seeded.writingPart();

        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        String essayText = "Scientific innovation depends heavily on public research funding and cross-border university partnerships.";
        testAttemptService.autosaveAnswers(attemptId, AutosaveAnswersRequest.builder()
                .version(1)
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(writingPart.getId())
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder().questionId("essay_task_1").answer(essayText).build()
                                ))
                                .build()
                ))
                .build());

        testAttemptService.submitAttempt(attemptId, SubmitAttemptRequest.builder().reason(SubmitReason.MANUAL).build());

        WritingGradingJob job = jobRepository.findAllByAttemptId(attemptId).get(0);

        // 1. Claim job to obtain Claim A with runId A
        ClaimDecision claimDec = coordinator.claim(job.getId());
        assertThat(claimDec).isInstanceOf(ClaimDecision.Granted.class);
        Claim staleClaimA = ((ClaimDecision.Granted) claimDec).claim();

        // 2. Simulate lease expiration in DB
        WritingGradingJob runningJob = jobRepository.findById(job.getId()).orElseThrow();
        runningJob.setLeaseUntil(Instant.now().minusSeconds(10));
        jobRepository.save(runningJob);

        // 3. Coordinator recovers expired lease
        int recovered = coordinator.recoverExpired(10);
        assertThat(recovered).isEqualTo(1);

        WritingGradingJob recoveredJob = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(recoveredJob.getStatus()).isEqualTo(WritingGradingJobStatus.RETRY_WAIT);

        // 4. Stale callback tries to complete using Claim A
        WritingGrade staleGrade = new WritingGrade(
                WritingGrade.DEFAULT_RUBRIC,
                WritingGrade.DEFAULT_LANGUAGE,
                BigDecimal.valueOf(9.0),
                List.of(new WritingGrade.CriterionGrade("TR", BigDecimal.valueOf(9.0), "Stale")),
                "Stale feedback",
                essayText,
                List.of(),
                List.of()
        );

        coordinator.complete(staleClaimA, staleGrade);

        // Verify fencing prevented update
        WritingGradingJob postFencingJob = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(postFencingJob.getStatus()).isEqualTo(WritingGradingJobStatus.RETRY_WAIT);
        assertThat(postFencingJob.getResultJson()).isNull();

        // A fresh worker has no in-memory state from the lost run; reuse only production dependencies.
        recoveredJob.setNextAttemptAt(Instant.now().minusSeconds(1));
        jobRepository.save(recoveredJob);
        when(geminiClient.generate(any())).thenReturn(new GeminiGenerationResult(
                validJsonResponse(essayText, 8.0), new GeminiGenerationResult.Usage(1, 1, 2)));
        WritingGradingWorker restartedWorker = new WritingGradingWorker(coordinator, imageLoader, generator, gradingProperties);
        restartedWorker.process(job.getId());
        WritingGradingJob completed = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(completed.getStatus()).isEqualTo(WritingGradingJobStatus.SUCCEEDED);
        assertThat(completed.getRunId()).isNotEqualTo(staleClaimA.runId());
        assertThat(completed.getAttemptCount()).isEqualTo(2);
        assertThat(completed.getQuotaReserved()).isTrue();
        assertThat(quotaUsed()).isEqualTo(1);
        coordinator.complete(staleClaimA, staleGrade);
        assertThat(jobRepository.findById(job.getId()).orElseThrow().getResultJson()).isEqualTo(completed.getResultJson());
        assertHttpDone(attemptId, writingPart.getId(), essayText, 8.0);
        verify(geminiClient, times(1)).generate(any());
    }

    @Test
    @DisplayName("AC-05, AC-08: Partial failure in multi-task exam preserves successful task and flags attempt GRADING_FAILED")
    void partialFailure_oneSucceeds_oneFailsTerminal_attemptGradingFailed() {
        SeededExam seeded = seedExam("LC_PARTIAL_01", "en", 2);
        Exam exam = seeded.exam();
        ExamPart writingPart = seeded.writingPart();

        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        String essay1 = "First valid essay with comprehensive analysis of economic trends across various markets.";
        String essay2 = "Second essay that triggers a terminal failure during processing because the content contains disallowed topics.";

        testAttemptService.autosaveAnswers(attemptId, AutosaveAnswersRequest.builder()
                .version(1)
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(writingPart.getId())
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder().questionId("essay_task_1").answer(essay1).build(),
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder().questionId("essay_task_2").answer(essay2).build()
                                ))
                                .build()
                ))
                .build());

        testAttemptService.submitAttempt(attemptId, SubmitAttemptRequest.builder().reason(SubmitReason.MANUAL).build());

        List<WritingGradingJob> jobs = jobRepository.findAllByAttemptId(attemptId);
        assertThat(jobs).hasSize(2);
        WritingGradingJob job1 = jobs.stream().filter(j -> "essay_task_1".equals(j.getQuestionId())).findFirst().orElseThrow();
        WritingGradingJob job2 = jobs.stream().filter(j -> "essay_task_2".equals(j.getQuestionId())).findFirst().orElseThrow();

        // Stub separately by essay content
        reset(geminiClient);
        when(geminiClient.generate(argThat(r -> r != null && r.userText().contains("First valid essay"))))
                .thenReturn(new GeminiGenerationResult(
                        validJsonResponse(essay1, 7.5),
                        new GeminiGenerationResult.Usage(100, 100, 200)
                ));

        when(geminiClient.generate(argThat(r -> r != null && r.userText().contains("Second essay"))))
                .thenThrow(new GeminiClientException(GeminiClientException.Kind.BLOCKED, "Sensitive terms blocked"));

        worker.process(job1.getId());
        worker.process(job2.getId());

        // Assert job statuses
        assertThat(jobRepository.findById(job1.getId()).orElseThrow().getStatus()).isEqualTo(WritingGradingJobStatus.SUCCEEDED);
        assertThat(jobRepository.findById(job2.getId()).orElseThrow().getStatus()).isEqualTo(WritingGradingJobStatus.FAILED);

        // Attempt resolves to GRADING_FAILED
        TestAttempt attempt = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(attempt.getStatus()).isEqualTo(AttemptStatus.GRADING_FAILED);

        // Feedback API response
        WritingFeedbackResponse feedback = writingFeedbackService.getWritingFeedback(attemptId, writingPart.getId());
        assertThat(feedback.attemptStatus()).isEqualTo("GRADING_FAILED");
        assertThat(feedback.partStatus()).isEqualTo("FAILED");

        WritingFeedbackResponse.TaskFeedback task1Feedback = feedback.tasks().stream()
                .filter(t -> "essay_task_1".equals(t.questionId())).findFirst().orElseThrow();
        assertThat(task1Feedback.status()).isEqualTo("DONE");
        assertThat(task1Feedback.overall()).isEqualByComparingTo(BigDecimal.valueOf(7.5));

        WritingFeedbackResponse.TaskFeedback task2Feedback = feedback.tasks().stream()
                .filter(t -> "essay_task_2".equals(t.questionId())).findFirst().orElseThrow();
        assertThat(task2Feedback.status()).isEqualTo("FAILED");
        assertThat(task2Feedback.overall()).isNull();
        assertThat(task2Feedback.displayMessage()).isEqualTo("Không thể chấm bài viết do lỗi hệ thống.");
        // Must not leak internal provider error message
        assertThat(task2Feedback.displayMessage()).doesNotContain("BLOCKED");
    }

    @Test
    @DisplayName("AC-03, AC-04: Provider disabled at submit leaves attempt queued in AI_GRADING_QUEUED without blocking submit")
    void quotaOrProviderDisabled_submitDoesNotFailOrHang_queued() {
        // Disable feature
        gradingProperties.setEnabled(false);

        SeededExam seeded = seedExam("LC_DIS_01", "en", 1);
        Exam exam = seeded.exam();
        ExamPart writingPart = seeded.writingPart();

        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(exam.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        String essayText = "Urban public transportation systems significantly reduce greenhouse emissions in dense metropolises.";
        testAttemptService.autosaveAnswers(attemptId, AutosaveAnswersRequest.builder()
                .version(1)
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(writingPart.getId())
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder().questionId("essay_task_1").answer(essayText).build()
                                ))
                                .build()
                ))
                .build());

        // Submit must succeed immediately without throwing
        testAttemptService.submitAttempt(attemptId, SubmitAttemptRequest.builder().reason(SubmitReason.MANUAL).build());

        WritingGradingJob job = jobRepository.findAllByAttemptId(attemptId).get(0);
        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.WAITING);
        assertThat(job.getWaitReason()).isEqualTo("FEATURE_DISABLED");

        TestAttempt attempt = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(attempt.getStatus()).isEqualTo(AttemptStatus.AI_GRADING_QUEUED);

        // Zero provider calls
        verifyNoInteractions(geminiClient);
    }

    @Test
    @DisplayName("AC-01, AC-03, AC-04: Short essay (<=10 words) and unsupported language are short-circuited without provider calls or quota")
    void shortEssayAndUnsupportedLanguage_noProviderCall_noQuotaDeducted() {
        // 1. Short essay (5 words)
        SeededExam seededEn = seedExam("LC_SHORT_01", "en", 1);
        Exam examEn = seededEn.exam();
        ExamPart writingPartEn = seededEn.writingPart();

        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(examEn.getId());
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);
        Integer attemptId = workspace.getAttemptId();
        createdAttemptIds.add(attemptId);

        String shortEssay = "Only five words written here.";
        testAttemptService.autosaveAnswers(attemptId, AutosaveAnswersRequest.builder()
                .version(1)
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(writingPartEn.getId())
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder().questionId("essay_task_1").answer(shortEssay).build()
                                ))
                                .build()
                ))
                .build());

        testAttemptService.submitAttempt(attemptId, SubmitAttemptRequest.builder().reason(SubmitReason.MANUAL).build());

        WritingGradingJob shortJob = jobRepository.findAllByAttemptId(attemptId).get(0);
        assertThat(shortJob.getStatus()).isEqualTo(WritingGradingJobStatus.SUCCEEDED);
        assertThat(shortJob.getQuotaReserved()).isFalse();
        assertThat(shortJob.getAttemptCount()).isEqualTo(0);

        TestAttempt shortAttempt = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(shortAttempt.getStatus()).isEqualTo(AttemptStatus.COMPLETED);

        WritingFeedbackResponse feedback = writingFeedbackService.getWritingFeedback(attemptId, writingPartEn.getId());
        WritingFeedbackResponse.TaskFeedback shortTaskFeedback = feedback.tasks().get(0);
        assertThat(shortTaskFeedback.reasonCode()).isEqualTo("TOO_SHORT");
        assertThat(shortTaskFeedback.overall()).isEqualByComparingTo(BigDecimal.ZERO);

        // 2. Unsupported language ("vi")
        SeededExam seededVi = seedExam("LC_VI_01", "vi", 1);
        Exam examVi = seededVi.exam();
        ExamPart writingPartVi = seededVi.writingPart();

        CreateAttemptRequest createReqVi = new CreateAttemptRequest();
        createReqVi.setExamId(examVi.getId());
        createReqVi.setTestScope(TestScope.FULL_EXAM);
        createReqVi.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse workspaceVi = testAttemptService.createAttempt(createReqVi);
        Integer attemptIdVi = workspaceVi.getAttemptId();
        createdAttemptIds.add(attemptIdVi);

        testAttemptService.autosaveAnswers(attemptIdVi, AutosaveAnswersRequest.builder()
                .version(1)
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(writingPartVi.getId())
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                .questionId("essay_task_1")
                                                .answer("Đây là bài văn tiếng Việt dài hơn mười từ để kiểm tra ngôn ngữ không hỗ trợ.")
                                                .build()
                                ))
                                .build()
                ))
                .build());

        testAttemptService.submitAttempt(attemptIdVi, SubmitAttemptRequest.builder().reason(SubmitReason.MANUAL).build());

        WritingGradingJob viJob = jobRepository.findAllByAttemptId(attemptIdVi).get(0);
        assertThat(viJob.getStatus()).isEqualTo(WritingGradingJobStatus.UNAVAILABLE);
        assertThat(viJob.getQuotaReserved()).isFalse();

        // In both cases: zero calls to provider
        verifyNoInteractions(geminiClient);
    }

    private static final String LONG_ESSAY = "The chart shows substantial changes in energy consumption across several different economic sectors over recent years.";

    private Integer createAndSave(SeededExam seeded) {
        CreateAttemptRequest request = new CreateAttemptRequest();
        request.setExamId(seeded.exam().getId());
        request.setTestScope(TestScope.FULL_EXAM);
        request.setTestMode(TestMode.PRACTICE);
        Integer id = testAttemptService.createAttempt(request).getAttemptId();
        createdAttemptIds.add(id);
        testAttemptService.autosaveAnswers(id, AutosaveAnswersRequest.builder().version(1)
                .answers(List.of(AutosaveAnswersRequest.PartAnswerDto.builder().partId(seeded.writingPart().getId())
                        .answers(List.of(AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                .questionId("essay_task_1").answer(LONG_ESSAY).build())).build())).build());
        return id;
    }

    private void submitBounded(Integer id) throws Exception {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            executor.submit(() -> testAttemptService.submitAttempt(id,
                    SubmitAttemptRequest.builder().reason(SubmitReason.MANUAL).build())).get(5, TimeUnit.SECONDS);
        } finally {
            executor.shutdownNow();
            assertThat(executor.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
        }
    }

    private int quotaUsed() {
        return userQuotaRepository.findAllByUserIdAndFeatureCode(ownerId, UserQuotaReservationService.GRADING_FEATURE_CODE)
                .stream().mapToInt(UserQuota::getUsedCount).sum();
    }

    private void assertHttpDone(Integer attemptId, Integer partId, String original, double score) throws Exception {
        mockMvc.perform(get("/api/v1/attempts/{id}/writing-feedback", attemptId).param("partId", partId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.attemptStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.data.tasks[0].status").value("DONE"))
                .andExpect(jsonPath("$.data.tasks[0].originalText").value(original))
                .andExpect(jsonPath("$.data.tasks[0].criteria.length()").value(4))
                .andExpect(jsonPath("$.data.tasks[0].overall").value(score));
    }

    @ParameterizedTest
    @ValueSource(strings = {"missing", "exhausted", "expired", "provider-disabled"})
    void unavailableQuotaOrProvider_submitReturnsBeforeWorker_andWaitsWithoutCharge(String condition) throws Exception {
        var quotas = userQuotaRepository.findAllByUserIdAndFeatureCode(ownerId, UserQuotaReservationService.GRADING_FEATURE_CODE);
        if (condition.equals("missing")) userQuotaRepository.deleteAll(quotas);
        else if (condition.equals("exhausted") || condition.equals("expired")) {
            UserQuota quota = quotas.getFirst();
            if (condition.equals("exhausted")) quota.setUsedCount(quota.getMaxLimit());
            else quota.setResetDate(Instant.now().minusSeconds(60));
            userQuotaRepository.save(quota);
        } else geminiProperties.setEnabled(false);
        int usedBefore = quotaUsed();
        SeededExam seeded = seedExam("LC_WAIT_" + condition, "en", 1);
        Integer id = createAndSave(seeded);
        submitBounded(id);
        WritingGradingJob job = jobRepository.findAllByAttemptId(id).getFirst();
        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.READY);
        assertThat(quotaUsed()).isEqualTo(usedBefore);
        verifyNoInteractions(geminiClient, imageFetcher);
        worker.process(job.getId());
        WritingGradingJob waiting = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(waiting.getStatus()).isEqualTo(WritingGradingJobStatus.WAITING);
        assertThat(waiting.getWaitReason()).isEqualTo(condition.equals("provider-disabled") ? "PROVIDER_DISABLED" : "QUOTA_UNAVAILABLE");
        assertThat(waiting.getQuotaReserved()).isFalse();
        assertThat(waiting.getAttemptCount()).isZero();
        assertThat(quotaUsed()).isEqualTo(usedBefore);
        mockMvc.perform(get("/api/v1/attempts/{id}/writing-feedback", id).param("partId", seeded.writingPart().getId().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.partStatus").value("QUEUED"));
        verifyNoInteractions(geminiClient, imageFetcher);
    }

    @Test
    void pendingProvider_doesNotHoldAnotherSubmit() throws Exception {
        SeededExam first = seedExam("LC_PENDING_FIRST", "en", 1);
        Integer firstId = createAndSave(first);
        submitBounded(firstId);
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        when(geminiClient.generate(any())).thenAnswer(invocation -> {
            entered.countDown();
            if (!release.await(10, TimeUnit.SECONDS)) throw new AssertionError("Provider release timed out");
            return new GeminiGenerationResult(validJsonResponse(LONG_ESSAY, 8.0), new GeminiGenerationResult.Usage(1, 1, 2));
        });
        ExecutorService executor = Executors.newSingleThreadExecutor();
        Future<?> running = executor.submit(() -> worker.process(jobRepository.findAllByAttemptId(firstId).getFirst().getId()));
        try {
            assertThat(entered.await(5, TimeUnit.SECONDS)).isTrue();
            SeededExam second = seedExam("LC_PENDING_SECOND", "en", 1);
            Integer secondId = createAndSave(second);
            submitBounded(secondId);
            assertThat(running.isDone()).isFalse();
            assertThat(jobRepository.findAllByAttemptId(secondId).getFirst().getStatus()).isEqualTo(WritingGradingJobStatus.READY);
            assertThat(quotaUsed()).isEqualTo(1);
            verify(geminiClient, times(1)).generate(any());
        } finally {
            release.countDown();
            try { running.get(5, TimeUnit.SECONDS); }
            finally { executor.shutdownNow(); assertThat(executor.awaitTermination(5, TimeUnit.SECONDS)).isTrue(); }
        }
        assertHttpDone(firstId, first.writingPart().getId(), LONG_ESSAY, 8.0);
    }

    private void addMedia(SeededExam seeded, String field, Object value) {
        Map<String, Object> data = new LinkedHashMap<>(seeded.writingPart().getContentData());
        // Group media is part of the canonical authoring contract retained by DbExamAdapter.
        Map<?, ?> originalGroup = (Map<?, ?>) ((List<?>) data.get("question_groups")).getFirst();
        Map<String, Object> group = new LinkedHashMap<>();
        originalGroup.forEach((key, item) -> group.put(key.toString(), item));
        group.put(field, value);
        data.put("question_groups", List.of(group));
        seeded.writingPart().setContentData(data);
        examPartRepository.save(seeded.writingPart());
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 1, 2})
    void visualSnapshot_submitWorkerLoaderProvider_httpFeedback(int imageCount) throws Exception {
        gradingProperties.setImagesEnabled(true);
        SeededExam seeded = seedExam("LC_VISUAL", "en", 1);
        String firstUrl = "https://example.com/first.png";
        String secondUrl = "https://example.com/second.png";
        if (imageCount > 0) addMedia(seeded, "images", List.of(firstUrl, secondUrl).subList(0, imageCount));
        Integer id = createAndSave(seeded);
        // Live authoring edits after create must not replace frozen visual references.
        if (imageCount > 0) addMedia(seeded, "images", List.of("https://example.com/changed.png"));
        byte[] first = {1, 2, 3};
        byte[] second = {4, 5, 6};
        when(imageFetcher.fetch(any())).thenAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            assertThat(quotaUsed()).isEqualTo(1);
            return new FetchedImage("image/png", invocation.getArgument(0).equals(firstUrl) ? first : second);
        });
        when(geminiClient.generate(any())).thenAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            GeminiGenerationRequest request = invocation.getArgument(0);
            assertThat(request.images()).hasSize(imageCount);
            if (imageCount > 0) assertThat(request.images().get(0).data()).containsExactly(first);
            if (imageCount > 1) assertThat(request.images().get(1).data()).containsExactly(second);
            String response = validJsonResponse(LONG_ESSAY, 8.0).replace("\"feedbackLanguage\"", "\"visualObservations\": \"Chart trends observed.\", \"feedbackLanguage\"");
            return new GeminiGenerationResult(imageCount > 0 ? response : validJsonResponse(LONG_ESSAY, 8.0), new GeminiGenerationResult.Usage(1, 1, 2));
        });
        submitBounded(id);
        WritingGradingJob job = jobRepository.findAllByAttemptId(id).getFirst();
        assertThat(job.getImageCount()).isEqualTo(imageCount);
        assertThat(job.getQuotaReserved()).isFalse();
        assertThat(quotaUsed()).isZero();
        verifyNoInteractions(imageFetcher, geminiClient);
        mockMvc.perform(get("/api/v1/attempts/{id}/writing-feedback", id).param("partId", seeded.writingPart().getId().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.tasks[0].status").value("PENDING"))
                .andExpect(jsonPath("$.data.tasks[0].hasVisualContext").value(imageCount > 0))
                .andExpect(jsonPath("$.data.tasks[0].visualObservations").doesNotExist());
        worker.process(job.getId());
        WritingGradingJob done = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(done.getStatus()).isEqualTo(WritingGradingJobStatus.SUCCEEDED);
        assertThat(done.getQuotaReserved()).isTrue();
        List<String> digests = List.of(
                HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(first)),
                HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(second))).subList(0, imageCount);
        assertThat(done.getResultJson().get("imageDigests")).isEqualTo(digests);
        assertThat(done.getResultJson().get("visualObservations")).isEqualTo(imageCount > 0 ? "Chart trends observed." : null);
        assertThat(done.getModelMetadata()).containsEntry("rubric", WritingGrade.DEFAULT_RUBRIC);
        if (imageCount > 0) assertThat(done.getModelMetadata()).containsEntry("imageDigests", digests);
        var ordered = inOrder(imageFetcher, geminiClient);
        if (imageCount > 0) ordered.verify(imageFetcher).fetch(firstUrl);
        if (imageCount > 1) ordered.verify(imageFetcher).fetch(secondUrl);
        ordered.verify(geminiClient).generate(any());
        verifyNoMoreInteractions(imageFetcher, geminiClient);
        assertThat(quotaUsed()).isEqualTo(1);
        assertHttpDone(id, seeded.writingPart().getId(), LONG_ESSAY, 8.0);
        var response = mockMvc.perform(get("/api/v1/attempts/{id}/writing-feedback", id)
                        .param("partId", seeded.writingPart().getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tasks[0].hasVisualContext").value(imageCount > 0))
                .andExpect(imageCount > 0 ? jsonPath("$.data.tasks[0].visualObservations").value("Chart trends observed.")
                        : jsonPath("$.data.tasks[0].visualObservations").doesNotExist()).andReturn();
        String publicJson = response.getResponse().getContentAsString();
        assertThat(publicJson).doesNotContain(firstUrl, secondUrl, "changed.png", "imageDigests", "imageCount", "AQID", "BAUG");
        for (String digest : digests) assertThat(publicJson).doesNotContain(digest);
        // The job fallback must project the same validated visual fields as canonical aiFeedback.
        var savedAnswer = attemptAnswerRepository.findByAttemptIdAndPartId(id, seeded.writingPart().getId()).orElseThrow();
        savedAnswer.setAiFeedback(null);
        attemptAnswerRepository.save(savedAnswer);
        mockMvc.perform(get("/api/v1/attempts/{id}/writing-feedback", id).param("partId", seeded.writingPart().getId().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.tasks[0].status").value("DONE"))
                .andExpect(jsonPath("$.data.tasks[0].hasVisualContext").value(imageCount > 0))
                .andExpect(imageCount > 0 ? jsonPath("$.data.tasks[0].visualObservations").value("Chart trends observed.")
                        : jsonPath("$.data.tasks[0].visualObservations").doesNotExist());
        if (imageCount > 0) {
            Map<String, Object> malformed = new LinkedHashMap<>(done.getResultJson());
            if (imageCount == 1) malformed.remove("visualObservations");
            else malformed.put("visualObservations", "PRIVATE_INVALID_VISUAL".repeat(60));
            done.setResultJson(malformed);
            jobRepository.save(done);
            for (boolean canonical : List.of(false, true)) {
                if (canonical) {
                    savedAnswer.setAiFeedback(Map.of("schemaVersion", 1, "tasks", Map.of("essay_task_1", malformed)));
                    attemptAnswerRepository.save(savedAnswer);
                }
                mockMvc.perform(get("/api/v1/attempts/{id}/writing-feedback", id).param("partId", seeded.writingPart().getId().toString()))
                        .andExpect(status().isOk()).andExpect(jsonPath("$.data.tasks[0].status").value("FAILED"))
                        .andExpect(jsonPath("$.data.tasks[0].reasonCode").value("MALFORMED_FEEDBACK"))
                        .andExpect(jsonPath("$.data.tasks[0].hasVisualContext").value(true))
                        .andExpect(jsonPath("$.data.tasks[0].visualObservations").doesNotExist());
            }
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"visual-disabled", "audio"})
    void unsupportedMedia_submitIsTerminal_withoutFetchProviderOrQuota(String media) throws Exception {
        SeededExam seeded = seedExam("LC_MEDIA_" + media, "en", 1);
        addMedia(seeded, media.equals("audio") ? "audio_url" : "images",
                media.equals("audio") ? "https://example.com/task.mp3" : List.of("https://example.com/chart.png"));
        Integer id = createAndSave(seeded);
        submitBounded(id);
        List<WritingGradingJob> jobs = jobRepository.findAllByAttemptId(id);
        if (media.equals("visual-disabled")) assertThat(jobs).isEmpty();
        else {
            assertThat(jobs).hasSize(1);
            assertThat(jobs.getFirst().getStatus()).isEqualTo(WritingGradingJobStatus.UNAVAILABLE);
            worker.process(jobs.getFirst().getId());
            assertThat(jobs.getFirst().getQuotaReserved()).isFalse();
        }
        mockMvc.perform(get("/api/v1/attempts/{id}/writing-feedback", id).param("partId", seeded.writingPart().getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tasks[0].status").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.data.tasks[0].hasVisualContext").value(!media.equals("audio")))
                .andExpect(jsonPath("$.data.tasks[0].visualObservations").doesNotExist())
                .andExpect(jsonPath("$.data.tasks[0].reasonCode").value(media.equals("audio") ? "UNSUPPORTED_MEDIA" : "VISUAL_CONTEXT_UNSUPPORTED"));
        assertThat(quotaUsed()).isZero();
        verifyNoInteractions(imageFetcher, geminiClient);
    }

    @ParameterizedTest
    @CsvSource({
            "TOO_LARGE, IMAGE_TOO_LARGE, Hình ảnh vượt giới hạn dung lượng cho phép.",
            "UNSUPPORTED_TYPE, IMAGE_INVALID, Hình ảnh không hợp lệ hoặc có định dạng không được hỗ trợ.",
            "INVALID_CONTENT, IMAGE_INVALID, Hình ảnh không hợp lệ hoặc có định dạng không được hỗ trợ.",
            "UPSTREAM_NOT_FOUND, IMAGE_UNAVAILABLE, Không thể truy cập hình ảnh của đề bài.",
            "UPSTREAM_REJECTED, IMAGE_UNAVAILABLE, Không thể truy cập hình ảnh của đề bài.",
            "INVALID_URL, IMAGE_SOURCE_NOT_ALLOWED, Nguồn hình ảnh không được phép sử dụng.",
            "HOST_NOT_ALLOWED, IMAGE_SOURCE_NOT_ALLOWED, Nguồn hình ảnh không được phép sử dụng.",
            "ADDRESS_REJECTED, IMAGE_SOURCE_NOT_ALLOWED, Nguồn hình ảnh không được phép sử dụng.",
            "REDIRECT_REJECTED, IMAGE_SOURCE_NOT_ALLOWED, Nguồn hình ảnh không được phép sử dụng."
    })
    void permanentImageFailure_preservesSafeHttpReason_refundsOnlyOnce(ImageFetchException.Kind kind, String reason, String message) throws Exception {
        gradingProperties.setImagesEnabled(true);
        UserQuota quota = userQuotaRepository.findAllByUserIdAndFeatureCode(ownerId, UserQuotaReservationService.GRADING_FEATURE_CODE).getFirst();
        quota.setUsedCount(7);
        userQuotaRepository.save(quota);
        SeededExam seeded = seedExam("LC_IMAGE_FAIL_" + kind, "en", 1);
        String secretUrl = "https://example.com/chart.png?signature=PRIVATE_IMAGE_TOKEN";
        addMedia(seeded, "images", List.of(secretUrl));
        Integer id = createAndSave(seeded);
        submitBounded(id);
        WritingGradingJob job = jobRepository.findAllByAttemptId(id).getFirst();
        Map<String, Object> frozen = job.getContextJson();
        when(imageFetcher.fetch(secretUrl)).thenAnswer(invocation -> {
            assertThat(quotaUsed()).isEqualTo(8);
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            throw new ImageFetchException(kind, 413);
        });
        worker.process(job.getId());
        worker.process(job.getId()); // terminal redelivery must not fetch/refund a second time
        WritingGradingJob failed = jobRepository.findById(job.getId()).orElseThrow();
        assertThat(failed.getStatus()).isEqualTo(WritingGradingJobStatus.UNAVAILABLE);
        assertThat(failed.getLastErrorCode()).isEqualTo(reason);
        assertThat(failed.getQuotaReserved()).isFalse();
        assertThat(failed.getContextJson()).isEqualTo(frozen);
        assertThat(quotaUsed()).isEqualTo(7);
        String json = mockMvc.perform(get("/api/v1/attempts/{id}/writing-feedback", id).param("partId", seeded.writingPart().getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tasks[0].status").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.data.tasks[0].reasonCode").value(reason))
                .andExpect(jsonPath("$.data.tasks[0].displayMessage").value(message))
                .andExpect(jsonPath("$.data.tasks[0].hasVisualContext").value(true))
                .andExpect(jsonPath("$.data.tasks[0].visualObservations").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        assertThat(json).doesNotContain(secretUrl, "PRIVATE_FETCH_DETAILS", "PRIVATE_IMAGE_TOKEN", "imageCount", "imageDigests");
        verify(imageFetcher, times(1)).fetch(secretUrl);
        verifyNoInteractions(geminiClient);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void visualQueuedOrFailed_preservesHistoricalFlag_withoutObservations(boolean providerFailure) throws Exception {
        gradingProperties.setImagesEnabled(true);
        SeededExam seeded = seedExam("LC_VISUAL_STATE_" + providerFailure, "en", 1);
        addMedia(seeded, "images", List.of("https://example.com/chart.png"));
        Integer id = createAndSave(seeded);
        submitBounded(id);
        if (providerFailure) {
            when(imageFetcher.fetch(any())).thenReturn(new FetchedImage("image/png", new byte[]{1, 2, 3}));
            when(geminiClient.generate(any())).thenThrow(new GeminiClientException(GeminiClientException.Kind.BLOCKED, "PRIVATE_PROVIDER_ERROR"));
        } else geminiProperties.setEnabled(false);
        worker.process(jobRepository.findAllByAttemptId(id).getFirst().getId());
        mockMvc.perform(get("/api/v1/attempts/{id}/writing-feedback", id).param("partId", seeded.writingPart().getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tasks[0].status").value(providerFailure ? "FAILED" : "QUEUED"))
                .andExpect(jsonPath("$.data.tasks[0].hasVisualContext").value(true))
                .andExpect(jsonPath("$.data.tasks[0].visualObservations").doesNotExist());
        assertThat(quotaUsed()).isZero();
    }
}
