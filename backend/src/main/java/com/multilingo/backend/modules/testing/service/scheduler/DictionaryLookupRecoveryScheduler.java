package com.multilingo.backend.modules.testing.service.scheduler;

import com.multilingo.backend.modules.testing.service.support.DictionaryLookupTransactionCoordinator;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "testing.dictionary-lookup", name = "enabled", havingValue = "true")
public class DictionaryLookupRecoveryScheduler {
    private final DictionaryLookupTransactionCoordinator coordinator;
    private final Clock clock;

    @Scheduled(fixedDelayString = "${testing.dictionary-lookup.recovery-interval-ms:60000}")
    public void recoverExpiredRequests() {
        var now = clock.instant();
        for (Integer userId : coordinator.findExpiredUserIds(now)) {
            coordinator.recoverExpiredForUser(userId, now);
        }
    }
}
