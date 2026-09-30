package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AttemptWatchdogServiceTest {

    @Mock
    TestAttemptRepository attemptRepo;

    @InjectMocks
    AttemptWatchdogService watchdogService;

    @Test
    void finalizeExpiredAttempts_changes_status_to_COMPLETED() {
        TestAttempt expired = new TestAttempt();
        expired.setStatus(AttemptStatus.IN_PROGRESS);
        expired.setDeadline(Instant.now().minusSeconds(120));

        when(attemptRepo.findByStatusAndDeadlineBefore(eq(AttemptStatus.IN_PROGRESS), any(Instant.class)))
                .thenReturn(List.of(expired));

        watchdogService.finalizeExpiredAttempts();

        assertThat(expired.getStatus()).isEqualTo(AttemptStatus.COMPLETED);
        verify(attemptRepo).saveAll(List.of(expired));
    }

    @Test
    void finalizeExpiredAttempts_does_nothing_when_no_expired_attempts() {
        when(attemptRepo.findByStatusAndDeadlineBefore(any(), any())).thenReturn(List.of());
        watchdogService.finalizeExpiredAttempts();
        verify(attemptRepo, never()).saveAll(any());
    }
}
