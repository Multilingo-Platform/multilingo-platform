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
import com.multilingo.backend.modules.testing.service.scheduler.AttemptExpirationScheduler;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

@SpringBootTest(properties = "spring.main.allow-bean-definition-overriding=true")
@Import(FixtureAdaptersTestConfig.class)
@ActiveProfiles("test")
public class TestAttemptSchedulerSubmitConcurrencyIT {

    @Autowired
    private TestAttemptService testAttemptService;

    @Autowired
    private AttemptExpirationScheduler attemptExpirationScheduler;

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
    void concurrentSchedulerAndClientSubmit_resolvesCleanlyWithoutDeadlock_andAttemptIsFinalized() throws Exception {
        // Arrange: create attempt, pre-save answer, then shift deadline to past grace window
        Instant futureDeadline = Instant.now().plusSeconds(60);
        Integer attemptId = createMockAttempt(futureDeadline);

        // Pre-save an answer
        AutosaveAnswersRequest.QuestionAnswerDto qAnswer = AutosaveAnswersRequest.QuestionAnswerDto.builder()
                .questionId("q1")
                .answer("PRE_SAVED")
                .build();
        AutosaveAnswersRequest.PartAnswerDto partAnswer = AutosaveAnswersRequest.PartAnswerDto.builder()
                .partId(10)
                .answers(List.of(qAnswer))
                .build();
        testAttemptService.autosaveAnswers(attemptId, new AutosaveAnswersRequest(1, List.of(partAnswer)));

        // Shift deadline into the past (20 seconds ago, beyond 15s grace window)
        Instant pastGraceDeadline = Instant.now().minusSeconds(20).truncatedTo(ChronoUnit.MILLIS);
        TestAttempt attempt = testAttemptRepository.findById(attemptId).orElseThrow();
        attempt.setDeadline(pastGraceDeadline);
        testAttemptRepository.save(attempt);

        int numThreads = 2;
        ExecutorService executor = Executors.newFixedThreadPool(numThreads);
        CountDownLatch readyLatch = new CountDownLatch(numThreads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(numThreads);

        List<Throwable> exceptions = Collections.synchronizedList(new ArrayList<>());
        List<SubmitResultResponse> clientResponses = Collections.synchronizedList(new ArrayList<>());

        // Thread 1: System expiration scheduler
        executor.submit(() -> {
            readyLatch.countDown();
            try {
                startLatch.await();
                testAttemptService.expireAttemptBySystem(attemptId);
            } catch (Throwable t) {
                exceptions.add(t);
            } finally {
                doneLatch.countDown();
            }
        });

        // Thread 2: Client submit (TIMEOUT_CLIENT)
        executor.submit(() -> {
            readyLatch.countDown();
            try {
                startLatch.await();
                SubmitAttemptRequest req = SubmitAttemptRequest.builder()
                        .reason(SubmitReason.TIMEOUT_CLIENT)
                        .baseVersion(1)
                        .build();
                SubmitResultResponse resp = testAttemptService.submitAttempt(attemptId, req);
                clientResponses.add(resp);
            } catch (Throwable t) {
                exceptions.add(t);
            } finally {
                doneLatch.countDown();
            }
        });

        assertThat(readyLatch.await(5, TimeUnit.SECONDS)).isTrue();
        startLatch.countDown();
        assertThat(doneLatch.await(10, TimeUnit.SECONDS)).isTrue();
        executor.shutdown();

        // Assert: no deadlocks or uncaught exceptions
        assertThat(exceptions).isEmpty();

        // Attempt must be in a terminal status
        TestAttempt finalizedAttempt = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(finalizedAttempt.getStatus()).isIn(AttemptStatus.SUBMITTED, AttemptStatus.COMPLETED, AttemptStatus.AI_GRADING);
        assertThat(finalizedAttempt.getEndTime()).isCloseTo(pastGraceDeadline, within(1, ChronoUnit.SECONDS));

        // Saved answers intact
        List<AttemptAnswer> answers = attemptAnswerRepository.findByAttemptId(attemptId);
        assertThat(answers).isNotEmpty();
        AttemptAnswer p10 = answers.stream().filter(a -> a.getPartId().equals(10)).findFirst().orElseThrow();
        assertThat(p10.getUserAnswers().get("q1")).isEqualTo("PRE_SAVED");
    }

    @Test
    void concurrentSchedulerSweepAndClientSubmit_resolvesCleanly() throws Exception {
        // Arrange
        Instant pastGraceDeadline = Instant.now().minusSeconds(25);
        Integer attemptId = createMockAttempt(pastGraceDeadline);

        int numThreads = 2;
        ExecutorService executor = Executors.newFixedThreadPool(numThreads);
        CountDownLatch readyLatch = new CountDownLatch(numThreads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(numThreads);

        List<Throwable> exceptions = Collections.synchronizedList(new ArrayList<>());

        executor.submit(() -> {
            readyLatch.countDown();
            try {
                startLatch.await();
                attemptExpirationScheduler.sweepExpiredAttempts();
            } catch (Throwable t) {
                exceptions.add(t);
            } finally {
                doneLatch.countDown();
            }
        });

        executor.submit(() -> {
            readyLatch.countDown();
            try {
                startLatch.await();
                SubmitAttemptRequest req = SubmitAttemptRequest.builder()
                        .reason(SubmitReason.TIMEOUT_CLIENT)
                        .baseVersion(1)
                        .build();
                testAttemptService.submitAttempt(attemptId, req);
            } catch (Throwable t) {
                exceptions.add(t);
            } finally {
                doneLatch.countDown();
            }
        });

        assertThat(readyLatch.await(5, TimeUnit.SECONDS)).isTrue();
        startLatch.countDown();
        assertThat(doneLatch.await(10, TimeUnit.SECONDS)).isTrue();
        executor.shutdown();

        assertThat(exceptions).isEmpty();

        TestAttempt finalizedAttempt = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(finalizedAttempt.getStatus()).isIn(AttemptStatus.SUBMITTED, AttemptStatus.COMPLETED, AttemptStatus.AI_GRADING);
    }
}
