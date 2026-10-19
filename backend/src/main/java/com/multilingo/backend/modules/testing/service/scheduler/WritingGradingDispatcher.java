package com.multilingo.backend.modules.testing.service.scheduler;

import com.multilingo.backend.modules.testing.config.WritingGradingProperties;
import com.multilingo.backend.modules.testing.repository.WritingGradingJobRepository;
import com.multilingo.backend.modules.testing.service.support.WritingGradingTransactionCoordinator;
import com.multilingo.backend.modules.testing.service.worker.WritingGradingWorker;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * Dispatcher điều phối chấm bài Writing định kỳ với giới hạn tài nguyên (bounded capacity).
 *
 * Mỗi chu kỳ (tick):
 *   1. Phục hồi các công việc quá hạn lease (coordinator.recoverExpired);
 *   2. Kiểm tra dung lượng khả dụng của executor chuyên dụng;
 *   3. Truy vấn các công việc đến hạn (findDueJobIds) theo batch có giới hạn;
 *   4. Đẩy việc vào worker qua executor (chỉ khi có capacity, không lock trên scheduler thread);
 *   5. Nếu còn capacity, truy vấn tiếp các công việc đang chờ tái kiểm tra (findWaitingJobIds).
 */
@Slf4j
@Component
public class WritingGradingDispatcher {

    private final WritingGradingJobRepository jobRepository;
    private final WritingGradingTransactionCoordinator coordinator;
    private final WritingGradingWorker worker;
    private final WritingGradingProperties properties;
    private final Clock clock;
    private final ThreadPoolTaskExecutor taskExecutor;

    private final Set<Integer> inFlightJobIds = ConcurrentHashMap.newKeySet();

    @Autowired
    public WritingGradingDispatcher(
            WritingGradingJobRepository jobRepository,
            WritingGradingTransactionCoordinator coordinator,
            WritingGradingWorker worker,
            WritingGradingProperties properties,
            Clock clock,
            @Qualifier("writingGradingTaskExecutor") ThreadPoolTaskExecutor taskExecutor
    ) {
        this.jobRepository = Objects.requireNonNull(jobRepository, "jobRepository must not be null");
        this.coordinator = Objects.requireNonNull(coordinator, "coordinator must not be null");
        this.worker = Objects.requireNonNull(worker, "worker must not be null");
        this.properties = Objects.requireNonNull(properties, "properties must not be null");
        this.clock = Objects.requireNonNull(clock, "clock must not be null");
        this.taskExecutor = taskExecutor;
    }

    @Scheduled(fixedDelayString = "#{T(org.springframework.boot.convert.DurationStyle).detectAndParse('${testing.writing-grading.poll-interval:5s}').toMillis()}")
    public void tick() {
        if (!properties.isEnabled() || !properties.isDispatcherEnabled()) {
            return;
        }

        // 1. Phục hồi các job quá hạn lease trước mỗi đợt dispatch
        try {
            int batchSize = Math.max(1, properties.getBatchSize());
            int recovered = coordinator.recoverExpired(batchSize);
            if (recovered > 0) {
                log.info("Recovered {} expired writing grading job(s)", recovered);
            }
        } catch (Exception e) {
            log.error("Error during recovery of expired writing grading jobs: errorCode=RECOVERY_FAILED");
        }

        // 2. Kiểm tra dung lượng khả dụng trước khi truy vấn do due jobs
        int availableCapacity = getAvailableCapacity();
        if (availableCapacity <= 0) {
            log.debug("No available capacity in writing grading executor (concurrency={}, inFlight={})",
                    properties.getConcurrency(), inFlightJobIds.size());
            return;
        }

        // 3. Truy vấn due jobs theo batch giới hạn
        Instant now = clock.instant();
        int limit = Math.min(properties.getBatchSize(), availableCapacity);
        PageRequest pageRequest = PageRequest.of(0, limit);
        List<Integer> dueJobIds = jobRepository.findDueJobIds(now, pageRequest);

        for (Integer jobId : dueJobIds) {
            if (getAvailableCapacity() <= 0) {
                break;
            }
            dispatchJob(jobId);
        }

        // 4. Nếu còn capacity, kiểm tra các jobs đang ở trạng thái WAITING đến hạn recheck
        int remainingCapacity = getAvailableCapacity();
        if (remainingCapacity > 0) {
            List<Integer> waitingJobIds = jobRepository.findWaitingJobIds(now, PageRequest.of(0, remainingCapacity));
            for (Integer jobId : waitingJobIds) {
                if (getAvailableCapacity() <= 0) {
                    break;
                }
                dispatchJob(jobId);
            }
        }
    }

    private void dispatchJob(Integer jobId) {
        if (jobId == null) {
            return;
        }
        if (inFlightJobIds.add(jobId)) {
            try {
                taskExecutor.execute(() -> {
                    try {
                        worker.process(jobId);
                    } finally {
                        inFlightJobIds.remove(jobId);
                    }
                });
            } catch (RejectedExecutionException e) {
                inFlightJobIds.remove(jobId);
                log.warn("Execution rejected for writing grading job {}", jobId);
            } catch (Exception e) {
                inFlightJobIds.remove(jobId);
                log.error("Unexpected error submitting writing grading job {}: errorCode=SUBMISSION_FAILED", jobId);
            }
        }
    }

    public int getInFlightCount() {
        return inFlightJobIds.size();
    }

    public int getAvailableCapacity() {
        int maxPoolSize = Math.max(1, properties.getConcurrency());
        int inFlightFree = Math.max(0, maxPoolSize - inFlightJobIds.size());
        if (taskExecutor == null) {
            return 0;
        }
        try {
            ThreadPoolExecutor tpe = taskExecutor.getThreadPoolExecutor();
            if (tpe.isShutdown() || tpe.isTerminating() || tpe.isTerminated()) {
                return 0;
            }
            int activeCount = tpe.getActiveCount();
            int queueSize = tpe.getQueue().size();
            int poolFree = Math.max(0, maxPoolSize - activeCount - queueSize);
            return Math.min(poolFree, inFlightFree);
        } catch (Exception e) {
            return inFlightFree;
        }
    }
}
