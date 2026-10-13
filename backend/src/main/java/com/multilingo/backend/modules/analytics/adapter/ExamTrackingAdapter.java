package com.multilingo.backend.modules.analytics.adapter;

public interface ExamTrackingAdapter {

    long countAttemptsByUserId(Integer userId);

    Double findAverageScoreByUserId(Integer userId);

    long countTotalAttempts();

    long countAttemptsByExamId(Integer examId);

    long countCompletedAttemptsByExamId(Integer examId);

    Double findAverageScoreByExamId(Integer examId);
}
