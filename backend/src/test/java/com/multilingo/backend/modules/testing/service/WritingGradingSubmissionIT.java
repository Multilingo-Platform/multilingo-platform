package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.common.FixtureAdaptersTestConfig;
import com.multilingo.backend.modules.testing.adapter.ExamAdapter;
import com.multilingo.backend.modules.testing.adapter.dto.ExamFixture;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiClient;
import com.multilingo.backend.modules.testing.config.WritingGradingProperties;
import com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest;
import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.dto.request.SubmitAttemptRequest;
import com.multilingo.backend.modules.testing.dto.response.SubmitResultResponse;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
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
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@SpringBootTest(properties = "spring.main.allow-bean-definition-overriding=true")
@Import(FixtureAdaptersTestConfig.class)
@ActiveProfiles("test")
public class WritingGradingSubmissionIT {

    @Autowired
    private TestAttemptService testAttemptService;

    @Autowired
    private TestAttemptRepository testAttemptRepository;

    @Autowired
    private AttemptAnswerRepository attemptAnswerRepository;

    @SpyBean
    private WritingGradingJobRepository writingGradingJobRepository;

    @Autowired
    private WritingGradingProperties gradingProperties;

    @Autowired
    private ExamAdapter examAdapter;

    @MockBean
    private GeminiClient geminiClient;

    @AfterEach
    void tearDown() {
        reset(writingGradingJobRepository);
        gradingProperties.setEnabled(false);
        gradingProperties.setImagesEnabled(false);
        writingGradingJobRepository.deleteAll();
        attemptAnswerRepository.deleteAll();
        testAttemptRepository.deleteAll();
    }

