package com.multilingo.backend.modules.testing.service.scheduler;

import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.service.TestAttemptService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AttemptExpirationSchedulerTest {

    @Mock
    private TestAttemptRepository testAttemptRepository;

    @Mock
    private TestAttemptService testAttemptService;

    @InjectMocks
    private AttemptExpirationScheduler scheduler;

    @Test
    void sweepExpiredAttempts_callsExpireAttemptBySystem() {
        TestAttempt attempt1 = new TestAttempt();
        attempt1.setId(101);
        attempt1.setStatus(AttemptStatus.IN_PROGRESS);
        attempt1.setDeadline(Instant.now().minusSeconds(20));

        TestAttempt attempt2 = new TestAttempt();
        attempt2.setId(102);
        attempt2.setStatus(AttemptStatus.IN_PROGRESS);
        attempt2.setDeadline(Instant.now().minusSeconds(40));

        when(testAttemptRepository.findByStatusAndDeadlineBefore(eq(AttemptStatus.IN_PROGRESS), any(Instant.class)))
                .thenReturn(List.of(attempt1, attempt2));

        scheduler.sweepExpiredAttempts();

        verify(testAttemptService).expireAttemptBySystem(101);
        verify(testAttemptService).expireAttemptBySystem(102);
    }

    @Test
    void sweepExpiredAttempts_doesNothingWhenNoExpiredAttempts() {
        when(testAttemptRepository.findByStatusAndDeadlineBefore(eq(AttemptStatus.IN_PROGRESS), any(Instant.class)))
                .thenReturn(List.of());

        scheduler.sweepExpiredAttempts();

        verify(testAttemptService, never()).expireAttemptBySystem(any());
    }

    @Test
    void sweepExpiredAttempts_continuesWhenSingleAttemptFails() {
        TestAttempt attempt1 = new TestAttempt();
        attempt1.setId(101);

        TestAttempt attempt2 = new TestAttempt();
        attempt2.setId(102);

        when(testAttemptRepository.findByStatusAndDeadlineBefore(eq(AttemptStatus.IN_PROGRESS), any(Instant.class)))
                .thenReturn(List.of(attempt1, attempt2));

        doThrow(new RuntimeException("DB error")).when(testAttemptService).expireAttemptBySystem(101);

        scheduler.sweepExpiredAttempts();

        verify(testAttemptService).expireAttemptBySystem(101);
        verify(testAttemptService).expireAttemptBySystem(102);
    }
}
