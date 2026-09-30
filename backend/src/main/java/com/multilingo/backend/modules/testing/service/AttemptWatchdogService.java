package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AttemptWatchdogService {

    private final TestAttemptRepository attemptRepo;

    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void finalizeExpiredAttempts() {
        List<TestAttempt> expired = attemptRepo
                .findByStatusAndDeadlineBefore(AttemptStatus.IN_PROGRESS, Instant.now());
        if (expired.isEmpty()) {
            return;
        }
        log.info("Watchdog: finalizing {} expired attempt(s)", expired.size());
        expired.forEach(a -> {
            a.setStatus(AttemptStatus.COMPLETED);
            a.setEndTime(Instant.now());
        });
        attemptRepo.saveAll(expired);
    }
}