    private Integer createFullExamAttempt() {
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1);
        req.setTestScope(TestScope.FULL_EXAM);
        req.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse resp = testAttemptService.createAttempt(req);
        return resp.getAttemptId();
    }

    private Integer createSinglePartWritingAttempt() {
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1);
        req.setTestScope(TestScope.SINGLE_PART);
        req.setTargetPartId(6); // Part 6 is Writing Task 2
        req.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse resp = testAttemptService.createAttempt(req);
        return resp.getAttemptId();
    }

    @Test
    @DisplayName("Submit lặp lại là idempotent: tạo đúng 2 jobs cho 2 ESSAY, không gọi provider và không đổi điểm objective")
    void submitAttempt_repeatedCall_isIdempotent_createsExactlyTwoJobs_andNeverCallsGeminiProvider() {
        Integer attemptId = createFullExamAttempt();

        // Autosave đáp án trắc nghiệm đúng cho Part 1 và bài luận >10 từ cho Part 6 và Part 7
        AutosaveAnswersRequest saveReq = AutosaveAnswersRequest.builder()
                .version(1)
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(1)
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder().questionId("q_1").answer("A").build(),
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder().questionId("q_2").answer("A").build()
                                ))
                                .build(),
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(6)
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                .questionId("q_8")
                                                .answer("This is a detailed argumentative essay with more than ten English words for the examiner to evaluate.")
                                                .build()
                                ))
                                .build(),
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(7)
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                .questionId("q_9")
                                                .answer("The graph clearly demonstrates substantial upward trends over the recorded observation period.")
                                                .build()
                                ))
                                .build()
                ))
                .build();
        testAttemptService.autosaveAnswers(attemptId, saveReq);

        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();

        // Submit lần 1
        SubmitResultResponse resp1 = testAttemptService.submitAttempt(attemptId, submitReq);
        // Submit lần 2 (repeated call)
        SubmitResultResponse resp2 = testAttemptService.submitAttempt(attemptId, submitReq);

        assertThat(resp1.getStatus()).isEqualTo(resp2.getStatus());

        List<WritingGradingJob> jobs = writingGradingJobRepository.findAllByAttemptId(attemptId);
        // Đúng 2 jobs cho 2 câu hỏi ESSAY q_8 và q_9
        assertThat(jobs).hasSize(2);

        // Khẳng định không gọi Gemini provider trong submit
        verifyNoInteractions(geminiClient);

        // Khẳng định điểm objective không bị thay đổi bởi luồng enqueue Writing
        TestAttempt finalizedAttempt = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(finalizedAttempt.getOverallScore()).isNotNull();
        assertThat(finalizedAttempt.getOverallScore()).isGreaterThan(BigDecimal.ZERO);

        // Khi gradingProperties.isEnabled() == false (mặc định trong test): trạng thái là AI_GRADING_QUEUED
        assertThat(finalizedAttempt.getStatus()).isEqualTo(AttemptStatus.AI_GRADING_QUEUED);
        assertThat(jobs).allMatch(j -> j.getStatus() == WritingGradingJobStatus.WAITING);
    }

    @Test
    @DisplayName("Submit bài viết ngắn ≤10 từ: điểm 0 tự động, job SUCCEEDED, attempt COMPLETED và lưu aiFeedback")
    void submitAttempt_shortEssay_setsStatusCompleted_andStoresAiFeedback() {
        Integer attemptId = createSinglePartWritingAttempt();

        AutosaveAnswersRequest saveReq = AutosaveAnswersRequest.builder()
                .version(1)
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(6)
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                .questionId("q_8")
                                                .answer("Too short")
                                                .build()
                                ))
                                .build()
                ))
                .build();
        testAttemptService.autosaveAnswers(attemptId, saveReq);

        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();

        SubmitResultResponse resp = testAttemptService.submitAttempt(attemptId, submitReq);

        // Tất cả jobs SUCCEEDED -> AttemptStatus.COMPLETED
        assertThat(resp.getStatus()).isEqualTo(AttemptStatus.COMPLETED);

        List<WritingGradingJob> jobs = writingGradingJobRepository.findAllByAttemptId(attemptId);
        assertThat(jobs).hasSize(1);
        WritingGradingJob job = jobs.get(0);
        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.SUCCEEDED);
        assertThat(job.getCompletedAt()).isNotNull();
        assertThat(((Number) job.getResultJson().get("overallScore")).doubleValue()).isEqualTo(0.0);

        // Kiểm tra aiFeedback được lưu trong AttemptAnswer
        AttemptAnswer answer = attemptAnswerRepository.findByAttemptIdAndPartId(attemptId, 6).orElseThrow();
        assertThat(answer.getAiFeedback()).isNotNull();
        assertThat(answer.getAiFeedback()).containsEntry("schemaVersion", 1);
        @SuppressWarnings("unchecked")
        Map<String, Object> tasks = (Map<String, Object>) answer.getAiFeedback().get("tasks");
        assertThat(tasks).containsKey("q_8");
    }

    @Test
    @DisplayName("Server timeout (expireAttemptBySystem): đóng băng bài thi và enqueue jobs thành công")
    void submitAttempt_serverTimeout_enqueuesJobsCorrectly() {
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1);
        req.setTestScope(TestScope.SINGLE_PART);
        req.setTargetPartId(6);
        req.setTestMode(TestMode.MOCK_TEST);
        WorkspaceResponse resp = testAttemptService.createAttempt(req);
        Integer attemptId = resp.getAttemptId();

        // Chỉnh deadline về quá khứ
        TestAttempt attempt = testAttemptRepository.findById(attemptId).orElseThrow();
        attempt.setDeadline(Instant.now().minusSeconds(30));
        testAttemptRepository.save(attempt);

        // Server watchdog quét hết hạn
        testAttemptService.expireAttemptBySystem(attemptId);

        TestAttempt finalized = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(finalized.getStatus()).isNotEqualTo(AttemptStatus.IN_PROGRESS);

        List<WritingGradingJob> jobs = writingGradingJobRepository.findAllByAttemptId(attemptId);
        assertThat(jobs).hasSize(1);
        assertThat(jobs.get(0).getQuestionId()).isEqualTo("q_8");
    }

    @Test
    @DisplayName("Lazy finalize qua getAttemptReview: enqueue jobs đúng quy cách")
    void submitAttempt_lazyFinalize_enqueuesJobsCorrectly() {
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1);
        req.setTestScope(TestScope.SINGLE_PART);
        req.setTargetPartId(6);
        req.setTestMode(TestMode.MOCK_TEST);
        WorkspaceResponse resp = testAttemptService.createAttempt(req);
        Integer attemptId = resp.getAttemptId();

        // Chỉnh deadline về quá khứ quá 15s grace
        TestAttempt attempt = testAttemptRepository.findById(attemptId).orElseThrow();
        attempt.setDeadline(Instant.now().minusSeconds(20));
        testAttemptRepository.save(attempt);

        // Gọi getAttemptReview kích hoạt lazy finalize
        testAttemptService.getAttemptReview(attemptId, 6);

        TestAttempt finalized = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(finalized.getStatus()).isNotEqualTo(AttemptStatus.IN_PROGRESS);

        List<WritingGradingJob> jobs = writingGradingJobRepository.findAllByAttemptId(attemptId);
        assertThat(jobs).hasSize(1);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> injectImageUrlIntoSnapshot(Map<String, Object> sourceSnapshot, Integer targetPartId, String targetQuestionId, String imageUrl) {
        ObjectMapper mapper = new ObjectMapper();
        Map<String, Object> copy;
        try {
            copy = mapper.readValue(mapper.writeValueAsBytes(sourceSnapshot), Map.class);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        List<Map<String, Object>> sections = (List<Map<String, Object>>) copy.get("sections");
        for (Map<String, Object> sec : sections) {
            List<Map<String, Object>> parts = (List<Map<String, Object>>) sec.get("parts");
            if (parts == null) continue;
            for (Map<String, Object> p : parts) {
                Number pid = (Number) p.get("id");
                if (pid != null && pid.intValue() == targetPartId) {
                    List<Map<String, Object>> questions = (List<Map<String, Object>>) p.get("questions");
                    if (questions != null) {
                        for (Map<String, Object> q : questions) {
                            String qid = (String) q.get("question_id");
                            if (qid == null) qid = String.valueOf(q.get("id"));
                            if (targetQuestionId.equals(qid)) {
                                q.put("image_url", imageUrl);
                            }
                        }
                    }
                }
            }
        }
        return copy;
    }

    @Test
    @DisplayName("TV3-20-04-R1: Submit bài visual essay khi images-enabled=false: 0 job được tạo, lưu local UNAVAILABLE và attempt chuyển GRADING_FAILED")
    void submitAttempt_visualEssay_whenImagesDisabled_createsZeroJobs_storesLocalUnavailable_andSetsGradingFailed() {
        gradingProperties.setEnabled(true);
        gradingProperties.setImagesEnabled(false);

        Integer attemptId = createSinglePartWritingAttempt();
        TestAttempt attempt = testAttemptRepository.findById(attemptId).orElseThrow();

        // Inject image_url vào question q_8 của Part 6 trong examSnapshot
        Map<String, Object> snapshot = injectImageUrlIntoSnapshot(attempt.getExamSnapshot(), 6, "q_8", "https://cdn.example.test/chart.png");
        attempt.setExamSnapshot(snapshot);
        testAttemptRepository.save(attempt);

        // Autosave bài luận dài >10 từ
        AutosaveAnswersRequest saveReq = AutosaveAnswersRequest.builder()
                .version(1)
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(6)
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                .questionId("q_8")
                                                .answer("This is a full visual writing essay with more than ten English words evaluating the diagram.")
                                                .build()
                                ))
                                .build()
                ))
                .build();
        testAttemptService.autosaveAnswers(attemptId, saveReq);

        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();

        SubmitResultResponse resp = testAttemptService.submitAttempt(attemptId, submitReq);

        // Terminal UNAVAILABLE -> Attempt chuyển GRADING_FAILED
        assertThat(resp.getStatus()).isEqualTo(AttemptStatus.GRADING_FAILED);

        // 0 job trong writing_grading_jobs
        List<WritingGradingJob> jobs = writingGradingJobRepository.findAllByAttemptId(attemptId);
        assertThat(jobs).isEmpty();

        // Không gọi Gemini provider
        verifyNoInteractions(geminiClient);

        // Kiểm tra aiFeedback được lưu trong AttemptAnswer với status UNAVAILABLE
        AttemptAnswer answer = attemptAnswerRepository.findByAttemptIdAndPartId(attemptId, 6).orElseThrow();
        assertThat(answer.getAiFeedback()).isNotNull();
        assertThat(answer.getAiFeedback()).containsEntry("schemaVersion", 1);
        @SuppressWarnings("unchecked")
        Map<String, Object> tasks = (Map<String, Object>) answer.getAiFeedback().get("tasks");
        assertThat(tasks).containsKey("q_8");
        @SuppressWarnings("unchecked")
        Map<String, Object> taskFeedback = (Map<String, Object>) tasks.get("q_8");
        assertThat(taskFeedback).containsEntry("status", "UNAVAILABLE");
        assertThat(taskFeedback).containsEntry("reasonCode", "VISUAL_CONTEXT_UNSUPPORTED");
        assertThat(taskFeedback.get("score")).isNull();
        assertThat(taskFeedback.get("overallScore")).isNull();
    }

    @Test
    @DisplayName("TV3-20-04-R1: Submit bài visual essay khi images-enabled=true: tạo job READY với imageCount=1 và frozen URLs")
    void submitAttempt_visualEssay_whenImagesEnabled_createsJobWithImages() {
        gradingProperties.setEnabled(true);
        gradingProperties.setImagesEnabled(true);

        Integer attemptId = createSinglePartWritingAttempt();
        TestAttempt attempt = testAttemptRepository.findById(attemptId).orElseThrow();

        Map<String, Object> snapshot = injectImageUrlIntoSnapshot(attempt.getExamSnapshot(), 6, "q_8", "https://cdn.example.test/chart.png");
        attempt.setExamSnapshot(snapshot);
        testAttemptRepository.save(attempt);

        AutosaveAnswersRequest saveReq = AutosaveAnswersRequest.builder()
                .version(1)
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(6)
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                .questionId("q_8")
                                                .answer("This is a full visual writing essay with more than ten English words evaluating the diagram.")
                                                .build()
                                ))
                                .build()
                ))
                .build();
        testAttemptService.autosaveAnswers(attemptId, saveReq);

        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();

        SubmitResultResponse resp = testAttemptService.submitAttempt(attemptId, submitReq);

        assertThat(resp.getStatus()).isEqualTo(AttemptStatus.AI_GRADING);

        List<WritingGradingJob> jobs = writingGradingJobRepository.findAllByAttemptId(attemptId);
        assertThat(jobs).hasSize(1);
        WritingGradingJob job = jobs.get(0);
        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.READY);
        assertThat(job.getImageCount()).isEqualTo(1);
        assertThat(job.getContextJson()).containsKey("images");
    }

    @Test
    @DisplayName("TV3-20-04-R1: Mixed-part aggregation: Part 6 text-only job + Part 7 visual essay images-disabled -> AI_GRADING khi còn pending job")
    void submitAttempt_mixedPart_textJobAndVisualUnavailable_aggregatesStatusProperly() {
        gradingProperties.setEnabled(true);
        gradingProperties.setImagesEnabled(false);

        Integer attemptId = createFullExamAttempt();
        TestAttempt attempt = testAttemptRepository.findById(attemptId).orElseThrow();

        // Part 7 có image, Part 6 là text-only
        Map<String, Object> snapshot = injectImageUrlIntoSnapshot(attempt.getExamSnapshot(), 7, "q_9", "https://cdn.example.test/chart.png");
        attempt.setExamSnapshot(snapshot);
        testAttemptRepository.save(attempt);

        AutosaveAnswersRequest saveReq = AutosaveAnswersRequest.builder()
                .version(1)
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(6)
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                .questionId("q_8")
                                                .answer("This is a comprehensive analytical essay with more than ten words discussing language learning and technology.")
                                                .build()
                                ))
                                .build(),
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(7)
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                .questionId("q_9")
                                                .answer("This visual essay clearly outlines the significant trends shown in the language chart across all periods.")
                                                .build()
                                ))
                                .build()
                ))
                .build();
        testAttemptService.autosaveAnswers(attemptId, saveReq);

        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();

        SubmitResultResponse resp = testAttemptService.submitAttempt(attemptId, submitReq);

        // Part 6 tạo READY job, Part 7 là local UNAVAILABLE -> Có runnable job nên status là AI_GRADING
        assertThat(resp.getStatus()).isEqualTo(AttemptStatus.AI_GRADING);

        // Chỉ có đúng 1 durable job (cho Part 6), Part 7 không tạo job
        List<WritingGradingJob> jobs = writingGradingJobRepository.findAllByAttemptId(attemptId);
        assertThat(jobs).hasSize(1);
        assertThat(jobs.get(0).getQuestionId()).isEqualTo("q_8");

        // Part 7 lưu local UNAVAILABLE
        AttemptAnswer part7Answer = attemptAnswerRepository.findByAttemptIdAndPartId(attemptId, 7).orElseThrow();
        assertThat(part7Answer.getAiFeedback()).isNotNull();
        @SuppressWarnings("unchecked")
        Map<String, Object> tasks = (Map<String, Object>) part7Answer.getAiFeedback().get("tasks");
        assertThat(tasks).containsKey("q_9");
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    @DisplayName("TV3-20-04-R2: Lỗi DB khi lưu job thứ 2 rollback toàn bộ giao dịch submit (finalAnswers, version, status, endTime, objective)")
    void submitAttempt_whenEnqueueDbFailsOnSecondJob_rollsBackEntireSubmitTransaction(boolean shortResult) {
        Integer attemptId = createFullExamAttempt();

        // Autosave đáp án trắc nghiệm cho Part 1 và bài viết cho Part 6 và 7
        AutosaveAnswersRequest saveReq = AutosaveAnswersRequest.builder()
                .version(1)
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(1)
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder().questionId("q_1").answer("A").build()
                                ))
                                .build(),
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(6)
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                .questionId("q_8")
                                                .answer("Original first autosaved essay.")
                                                .build()
                                ))
                                .build(),
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(7)
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                .questionId("q_9")
                                                .answer("Original second autosaved essay.")
                                                .build()
                                ))
                                .build()
                ))
                .build();
        testAttemptService.autosaveAnswers(attemptId, saveReq);

        // Preserve an existing feedback entry to detect both partial merge and accidental clearing.
        AttemptAnswer savedWriting = attemptAnswerRepository.findByAttemptIdAndPartId(attemptId, 6).orElseThrow();
        savedWriting.setAiFeedback(Map.of("schemaVersion", 1, "tasks", Map.of("historical-task", Map.of("sentinel", "KEEP_FEEDBACK"))));
        attemptAnswerRepository.save(savedWriting);
        TestAttempt before = testAttemptRepository.findById(attemptId).orElseThrow();
        Map<Integer, Map<String, Object>> answersBefore = answerState(attemptId);
        String finalEssay = shortResult ? "Revised short essay for rollback verification."
                : "This revised final essay really contains more than ten English words to exercise durable ready jobs.";
        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL).baseVersion(before.getVersion())
                .finalAnswers(List.of(
                        answerPart(1, "q_1", "B"),
                        answerPart(6, "q_8", finalEssay),
                        answerPart(7, "q_9", "Another revised final essay with more than ten words for the second job.")))
                .build();

        // Assert writes were actually reached inside the submit transaction before injecting the failure.
        doAnswer(invocation -> {
            List<WritingGradingJob> inserted = writingGradingJobRepository.findAllByAttemptId(attemptId);
            assertThat(inserted).hasSize(1);
            assertThat(inserted.getFirst().getStatus()).isEqualTo(shortResult
                    ? WritingGradingJobStatus.SUCCEEDED : WritingGradingJobStatus.READY);
            assertThat(inserted.getFirst().getContextJson()).containsEntry("originalText", finalEssay);
            AttemptAnswer current = attemptAnswerRepository.findByAttemptIdAndPartId(attemptId, 6).orElseThrow();
            assertThat(current.getUserAnswers()).containsEntry("q_8", finalEssay);
            assertThat(attemptAnswerRepository.findByAttemptIdAndPartId(attemptId, 1).orElseThrow().getUserAnswers())
                    .containsEntry("q_1", "B");
            assertThat(current.getAiFeedback()).containsKey("tasks");
            if (shortResult) assertThat(((Map<?, ?>) current.getAiFeedback().get("tasks")).containsKey("q_8")).isTrue();
            assertThat(testAttemptRepository.findById(attemptId).orElseThrow().getOverallScore()).isNotNull();
            throw new org.springframework.dao.DataIntegrityViolationException("Simulated DB error on second job");
        }).when(writingGradingJobRepository).save(argThat(job -> job != null && "q_9".equals(job.getQuestionId())));
        gradingProperties.setEnabled(true);

        // Khẳng định exception propagate ra ngoài
        assertThatThrownBy(() -> testAttemptService.submitAttempt(attemptId, submitReq))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);

        // Kiểm tra toàn bộ giao dịch submit đã bị rollback hoàn toàn
        TestAttempt reloaded = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(AttemptStatus.IN_PROGRESS);
        assertThat(reloaded.getEndTime()).isNull();
        assertThat(reloaded.getOverallScore()).isNull();
        assertThat(reloaded.getSectionScores()).isNull();
        assertThat(reloaded.getVersion()).isEqualTo(before.getVersion());
        assertThat(reloaded.getResultSummary()).isEqualTo(before.getResultSummary());
        assertThat(reloaded.getTimeSpentSeconds()).isEqualTo(before.getTimeSpentSeconds());
        assertThat(answerState(attemptId)).isEqualTo(answersBefore);
        verifyNoInteractions(geminiClient);

        // 0 job nào còn sót lại trong writing_grading_jobs (job 1 đã bị rollback)
        List<WritingGradingJob> jobs = writingGradingJobRepository.findAllByAttemptId(attemptId);
        assertThat(jobs).isEmpty();
    }

    private AutosaveAnswersRequest.PartAnswerDto answerPart(int partId, String questionId, String value) {
        return AutosaveAnswersRequest.PartAnswerDto.builder().partId(partId)
                .answers(List.of(AutosaveAnswersRequest.QuestionAnswerDto.builder()
                        .questionId(questionId).answer(value).build())).build();
    }

    @SuppressWarnings("unchecked")
    private Map<Integer, Map<String, Object>> answerState(Integer attemptId) {
        Map<Integer, Map<String, Object>> state = new LinkedHashMap<>();
        ObjectMapper mapper = new ObjectMapper();
        for (AttemptAnswer answer : attemptAnswerRepository.findByAttemptId(attemptId)) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", answer.getId());
            row.put("userAnswers", answer.getUserAnswers());
            row.put("aiFeedback", answer.getAiFeedback());
            row.put("isCorrectFlags", answer.getIsCorrectFlags());
            row.put("earnedScore", answer.getEarnedScore());
            row.put("skillStats", answer.getSkillStats());
            state.put(answer.getPartId(), mapper.convertValue(row, Map.class));
        }
        return state;
    }
}
