package com.multilingo.backend.modules.gamification.service;

import com.multilingo.backend.modules.gamification.dto.dashboard.StudentDashboardResponse;

public interface StudentDashboardService {

    /**
     * Lấy dữ liệu tổng hợp cho Bảng điều khiển học viên (UC13).
     *
     * @param userId       ID học viên
     * @param timeRangeStr Mốc thời gian (THIS_WEEK, THIS_MONTH, ALL)
     * @param year         Năm cần lấy dữ liệu Heatmap (mặc định năm hiện tại)
     * @return StudentDashboardResponse DTO tổng hợp
     */
    StudentDashboardResponse getStudentDashboard(Integer userId, String timeRangeStr, Integer year);
}
