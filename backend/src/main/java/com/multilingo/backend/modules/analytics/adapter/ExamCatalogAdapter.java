package com.multilingo.backend.modules.analytics.adapter;

import com.multilingo.backend.modules.analytics.adapter.dto.ExamSummaryInfo;

import java.util.List;
import java.util.Optional;

public interface ExamCatalogAdapter {

    List<ExamSummaryInfo> findAllExams();

    Optional<ExamSummaryInfo> findExamById(Integer examId);
}
