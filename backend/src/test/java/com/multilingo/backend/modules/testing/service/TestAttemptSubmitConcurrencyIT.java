package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.common.FixtureAdaptersTestConfig;
import com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest;
import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.dto.request.SubmitAttemptRequest;
import com.multilingo.backend.modules.testing.dto.response.SubmitResultResponse;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.SubmitReason;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = "spring.main.allow-bean-definition-overriding=true")
@Import(FixtureAdaptersTestConfig.class)
@ActiveProfiles("test")
public class TestAttemptSubmitConcurrencyIT {

    @Autowired
    private TestAttemptService testAttemptService;

    @Autowired
    private TestAttemptRepository testAttemptRepository;

    @Autowired
    private AttemptAnswerRepository attemptAnswerRepository;

    private final List<Integer> createdAttemptIds = new CopyOnWriteArrayList<>();

    @AfterEach
    void tearDown() {
        for (Integer id : createdAttemptIds) {
            try {
                List<AttemptAnswer> answers = attemptAnswerRepository.findByAttemptId(id);
                attemptAnswerRepository.deleteAll(answers);
                testAttemptRepository.deleteById(id);
            } catch (Exception ignored) {
            }
        }
        createdAttemptIds.clear();
    }

    private Integer createMockAttempt(Instant deadline) {
        CreateAttemptRequest createReq = new CreateAttemptRequest();
        createReq.setExamId(1);
        createReq.setTestScope(TestScope.FULL_EXAM);
        createReq.setTestMode(TestMode.MOCK_TEST);
        WorkspaceResponse workspace = testAttemptService.createAttempt(createReq);

        TestAttempt attempt = testAttemptRepository.findById(workspace.getAttemptId()).orElseThrow();
        attempt.setDeadline(deadline);
        testAttemptRepository.save(attempt);

        createdAttemptIds.add(attempt.getId());
        return attempt.getId();
    }

    @Test
    void twoConcurrentSubmitRequests_bothSucceedWithoutDeadlock_andAttemptIsFinalizedIdempotently() throws Exception {
        // Arrange
        Instant futureDeadline = Instant.now().plusSeconds(3600);
        Integer attemptId = createMockAttempt(futureDeadline);

        int numThreads = 2;
        ExecutorService executor = Executors.newFixedThreadPool(numThreads);
        CountDownLatch readyLatch = new CountDownLatch(numThreads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(numThreads);

        List<SubmitResultResponse> responses = Collections.synchronizedList(new ArrayList<>());
        List<Throwable> exceptions = Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < numThreads; i++) {
            executor.submit(() -> {
                readyLatch.countDown();
                try {
                    startLatch.await();
                    SubmitAttemptRequest req = SubmitAttemptRequest.builder()
                            .reason(SubmitReason.MANUAL)
                            .baseVersion(1)
                            .build();
                    SubmitResultResponse resp = testAttemptService.submitAttempt(attemptId, req);
                    responses.add(resp);
                } catch (Throwable t) {
                    exceptions.add(t);
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        assertThat(readyLatch.await(5, TimeUnit.SECONDS)).isTrue();
        startLatch.countDown();
        assertThat(doneLatch.await(10, TimeUnit.SECONDS)).isTrue();
        executor.shutdown();

        // Assert: no exceptions thrown, no deadlock
        assertThat(exceptions).isEmpty();
        assertThat(responses).hasSize(2);

        // Both responses must be terminal and identical
        for (SubmitResultResponse resp : responses) {
            assertThat(resp.getAttemptId()).isEqualTo(attemptId);
            assertThat(resp.getStatus()).isIn(AttemptStatus.SUBMITTED, AttemptStatus.COMPLETED, AttemptStatus.AI_GRADING);
        }
        assertThat(responses.get(0).getStatus()).isEqualTo(responses.get(1).getStatus());

        // Attempt in database is finalized
        TestAttempt finalizedAttempt = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(finalizedAttempt.getStatus()).isIn(AttemptStatus.SUBMITTED, AttemptStatus.COMPLETED, AttemptStatus.AI_GRADING);
        assertThat(finalizedAttempt.getEndTime()).isNotNull();
    }

    @Test
    void concurrentSubmitWithAnswers_persistsConsistentPayload_andSingleFinalization() throws Exception {
        // Arrange
        Instant futureDeadline = Instant.now().plusSeconds(3600);
        Integer attemptId = createMockAttempt(futureDeadline);

        int numThreads = 2;
        ExecutorService executor = Executors.newFixedThreadPool(numThreads);
        CountDownLatch readyLatch = new CountDownLatch(numThreads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(numThreads);

        List<SubmitResultResponse> responses = Collections.synchronizedList(new ArrayList<>());
        List<Throwable> exceptions = Collections.synchronizedList(new ArrayList<>());

        for (int i = 1; i <= numThreads; i++) {
            final String answer = "ANSWER_THREAD_" + i;
            executor.submit(() -> {
                readyLatch.countDown();
                try {
                    startLatch.await();
                    AutosaveAnswersRequest.QuestionAnswerDto qAnswer = AutosaveAnswersRequest.QuestionAnswerDto.builder()
                            .questionId("q1")
                            .answer(answer)
                            .build();
                    AutosaveAnswersRequest.PartAnswerDto partAnswer = AutosaveAnswersRequest.PartAnswerDto.builder()
                            .partId(10)
                            .answers(List.of(qAnswer))
                            .build();
                    SubmitAttemptRequest req = SubmitAttemptRequest.builder()
                            .reason(SubmitReason.MANUAL)
                            .baseVersion(1)
                            .finalAnswers(List.of(partAnswer))
                            .build();
                    SubmitResultResponse resp = testAttemptService.submitAttempt(attemptId, req);
                    responses.add(resp);
                } catch (Throwable t) {
                    exceptions.add(t);
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        assertThat(readyLatch.await(5, TimeUnit.SECONDS)).isTrue();
        startLatch.countDown();
        assertThat(doneLatch.await(10, TimeUnit.SECONDS)).isTrue();
        executor.shutdown();

        assertThat(exceptions).isEmpty();
        assertThat(responses).hasSize(2);

        TestAttempt finalizedAttempt = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(finalizedAttempt.getStatus()).isIn(AttemptStatus.SUBMITTED, AttemptStatus.COMPLETED, AttemptStatus.AI_GRADING);

        List<AttemptAnswer> answers = attemptAnswerRepository.findByAttemptId(attemptId);
        assertThat(answers).isNotEmpty();
        AttemptAnswer p10 = answers.stream().filter(a -> a.getPartId().equals(10)).findFirst().orElseThrow();
        assertThat(p10.getUserAnswers().get("q1")).isIn("ANSWER_THREAD_1", "ANSWER_THREAD_2");
    }
}
