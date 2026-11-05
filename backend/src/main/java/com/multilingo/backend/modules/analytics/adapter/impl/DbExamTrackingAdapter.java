package com.multilingo.backend.modules.analytics.adapter.impl;

import com.multilingo.backend.modules.analytics.adapter.ExamTrackingAdapter;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class DbExamTrackingAdapter implements ExamTrackingAdapter {

    private final TestAttemptRepository testAttemptRepository;

    @Override
    @Transactional(readOnly = true)
    public long countAttemptsByUserId(Integer userId) {
        return testAttemptRepository != null ? testAttemptRepository.countByUserId(userId) : 0L;
    }

    @Override
    @Transactional(readOnly = true)
    public Double findAverageScoreByUserId(Integer userId) {
        return testAttemptRepository != null ? testAttemptRepository.findAverageScoreByUserId(userId) : null;
    }

    @Override
    @Transactional(readOnly = true)
    public long countTotalAttempts() {
        return testAttemptRepository != null ? testAttemptRepository.countTotalValidAttempts() : 0L;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Long> countAttemptsByStatus() {
        if (testAttemptRepository == null) {
            return Collections.emptyMap();
        }
        List<Object[]> rows = testAttemptRepository.countAttemptsGroupedByStatus();
        Map<String, Long> result = new LinkedHashMap<>();
        for (Object[] row : rows) {
            if (row != null && row.length >= 2 && row[0] != null) {
                String status = row[0].toString();
                Long count = ((Number) row[1]).longValue();
                result.put(status, count);
            }
        }
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public long countAttemptsByExamId(Integer examId) {
        return testAttemptRepository != null ? testAttemptRepository.countByExamId(examId) : 0L;
    }

    @Override
    @Transactional(readOnly = true)
    public long countCompletedAttemptsByExamId(Integer examId) {
        return testAttemptRepository != null ? testAttemptRepository.countCompletedByExamId(examId) : 0L;
    }

    @Override
    @Transactional(readOnly = true)
    public Double findAverageScoreByExamId(Integer examId) {
        return testAttemptRepository != null ? testAttemptRepository.findAverageScoreByExamId(examId) : null;
    }
}
