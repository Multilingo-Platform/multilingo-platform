package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.testing.dto.response.StudentHistoryItemResponse;
import com.multilingo.backend.modules.testing.dto.response.StudentHistoryStatsResponse;

public interface StudentHistoryService {
    default StudentHistoryStatsResponse getStudentStats(Integer userId) {
        return getStudentStats(userId, null, null);
    }

    StudentHistoryStatsResponse getStudentStats(Integer userId, String cert, String targetLanguage);

    default PageResponse<StudentHistoryItemResponse> getStudentHistory(
            Integer userId,
            String search,
            String cert,
            String mode,
            String status,
            int page,
            int size,
            String sort
    ) {
        return getStudentHistory(userId, search, cert, mode, status, null, page, size, sort);
    }

    PageResponse<StudentHistoryItemResponse> getStudentHistory(
            Integer userId,
            String search,
            String cert,
            String mode,
            String status,
            String targetLanguage,
            int page,
            int size,
            String sort
    );
}
