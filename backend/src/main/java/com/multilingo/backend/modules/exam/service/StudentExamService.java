package com.multilingo.backend.modules.exam.service;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.exam.dto.response.StudentExamSummaryResponse;

import java.util.List;

public interface StudentExamService {
    PageResponse<StudentExamSummaryResponse> searchExams(String title, List<String> types, int page, int size, String sortParam);
}
