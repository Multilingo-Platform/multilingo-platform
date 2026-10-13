package com.multilingo.backend.modules.analytics.adapter;

import com.multilingo.backend.modules.analytics.adapter.dto.ExamSummaryInfo;

import java.util.List;

public interface ExamCatalogAdapter {

    List<ExamSummaryInfo> findAllExams();
}
