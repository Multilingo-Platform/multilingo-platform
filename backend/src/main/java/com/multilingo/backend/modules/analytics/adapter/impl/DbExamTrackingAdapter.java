package com.multilingo.backend.modules.analytics.adapter.impl;

import com.multilingo.backend.modules.analytics.adapter.ExamTrackingAdapter;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

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
        return testAttemptRepository != null ? testAttemptRepository.count() : 0L;
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
