package com.multilingo.backend.modules.testing.service.scheduler;

import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.service.TestAttemptService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

/**
 * Background scheduler that periodically scans for expired test attempts
 * whose client timeout has passed the 15-second grace window, and finalizes them.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AttemptExpirationScheduler {

    private final TestAttemptRepository testAttemptRepository;
    private final TestAttemptService testAttemptService;

    @Scheduled(fixedDelay = 30000)
    public void sweepExpiredAttempts() {
        // Cutoff is 15 seconds past deadline to respect the client timeout grace window
        Instant cutoff = Instant.now().minusSeconds(15);
        List<TestAttempt> expiredAttempts = testAttemptRepository.findByStatusAndDeadlineBefore(
                AttemptStatus.IN_PROGRESS, cutoff);

        if (expiredAttempts == null || expiredAttempts.isEmpty()) {
            return;
        }

        log.info("Scheduler: found {} expired attempt(s) to finalize", expiredAttempts.size());
        for (TestAttempt attempt : expiredAttempts) {
            try {
                testAttemptService.expireAttemptBySystem(attempt.getId());
            } catch (Exception e) {
                log.error("Failed to expire attempt {}: {}", attempt.getId(), e.getMessage(), e);
            }
        }
    }
}
