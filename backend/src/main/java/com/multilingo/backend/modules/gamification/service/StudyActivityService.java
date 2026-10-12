package com.multilingo.backend.modules.gamification.service;

import com.multilingo.backend.modules.gamification.dto.StudyActivityRecord;
import com.multilingo.backend.modules.gamification.dto.StudyActivitySummary;

public interface StudyActivityService {

    /**
     * Ghi nhận hoạt động học tập (SRS Flashcard, Quiz Practice, Reading, v.v.),
     * cập nhật an toàn chuỗi ngày học Streak (với Pessimistic Lock) và DailyStudyLog.
     *
     * @param record Thông tin hoạt động cần ghi nhận
     * @return StudyActivitySummary Thống kê chuỗi Streak và thời gian học mới nhất
     */
    StudyActivitySummary recordActivity(StudyActivityRecord record);
}
