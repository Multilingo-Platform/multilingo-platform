package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest;
import com.multilingo.backend.modules.testing.dto.response.AutosaveVersionResponse;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.reset;

@SpringBootTest
@ActiveProfiles("test")
class TestAttemptAutosaveConcurrencyIT {

    @Autowired
    private TestAttemptService testAttemptService;

    @SpyBean
    private TestAttemptRepository testAttemptRepository;

    @Autowired
    private AttemptAnswerRepository attemptAnswerRepository;

    private static final Integer TEST_USER_ID = 1; // Handled by FixtureIdentityAdapter

    @BeforeEach
    void setUp() {
        reset(testAttemptRepository);
        attemptAnswerRepository.deleteAll();
        testAttemptRepository.deleteAll();
    }

    private TestAttempt seedAttempt(int version, AttemptStatus status) {
        TestAttempt attempt = TestAttempt.builder()
                .userId(TEST_USER_ID)
                .examId(999)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.MOCK_TEST)
                .status(status)
                .version(version)
                .startTime(Instant.now().minusSeconds(60))
                .deadline(Instant.now().plusSeconds(3600))
                .build();
        return testAttemptRepository.save(attempt);
    }

    @Test
    void concurrency_twoThreadsSameVersion_exactlyOneWins_andVersionIsTwo() throws Exception {
        // Arrange
        TestAttempt attempt = seedAttempt(1, AttemptStatus.IN_PROGRESS);
        final Integer attemptId = attempt.getId();

        int numThreads = 2;
        ExecutorService executor = Executors.newFixedThreadPool(numThreads);
        CountDownLatch readyLatch = new CountDownLatch(numThreads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(numThreads);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger conflictCount = new AtomicInteger(0);
        List<Throwable> unexpectedErrors = Collections.synchronizedList(new ArrayList<>());
        List<AutosaveVersionResponse> successResponses = Collections.synchronizedList(new ArrayList<>());

        for (int i = 1; i <= numThreads; i++) {
            final String answerValue = "THREAD_" + i;
            executor.submit(() -> {
                readyLatch.countDown();
                try {
                    startLatch.await();

                    AutosaveAnswersRequest req = AutosaveAnswersRequest.builder()
                            .version(1)
                            .answers(List.of(
                                    AutosaveAnswersRequest.PartAnswerDto.builder()
                                            .partId(10)
                                            .answers(List.of(
                                                    AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                            .questionId("q1")
                                                            .answer(answerValue)
                                                            .build()
                                            ))
                                            .build()
                            ))
                            .build();

                    AutosaveVersionResponse res = testAttemptService.autosaveAnswers(attemptId, req);
                    successResponses.add(res);
                    successCount.incrementAndGet();
                } catch (AppException e) {
                    if (e.getErrorCode() == ErrorCode.VERSION_CONFLICT) {
                        conflictCount.incrementAndGet();
                    } else {
                        unexpectedErrors.add(e);
                    }
                } catch (Throwable t) {
                    unexpectedErrors.add(t);
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        readyLatch.await(5, TimeUnit.SECONDS);
        startLatch.countDown(); // Release both threads simultaneously
        boolean finished = doneLatch.await(15, TimeUnit.SECONDS);
        executor.shutdown();

        // Assert
        assertThat(finished).isTrue();
        assertThat(unexpectedErrors).isEmpty();
        assertThat(successCount.get()).isEqualTo(1);
        assertThat(conflictCount.get()).isEqualTo(1);

        // Verify winner response
        assertThat(successResponses).hasSize(1);
        assertThat(successResponses.get(0).getVersion()).isEqualTo(2);

        // Verify database state: version must be 2 (not 3, lost update prevented)
        TestAttempt reloadedAttempt = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(reloadedAttempt.getVersion()).isEqualTo(2);

        // Verify stored answer in DB is consistent and belongs to one of the threads
        AttemptAnswer answer = attemptAnswerRepository.findByAttemptIdAndPartId(attemptId, 10).orElseThrow();
        assertThat(answer.getUserAnswers()).containsKey("q1");
        Object savedAnswer = answer.getUserAnswers().get("q1");
        assertThat(savedAnswer).isIn("THREAD_1", "THREAD_2");
    }

    @Test
    void autosave_staleVersion_throwsVersionConflict_andPreservesVersionAndAnswer() {
        // Arrange
        TestAttempt attempt = seedAttempt(2, AttemptStatus.IN_PROGRESS);
        AttemptAnswer initialAnswer = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(10)
                .userAnswers(Map.of("q1", "INITIAL_ANSWER"))
                .build();
        attemptAnswerRepository.save(initialAnswer);

        AutosaveAnswersRequest staleRequest = AutosaveAnswersRequest.builder()
                .version(1) // Stale version
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(10)
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                .questionId("q1")
                                                .answer("STALE_ANSWER")
                                                .build()
                                ))
                                .build()
                ))
                .build();

        // Act & Assert
        assertThatThrownBy(() -> testAttemptService.autosaveAnswers(attempt.getId(), staleRequest))
                .isInstanceOf(AppException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.VERSION_CONFLICT);

        // Verify attempt version in DB is unchanged
        TestAttempt reloaded = testAttemptRepository.findById(attempt.getId()).orElseThrow();
        assertThat(reloaded.getVersion()).isEqualTo(2);

        // Verify answer in DB is unchanged
        AttemptAnswer reloadedAnswer = attemptAnswerRepository.findByAttemptIdAndPartId(attempt.getId(), 10).orElseThrow();
        assertThat(reloadedAnswer.getUserAnswers().get("q1")).isEqualTo("INITIAL_ANSWER");
    }

    @Test
    void autosave_transactionRollback_onException_preservesPreviousState() {
        // Arrange
        TestAttempt attempt = seedAttempt(5, AttemptStatus.IN_PROGRESS);
        AttemptAnswer initialAnswer = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(10)
                .userAnswers(Map.of("q1", "ORIGINAL_DATA"))
                .build();
        attemptAnswerRepository.save(initialAnswer);

        // Matching version 5 with new answer data to verify rollback of partial mutations
        AutosaveAnswersRequest mutateRequest = AutosaveAnswersRequest.builder()
                .version(5)
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(10)
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                .questionId("q1")
                                                .answer("MUTATED_DATA_SHOULD_ROLLBACK")
                                                .build()
                                ))
                                .build()
                ))
                .build();

        // Simulate failure AFTER saveAnswersInternal has mutated answers,
        // specifically when persisting the updated attempt version.
        doAnswer(invocation -> {
            TestAttempt target = invocation.getArgument(0);
            if (target.getId() != null && target.getId().equals(attempt.getId()) && Integer.valueOf(6).equals(target.getVersion())) {
                attemptAnswerRepository.flush(); // Flush the persistence context to the database to ensure changes reach the DB
                throw new RuntimeException("Simulated failure after answer mutation before commit");
            }
            return target; // Spring Data save returns the entity. Dirty checking will persist it during flush.
        }).when(testAttemptRepository).save(any(TestAttempt.class));

        // Act & Assert
        assertThatThrownBy(() -> testAttemptService.autosaveAnswers(attempt.getId(), mutateRequest))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Simulated failure after answer mutation before commit");

        // Verify transactional rollback from database: both attempt version and answers remain unchanged
        TestAttempt reloaded = testAttemptRepository.findById(attempt.getId()).orElseThrow();
        assertThat(reloaded.getVersion()).isEqualTo(5);

        AttemptAnswer reloadedAnswer = attemptAnswerRepository.findByAttemptIdAndPartId(attempt.getId(), 10).orElseThrow();
        assertThat(reloadedAnswer.getUserAnswers().get("q1")).isEqualTo("ORIGINAL_DATA");
    }
}
