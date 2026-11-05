package com.multilingo.backend.modules.analytics.adapter;

import com.multilingo.backend.modules.testing.entity.TestAttempt;

import java.util.List;
import java.util.Map;

public interface ExamTrackingAdapter {

    long countAttemptsByUserId(Integer userId);

    Double findAverageScoreByUserId(Integer userId);

    long countTotalAttempts();

    Map<String, Long> countAttemptsByStatus();

    long countAttemptsByExamId(Integer examId);

    long countCompletedAttemptsByExamId(Integer examId);

    Double findAverageScoreByExamId(Integer examId);

    List<Object[]> findValidAttemptsWithExamByUserId(Integer userId);

    List<TestAttempt> findAttemptsByExamId(Integer examId);
}
