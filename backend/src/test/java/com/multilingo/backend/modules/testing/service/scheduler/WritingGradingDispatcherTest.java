package com.multilingo.backend.modules.testing.service.scheduler;

import com.multilingo.backend.modules.testing.config.WritingGradingProperties;
import com.multilingo.backend.modules.testing.repository.WritingGradingJobRepository;
import com.multilingo.backend.modules.testing.service.support.WritingGradingTransactionCoordinator;
import com.multilingo.backend.modules.testing.service.worker.WritingGradingWorker;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WritingGradingDispatcherTest {

    @Mock
    private WritingGradingJobRepository jobRepository;

    @Mock
    private WritingGradingTransactionCoordinator coordinator;

    @Mock
    private WritingGradingWorker worker;

    private WritingGradingProperties properties;
    private Clock clock;
    private ThreadPoolTaskExecutor taskExecutor;
    private WritingGradingDispatcher dispatcher;

    @BeforeEach
    void setUp() {
        properties = new WritingGradingProperties();
        properties.setEnabled(true);
        properties.setDispatcherEnabled(true);
        properties.setConcurrency(2);
        properties.setBatchSize(10);

        clock = Clock.fixed(Instant.parse("2026-10-15T10:00:00Z"), ZoneOffset.UTC);

        taskExecutor = new ThreadPoolTaskExecutor();
        taskExecutor.setCorePoolSize(2);
        taskExecutor.setMaxPoolSize(2);
        taskExecutor.setQueueCapacity(0);
        taskExecutor.setThreadNamePrefix("test-writing-grading-");
        taskExecutor.initialize();

        dispatcher = new WritingGradingDispatcher(jobRepository, coordinator, worker, properties, clock, taskExecutor);
    }

    @AfterEach
    void tearDown() {
        if (taskExecutor != null) {
            taskExecutor.shutdown();
        }
    }

    @Test
    @DisplayName("tick - khi properties.enabled=false thì không recover, không query due jobs, không gọi worker")
    void tick_whenDisabled_doesNothing() {
        properties.setEnabled(false);

        dispatcher.tick();

        verifyNoInteractions(coordinator, jobRepository, worker);
        assertThat(dispatcher.getInFlightCount()).isZero();
    }

    @Test
    @DisplayName("tick - khi properties.dispatcherEnabled=false thì không làm gì")
    void tick_whenDispatcherDisabled_doesNothing() {
        properties.setDispatcherEnabled(false);

        dispatcher.tick();

        verifyNoInteractions(coordinator, jobRepository, worker);
        assertThat(dispatcher.getInFlightCount()).isZero();
    }

    @Test
    @DisplayName("tick - khi enabled: gọi coordinator.recoverExpired trước, sau đó query due jobs và dispatch qua executor")
    void tick_whenEnabled_recoversExpiredThenDispatchesDueJobs() throws Exception {
        when(coordinator.recoverExpired(10)).thenReturn(2);
        when(jobRepository.findDueJobIds(eq(clock.instant()), any(PageRequest.class)))
                .thenReturn(List.of(101, 102));

        CountDownLatch latch = new CountDownLatch(2);
        doAnswer(invocation -> {
            latch.countDown();
            return null;
        }).when(worker).process(anyInt());

        dispatcher.tick();

        boolean completed = latch.await(3, TimeUnit.SECONDS);
        assertThat(completed).isTrue();

        verify(coordinator).recoverExpired(10);
        verify(jobRepository).findDueJobIds(eq(clock.instant()), eq(PageRequest.of(0, 2)));
        verify(worker).process(101);
        verify(worker).process(102);
        await().atMost(3, TimeUnit.SECONDS).untilAsserted(() -> assertThat(dispatcher.getInFlightCount()).isZero());
    }

    @Test
    @DisplayName("tick - khi capacity đã cạn (inFlight == concurrency): vẫn gọi recoverExpired nhưng không query due jobs")
    void tick_whenCapacityExhausted_recoversExpiredButDoesNotQueryOrDispatch() throws Exception {
        CountDownLatch workerBlocker = new CountDownLatch(1);
        CountDownLatch workersStarted = new CountDownLatch(2);

        doAnswer(invocation -> {
            workersStarted.countDown();
            workerBlocker.await(5, TimeUnit.SECONDS);
            return null;
        }).when(worker).process(anyInt());

        when(coordinator.recoverExpired(10)).thenReturn(0);
        when(jobRepository.findDueJobIds(eq(clock.instant()), any(PageRequest.class)))
                .thenReturn(List.of(101, 102));

        // Tick 1: lấp đầy cả 2 workers
        dispatcher.tick();
        boolean started = workersStarted.await(3, TimeUnit.SECONDS);
        assertThat(started).isTrue();
        assertThat(dispatcher.getInFlightCount()).isEqualTo(2);
        assertThat(dispatcher.getAvailableCapacity()).isZero();

        // Tick 2: capacity = 0 -> chỉ gọi recoverExpired, không được query due jobs
        reset(jobRepository);
        dispatcher.tick();

        verify(coordinator, times(2)).recoverExpired(10);
        verifyNoInteractions(jobRepository);

        // Giải phóng workers
        workerBlocker.countDown();
    }

    @Test
    @DisplayName("tick - khi executor ném RejectedExecutionException thì bắt an toàn và xóa khỏi inFlight")
    void tick_whenExecutionRejected_removesFromInFlightGracefully() {
        ThreadPoolTaskExecutor mockExecutor = mock(ThreadPoolTaskExecutor.class);
        doThrow(new RejectedExecutionException("Executor shutting down")).when(mockExecutor).execute(any());

        WritingGradingDispatcher mockDispatcher = new WritingGradingDispatcher(
                jobRepository, coordinator, worker, properties, clock, mockExecutor
        );

        when(coordinator.recoverExpired(10)).thenReturn(0);
        when(jobRepository.findDueJobIds(eq(clock.instant()), any(PageRequest.class)))
                .thenReturn(List.of(101));

        mockDispatcher.tick();

        assertThat(mockDispatcher.getInFlightCount()).isZero();
    }

    @Test
    @DisplayName("tick - khi due jobs ít hơn capacity: query thêm waiting jobs cho số slots còn lại")
    void tick_whenCapacityRemainsAfterDueJobs_dispatchesWaitingJobs() throws Exception {
        when(coordinator.recoverExpired(10)).thenReturn(0);
        when(jobRepository.findDueJobIds(eq(clock.instant()), eq(PageRequest.of(0, 2))))
                .thenReturn(List.of(101));
        when(jobRepository.findWaitingJobIds(eq(clock.instant()), eq(PageRequest.of(0, 1))))
                .thenReturn(List.of(201));

        CountDownLatch latch = new CountDownLatch(2);
        doAnswer(invocation -> {
            latch.countDown();
            return null;
        }).when(worker).process(anyInt());

        dispatcher.tick();

        boolean completed = latch.await(3, TimeUnit.SECONDS);
        assertThat(completed).isTrue();

        verify(worker).process(101);
        verify(worker).process(201);
        await().atMost(3, TimeUnit.SECONDS).untilAsserted(() -> assertThat(dispatcher.getInFlightCount()).isZero());
    }

    @Test
    @DisplayName("tick - không submit trùng jobId khi job đang in-flight")
    void tick_doesNotDispatchDuplicateJob_whenAlreadyInFlight() throws Exception {
        CountDownLatch workerBlocker = new CountDownLatch(1);
        CountDownLatch worker1Started = new CountDownLatch(1);

        doAnswer(invocation -> {
            worker1Started.countDown();
            workerBlocker.await(5, TimeUnit.SECONDS);
            return null;
        }).when(worker).process(eq(101));

        when(coordinator.recoverExpired(10)).thenReturn(0);
        when(jobRepository.findDueJobIds(eq(clock.instant()), any(PageRequest.class)))
                .thenReturn(List.of(101));

        // Tick 1: submit job 101
        dispatcher.tick();
        boolean started = worker1Started.await(3, TimeUnit.SECONDS);
        assertThat(started).isTrue();
        assertThat(dispatcher.getInFlightCount()).isEqualTo(1);

        // Tick 2: jobRepository vẫn trả 101 vì chưa commit xong -> dispatcher bỏ qua vì đã in-flight
        dispatcher.tick();

        verify(worker, times(1)).process(101);

        workerBlocker.countDown();
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"recovery", "submission"})
    void tick_exceptionLogsDoNotExposePayloadOrCauses(String phase) {
        String[] secrets = {"ESSAY_SENTINEL", "PROMPT_SENTINEL", "FEEDBACK_SENTINEL",
                "https://signed.example.test/image?token=URL_SENTINEL", "RUN_TOKEN_SENTINEL"};
        RuntimeException unsafe = new RuntimeException(String.join(" ", secrets), new IllegalStateException("CAUSE_SENTINEL"));
        if (phase.equals("recovery")) doThrow(unsafe).when(coordinator).recoverExpired(anyInt());
        else {
            taskExecutor.shutdown();
            taskExecutor = mock(ThreadPoolTaskExecutor.class);
            dispatcher = new WritingGradingDispatcher(jobRepository, coordinator, worker, properties, clock, taskExecutor);
            when(jobRepository.findDueJobIds(any(), any())).thenReturn(List.of(101));
            doThrow(unsafe).when(taskExecutor).execute(any(Runnable.class));
        }
        var logger = (ch.qos.logback.classic.Logger)org.slf4j.LoggerFactory.getLogger(WritingGradingDispatcher.class);
        var appender = new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        appender.start(); logger.addAppender(appender);
        try {
            dispatcher.tick();
            assertThat(appender.list).isNotEmpty();
            for (var event : appender.list) {
                assertThat(event.getFormattedMessage()).doesNotContain(secrets).doesNotContain("CAUSE_SENTINEL");
                assertThat(event.getThrowableProxy()).isNull();
            }
            String code = phase.equals("recovery") ? "RECOVERY_FAILED" : "SUBMISSION_FAILED";
            assertThat(appender.list).anySatisfy(event -> assertThat(event.getFormattedMessage()).contains(code));
            if (phase.equals("submission")) {
                assertThat(appender.list).anySatisfy(event -> assertThat(event.getFormattedMessage()).contains("101"));
                assertThat(dispatcher.getInFlightCount()).isZero();
            }
        } finally { logger.detachAppender(appender); appender.stop(); }
    }

    @org.springframework.boot.test.context.TestConfiguration(proxyBeanMethods = false)
    @org.springframework.scheduling.annotation.EnableScheduling
    static class SchedulingTestConfig { }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"5s", "30s", "60s", "PT45S"})
    void schedulingRegistersConfiguredFixedDelay(String interval) {
        try (var spring = new org.springframework.context.annotation.AnnotationConfigApplicationContext()) {
            spring.getEnvironment().getPropertySources().addFirst(new org.springframework.core.env.MapPropertySource("test", java.util.Map.of(
                    "testing.writing-grading.poll-interval", interval)));
            // Keep actual scheduled tasks registered without running a tick/provider or waiting for wall time.
            var scheduler = mock(org.springframework.scheduling.TaskScheduler.class);
            spring.registerBean("taskScheduler", org.springframework.scheduling.TaskScheduler.class, () -> scheduler);
            spring.registerBean("dispatcher", WritingGradingDispatcher.class, () -> dispatcher);
            properties.setEnabled(false);
            spring.register(SchedulingTestConfig.class);
            spring.refresh();
            var processor = spring.getBean(org.springframework.scheduling.annotation.ScheduledAnnotationBeanPostProcessor.class);
            assertThat(processor.getScheduledTasks()).hasSize(1);
            var task = processor.getScheduledTasks().iterator().next().getTask();
            assertThat(task).isInstanceOf(org.springframework.scheduling.config.FixedDelayTask.class);
            long expected = switch (interval) { case "5s" -> 5000L; case "30s" -> 30000L; case "60s" -> 60000L; default -> 45000L; };
            assertThat(((org.springframework.scheduling.config.FixedDelayTask)task).getIntervalDuration()).isEqualTo(java.time.Duration.ofMillis(expected));
            verifyNoInteractions(coordinator, jobRepository, worker);
        }
    }
}
