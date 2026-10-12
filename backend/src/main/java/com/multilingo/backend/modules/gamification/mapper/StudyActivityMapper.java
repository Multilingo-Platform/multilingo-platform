package com.multilingo.backend.modules.gamification.mapper;

import com.multilingo.backend.modules.gamification.dto.StudyActivitySummary;
import com.multilingo.backend.modules.gamification.entity.DailyStudyLog;
import com.multilingo.backend.modules.gamification.entity.UserStudyStat;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.NullValuePropertyMappingStrategy;

/**
 * MapStruct Mapper cho phân hệ Gamification (thống kê học tập và streak).
 */
@Mapper(componentModel = "spring", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
public interface StudyActivityMapper {

    /**
     * Ghép nối thực thể UserStudyStat và DailyStudyLog thành StudyActivitySummary DTO.
     */
    @Mapping(target = "currentStreak", source = "studyStat.currentStreak")
    @Mapping(target = "highestStreak", source = "studyStat.highestStreak")
    @Mapping(target = "totalLearningMinutes", source = "studyStat.totalLearningMinutes")
    @Mapping(target = "dailyLearningMinutes", source = "dailyLog.learningMinutes")
    @Mapping(target = "dailyFlashcardsReviewed", source = "dailyLog.flashcardsReviewed")
    @Mapping(target = "streakIncrement", source = "streakIncrement")
    @Mapping(target = "streakExtended", source = "streakExtended")
    StudyActivitySummary toSummary(
            UserStudyStat studyStat,
            DailyStudyLog dailyLog,
            int streakIncrement,
            boolean streakExtended
    );
}
