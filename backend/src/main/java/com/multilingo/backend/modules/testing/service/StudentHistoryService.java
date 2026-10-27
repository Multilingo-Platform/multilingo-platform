package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.testing.dto.response.StudentHistoryItemResponse;
import com.multilingo.backend.modules.testing.dto.response.StudentHistoryStatsResponse;

public interface StudentHistoryService {
    StudentHistoryStatsResponse getStudentStats(Integer userId);

    PageResponse<StudentHistoryItemResponse> getStudentHistory(
            Integer userId,
            String search,
            String cert,
            String mode,
            String status,
            int page,
            int size,
            String sort
    );
}
