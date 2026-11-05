package com.multilingo.backend.modules.analytics.adapter.impl;

import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DbExamTrackingAdapterTest {

    @Mock
    private TestAttemptRepository testAttemptRepository;

    @InjectMocks
    private DbExamTrackingAdapter adapter;

    @Test
    @DisplayName("countTotalAttempts should invoke countTotalValidAttempts to exclude deleted exams")
    void countTotalAttempts_usesValidAttemptsOnly() {
        when(testAttemptRepository.countTotalValidAttempts()).thenReturn(42L);

        long result = adapter.countTotalAttempts();

        assertThat(result).isEqualTo(42L);
    }

    @Test
    @DisplayName("countAttemptsByStatus should parse status tuples correctly")
    void countAttemptsByStatus_parsesGroupedTuples() {
        List<Object[]> rows = List.of(
                new Object[]{"COMPLETED", 30L},
                new Object[]{"IN_PROGRESS", 10L},
                new Object[]{"EXPIRED", 2L}
        );
        when(testAttemptRepository.countAttemptsGroupedByStatus()).thenReturn(rows);

        Map<String, Long> result = adapter.countAttemptsByStatus();

        assertThat(result).hasSize(3);
        assertThat(result.get("COMPLETED")).isEqualTo(30L);
        assertThat(result.get("IN_PROGRESS")).isEqualTo(10L);
        assertThat(result.get("EXPIRED")).isEqualTo(2L);
    }
}

