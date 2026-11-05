package com.multilingo.backend.modules.analytics.adapter;

import java.util.Map;

public interface ExamTrackingAdapter {

    long countAttemptsByUserId(Integer userId);

    Double findAverageScoreByUserId(Integer userId);

    long countTotalAttempts();

    Map<String, Long> countAttemptsByStatus();

    long countAttemptsByExamId(Integer examId);

    long countCompletedAttemptsByExamId(Integer examId);

    Double findAverageScoreByExamId(Integer examId);
}
