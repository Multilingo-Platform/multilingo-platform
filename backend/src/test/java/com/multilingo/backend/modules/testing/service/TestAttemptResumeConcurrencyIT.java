package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest;
import com.multilingo.backend.modules.testing.dto.response.AutosaveVersionResponse;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.reset;

@SpringBootTest
@ActiveProfiles("test")
class TestAttemptResumeConcurrencyIT {

    @Autowired
    private TestAttemptService testAttemptService;

    @SpyBean
    private TestAttemptRepository testAttemptRepository;

    @SpyBean
    private AttemptAnswerRepository attemptAnswerRepository;

    @Autowired
    private EntityManager entityManager;

    private static final Integer TEST_USER_ID = 1; // Handled by FixtureIdentityAdapter

    private final List<Integer> createdAttemptIds = new CopyOnWriteArrayList<>();

    @BeforeEach
    void setUp() {
        reset(testAttemptRepository);
        reset(attemptAnswerRepository);
    }

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
        reset(testAttemptRepository);
        reset(attemptAnswerRepository);
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
        TestAttempt saved = testAttemptRepository.save(attempt);
        createdAttemptIds.add(saved.getId());
        return saved;
    }

    @Test
    void resume_duringAutosave_readsCoherentSnapshot_andSubsequentGetReadsUpdatedVersion() throws Exception {
        // Arrange: seed attempt v1 with answer "ORIGINAL"
        TestAttempt attempt = seedAttempt(1, AttemptStatus.IN_PROGRESS);
        final Integer attemptId = attempt.getId();

        AttemptAnswer originalAnswer = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(10)
                .userAnswers(Map.of("q1", "ORIGINAL"))
                .build();
        attemptAnswerRepository.save(originalAnswer);

        CountDownLatch getHoldingLockLatch = new CountDownLatch(1);
        CountDownLatch autosaveArrivedAtLockLatch = new CountDownLatch(1);
        CountDownLatch proceedGetLatch = new CountDownLatch(1);
        AtomicBoolean hookTriggered = new AtomicBoolean(false);
        AtomicInteger findLockCallCount = new AtomicInteger(0);

        // Spy on findByIdAndUserIdForUpdate: Thread 1 acquires lock; Thread 2 signals arrival at lock query
        doAnswer(invocation -> {
            Integer argId = invocation.getArgument(0);
            Integer argUserId = invocation.getArgument(1);
            if (argId.equals(attemptId)) {
                int call = findLockCallCount.incrementAndGet();
                if (call == 2) {
                    autosaveArrivedAtLockLatch.countDown();
                }
            }
            return entityManager.createQuery(
                    "SELECT a FROM TestAttempt a WHERE a.id = :id AND a.userId = :userId", TestAttempt.class)
                    .setParameter("id", argId)
                    .setParameter("userId", argUserId)
                    .setLockMode(LockModeType.PESSIMISTIC_WRITE)
                    .getResultStream()
                    .findFirst();
        }).when(testAttemptRepository).findByIdAndUserIdForUpdate(eq(attemptId), any());

        // Spy on findByAttemptId: when getAttemptWorkspace calls findByAttemptId after acquiring attempt lock,
        // signal getHoldingLockLatch and pause until proceedGetLatch is released.
        doAnswer(invocation -> {
            Integer argId = invocation.getArgument(0);
            if (argId.equals(attemptId) && hookTriggered.compareAndSet(false, true)) {
                getHoldingLockLatch.countDown();
                assertThat(proceedGetLatch.await(5, TimeUnit.SECONDS)).isTrue();
            }
            return entityManager.createQuery(
                    "SELECT a FROM AttemptAnswer a WHERE a.attempt.id = :attemptId", AttemptAnswer.class)
                    .setParameter("attemptId", argId)
                    .getResultList();
        }).when(attemptAnswerRepository).findByAttemptId(attemptId);

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            // Thread 1: start getAttemptWorkspace (will acquire attempt row lock, then pause in findByAttemptId)
            Future<WorkspaceResponse> getFuture = executor.submit(() -> testAttemptService.getAttemptWorkspace(attemptId));

            // Wait until Thread 1 is holding the attempt row lock and paused in findByAttemptId
            assertThat(getHoldingLockLatch.await(5, TimeUnit.SECONDS)).isTrue();

            // Thread 2: start autosave with version 1 -> "NEW"
            // Because Thread 1 holds PESSIMISTIC_WRITE lock on attempt, Thread 2 will wait for the lock.
            AutosaveAnswersRequest reqNew = AutosaveAnswersRequest.builder()
                    .version(1)
                    .answers(List.of(
                            AutosaveAnswersRequest.PartAnswerDto.builder()
                                    .partId(10)
                                    .answers(List.of(
                                            AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                    .questionId("q1")
                                                    .answer("NEW")
                                                    .build()
                                    ))
                                    .build()
                    ))
                    .build();

            Future<AutosaveVersionResponse> saveFuture = executor.submit(() ->
                    testAttemptService.autosaveAnswers(attemptId, reqNew));

            // Wait until Thread 2 arrives at the row lock query while Thread 1 is still holding the lock
            assertThat(autosaveArrivedAtLockLatch.await(5, TimeUnit.SECONDS)).isTrue();

            // Release Thread 1 to complete its read before Thread 2 can acquire the lock
            proceedGetLatch.countDown();

            // Thread 1 completes: must see version 1 and "ORIGINAL"
            WorkspaceResponse resumeBeforeWrite = getFuture.get(10, TimeUnit.SECONDS);
            assertThat(resumeBeforeWrite.getVersion()).isEqualTo(1);
            assertThat(resumeBeforeWrite.getSavedAnswers()).isNotEmpty();
            assertThat(resumeBeforeWrite.getSavedAnswers().getFirst().getAnswers().getFirst().getAnswer())
                    .isEqualTo("ORIGINAL");

            // Thread 2 completes after Thread 1 releases the lock: increments version to 2
            AutosaveVersionResponse saveResponse = saveFuture.get(10, TimeUnit.SECONDS);
            assertThat(saveResponse.getVersion()).isEqualTo(2);

            // Subsequent getAttemptWorkspace must see version 2 and "NEW"
            WorkspaceResponse resumeAfterWrite = testAttemptService.getAttemptWorkspace(attemptId);
            assertThat(resumeAfterWrite.getVersion()).isEqualTo(2);
            assertThat(resumeAfterWrite.getSavedAnswers()).isNotEmpty();
            assertThat(resumeAfterWrite.getSavedAnswers().getFirst().getAnswers().getFirst().getAnswer())
                    .isEqualTo("NEW");
        } finally {
            proceedGetLatch.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void concurrency_lockSectionThenAutosave_bothSucceed_versionBecomesTwo_andSectionLocked() throws Exception {
        // Arrange: seed attempt v1 with answer "ORIGINAL"
        TestAttempt attempt = seedAttempt(1, AttemptStatus.IN_PROGRESS);
        final Integer attemptId = attempt.getId();

        AttemptAnswer originalAnswer = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(10)
                .userAnswers(Map.of("q1", "ORIGINAL"))
                .build();
        attemptAnswerRepository.save(originalAnswer);

        CountDownLatch lockHoldingLatch = new CountDownLatch(1);
        CountDownLatch autosaveArrivedAtLockLatch = new CountDownLatch(1);
        CountDownLatch proceedLockLatch = new CountDownLatch(1);
        AtomicBoolean lockHookTriggered = new AtomicBoolean(false);
        AtomicInteger lockQueryCount = new AtomicInteger(0);

        // Spy on findByIdAndUserIdForUpdate to confirm autosave arrives at the lock while lockSection holds it
        doAnswer(invocation -> {
            Integer argId = invocation.getArgument(0);
            Integer argUserId = invocation.getArgument(1);
            if (argId.equals(attemptId)) {
                int call = lockQueryCount.incrementAndGet();
                if (call == 2) {
                    autosaveArrivedAtLockLatch.countDown();
                }
            }
            return entityManager.createQuery(
                    "SELECT a FROM TestAttempt a WHERE a.id = :id AND a.userId = :userId", TestAttempt.class)
                    .setParameter("id", argId)
                    .setParameter("userId", argUserId)
                    .setLockMode(LockModeType.PESSIMISTIC_WRITE)
                    .getResultStream()
                    .findFirst();
        }).when(testAttemptRepository).findByIdAndUserIdForUpdate(eq(attemptId), any());

        // Spy on save(TestAttempt): when lockSection saves attempt with lockedSections containing 100,
        // signal lockHoldingLatch and pause until proceedLockLatch is released.
        doAnswer(invocation -> {
            TestAttempt target = invocation.getArgument(0);
            if (target.getId() != null && target.getId().equals(attemptId)
                    && target.getLockedSections() != null && target.getLockedSections().contains(100)) {
                if (lockHookTriggered.compareAndSet(false, true)) {
                    lockHoldingLatch.countDown();
                    assertThat(proceedLockLatch.await(5, TimeUnit.SECONDS)).isTrue();
                }
            }
            return target;
        }).when(testAttemptRepository).save(any(TestAttempt.class));

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            // Thread 1: start lockSection (will acquire lock, update lockedSections, pause in save)
            Future<?> lockFuture = executor.submit(() -> testAttemptService.lockSection(attemptId, 100));

            // Wait until Thread 1 is holding the lock
            assertThat(lockHoldingLatch.await(5, TimeUnit.SECONDS)).isTrue();

            // Thread 2: start autosave with version 1
            AutosaveAnswersRequest reqNew = AutosaveAnswersRequest.builder()
                    .version(1)
                    .answers(List.of(
                            AutosaveAnswersRequest.PartAnswerDto.builder()
                                    .partId(10)
                                    .answers(List.of(
                                            AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                    .questionId("q1")
                                                    .answer("NEW")
                                                    .build()
                                    ))
                                    .build()
                    ))
                    .build();

            Future<AutosaveVersionResponse> saveFuture = executor.submit(() ->
                    testAttemptService.autosaveAnswers(attemptId, reqNew));

            // Verify Thread 2 arrives at the lock query while Thread 1 is still holding the lock
            assertThat(autosaveArrivedAtLockLatch.await(5, TimeUnit.SECONDS)).isTrue();

            // Release Thread 1 to complete its transaction and release the row lock
            proceedLockLatch.countDown();

            lockFuture.get(10, TimeUnit.SECONDS);
            AutosaveVersionResponse saveResponse = saveFuture.get(10, TimeUnit.SECONDS);
            assertThat(saveResponse.getVersion()).isEqualTo(2);

            // Verify final state: version must be 2, section 100 locked, answer "NEW"
            TestAttempt reloadedAttempt = testAttemptRepository.findById(attemptId).orElseThrow();
            assertThat(reloadedAttempt.getVersion()).isEqualTo(2);
            assertThat(reloadedAttempt.getLockedSections()).contains(100);

            AttemptAnswer reloadedAnswer = attemptAnswerRepository.findByAttemptIdAndPartId(attemptId, 10).orElseThrow();
            assertThat(reloadedAnswer.getUserAnswers().get("q1")).isEqualTo("NEW");
        } finally {
            proceedLockLatch.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void concurrency_autosaveThenLockSection_bothSucceed_versionBecomesTwo_andSectionLocked() throws Exception {
        // Arrange: seed attempt v1 with answer "ORIGINAL"
        TestAttempt attempt = seedAttempt(1, AttemptStatus.IN_PROGRESS);
        final Integer attemptId = attempt.getId();

        AttemptAnswer originalAnswer = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(10)
                .userAnswers(Map.of("q1", "ORIGINAL"))
                .build();
        attemptAnswerRepository.save(originalAnswer);

        CountDownLatch autosaveHoldingLatch = new CountDownLatch(1);
        CountDownLatch lockArrivedAtLockLatch = new CountDownLatch(1);
        CountDownLatch proceedAutosaveLatch = new CountDownLatch(1);
        AtomicBoolean autosaveHookTriggered = new AtomicBoolean(false);
        AtomicInteger lockQueryCount = new AtomicInteger(0);

        // Spy on findByIdAndUserIdForUpdate to confirm lockSection arrives at the lock while autosave holds it
        doAnswer(invocation -> {
            Integer argId = invocation.getArgument(0);
            Integer argUserId = invocation.getArgument(1);
            if (argId.equals(attemptId)) {
                int call = lockQueryCount.incrementAndGet();
                if (call == 2) {
                    lockArrivedAtLockLatch.countDown();
                }
            }
            return entityManager.createQuery(
                    "SELECT a FROM TestAttempt a WHERE a.id = :id AND a.userId = :userId", TestAttempt.class)
                    .setParameter("id", argId)
                    .setParameter("userId", argUserId)
                    .setLockMode(LockModeType.PESSIMISTIC_WRITE)
                    .getResultStream()
                    .findFirst();
        }).when(testAttemptRepository).findByIdAndUserIdForUpdate(eq(attemptId), any());

        // Spy on save(TestAttempt): when autosave saves attempt with version 2, pause to hold lock
        doAnswer(invocation -> {
            TestAttempt target = invocation.getArgument(0);
            if (target.getId() != null && target.getId().equals(attemptId)
                    && Integer.valueOf(2).equals(target.getVersion())) {
                if (autosaveHookTriggered.compareAndSet(false, true)) {
                    autosaveHoldingLatch.countDown();
                    assertThat(proceedAutosaveLatch.await(5, TimeUnit.SECONDS)).isTrue();
                }
            }
            return target;
        }).when(testAttemptRepository).save(any(TestAttempt.class));

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            // Thread 1: start autosave with version 1 -> increments to 2, pauses in save
            AutosaveAnswersRequest reqNew = AutosaveAnswersRequest.builder()
                    .version(1)
                    .answers(List.of(
                            AutosaveAnswersRequest.PartAnswerDto.builder()
                                    .partId(10)
                                    .answers(List.of(
                                            AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                    .questionId("q1")
                                                    .answer("NEW")
                                                    .build()
                                    ))
                                    .build()
                    ))
                    .build();

            Future<AutosaveVersionResponse> saveFuture = executor.submit(() ->
                    testAttemptService.autosaveAnswers(attemptId, reqNew));

            // Wait until Thread 1 is holding the lock
            assertThat(autosaveHoldingLatch.await(5, TimeUnit.SECONDS)).isTrue();

            // Thread 2: start lockSection
            Future<?> lockFuture = executor.submit(() -> testAttemptService.lockSection(attemptId, 100));

            // Verify Thread 2 arrives at the lock query while Thread 1 is still holding the lock
            assertThat(lockArrivedAtLockLatch.await(5, TimeUnit.SECONDS)).isTrue();

            // Release Thread 1 to complete its transaction and release the row lock
            proceedAutosaveLatch.countDown();

            AutosaveVersionResponse saveResponse = saveFuture.get(10, TimeUnit.SECONDS);
            assertThat(saveResponse.getVersion()).isEqualTo(2);

            lockFuture.get(10, TimeUnit.SECONDS);

            // Verify final state: version must be 2, section 100 locked, answer "NEW"
            TestAttempt reloadedAttempt = testAttemptRepository.findById(attemptId).orElseThrow();
            assertThat(reloadedAttempt.getVersion()).isEqualTo(2);
            assertThat(reloadedAttempt.getLockedSections()).contains(100);

            AttemptAnswer reloadedAnswer = attemptAnswerRepository.findByAttemptIdAndPartId(attemptId, 10).orElseThrow();
            assertThat(reloadedAnswer.getUserAnswers().get("q1")).isEqualTo("NEW");
        } finally {
            proceedAutosaveLatch.countDown();
            executor.shutdownNow();
        }
    }
}
