package com.multilingo.backend.modules.gamification.service;

import com.multilingo.backend.modules.gamification.dto.StudyActivityRecord;
import com.multilingo.backend.modules.gamification.dto.StudyActivitySummary;
import com.multilingo.backend.modules.gamification.entity.DailyStudyLog;
import com.multilingo.backend.modules.gamification.entity.UserStudyStat;
import com.multilingo.backend.modules.gamification.repository.DailyStudyLogRepository;
import com.multilingo.backend.modules.gamification.repository.UserStudyStatRepository;
import com.multilingo.backend.modules.gamification.service.impl.StudyActivityServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("StudyActivityService Unit Tests - Task 5")
class StudyActivityServiceTest {

    @Mock
    private UserStudyStatRepository userStudyStatRepository;

    @Mock
    private DailyStudyLogRepository dailyStudyLogRepository;

    @org.mockito.Spy
    private com.multilingo.backend.modules.gamification.mapper.StudyActivityMapper studyActivityMapper =
            org.mapstruct.factory.Mappers.getMapper(com.multilingo.backend.modules.gamification.mapper.StudyActivityMapper.class);

    @InjectMocks
    private StudyActivityServiceImpl studyActivityService;

    private LocalDate today;

    @BeforeEach
    void setUp() {
        today = LocalDate.now();
        when(userStudyStatRepository.save(any(UserStudyStat.class))).thenAnswer(i -> i.getArgument(0));
        when(dailyStudyLogRepository.save(any(DailyStudyLog.class))).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    @DisplayName("TC_STREAK_01: Ngày đầu tiên học -> streak khởi tạo bằng 1")
    void recordActivity_firstDay_startsStreakAtOne() {
        when(userStudyStatRepository.findByUserIdWithLock(1)).thenReturn(Optional.empty());
        when(dailyStudyLogRepository.findByUserIdAndStudyDate(1, today)).thenReturn(Optional.empty());

        StudyActivityRecord record = StudyActivityRecord.builder()
                .userId(1)
                .studyMinutes(5)
                .cardsReviewed(10)
                .activityType("QUIZ_PRACTICE")
                .build();

        StudyActivitySummary summary = studyActivityService.recordActivity(record);

        assertThat(summary.getCurrentStreak()).isEqualTo(1);
        assertThat(summary.getStreakIncrement()).isEqualTo(1);
        assertThat(summary.isStreakExtended()).isTrue();
        assertThat(summary.getDailyLearningMinutes()).isEqualTo(5);
        assertThat(summary.getDailyFlashcardsReviewed()).isEqualTo(10);
    }

    @Test
    @DisplayName("TC_STREAK_02: Học ngày liên tiếp (hôm qua đã học) -> streak tăng 1")
    void recordActivity_consecutiveDay_incrementsStreak() {
        UserStudyStat stat = UserStudyStat.builder()
                .userId(1)
                .currentStreak(3)
                .highestStreak(3)
                .lastStudyDate(today.minusDays(1))
                .totalLearningMinutes(30)
                .build();

        when(userStudyStatRepository.findByUserIdWithLock(1)).thenReturn(Optional.of(stat));
        when(dailyStudyLogRepository.findByUserIdAndStudyDate(1, today)).thenReturn(Optional.empty());

        StudyActivityRecord record = StudyActivityRecord.builder()
                .userId(1)
                .studyMinutes(10)
                .cardsReviewed(15)
                .activityType("QUIZ_PRACTICE")
                .build();

        StudyActivitySummary summary = studyActivityService.recordActivity(record);

        assertThat(summary.getCurrentStreak()).isEqualTo(4);
        assertThat(summary.getHighestStreak()).isEqualTo(4);
        assertThat(summary.getStreakIncrement()).isEqualTo(1);
        assertThat(summary.isStreakExtended()).isTrue();
    }

    @Test
    @DisplayName("TC_STREAK_03: Đã học hôm nay rồi -> giữ nguyên streak, streakIncrement = 0")
    void recordActivity_sameDay_keepsStreak() {
        UserStudyStat stat = UserStudyStat.builder()
                .userId(1)
                .currentStreak(4)
                .highestStreak(5)
                .lastStudyDate(today)
                .totalLearningMinutes(40)
                .build();

        DailyStudyLog existingLog = DailyStudyLog.builder()
                .userId(1)
                .studyDate(today)
                .learningMinutes(10)
                .flashcardsReviewed(20)
                .build();

        when(userStudyStatRepository.findByUserIdWithLock(1)).thenReturn(Optional.of(stat));
        when(dailyStudyLogRepository.findByUserIdAndStudyDate(1, today)).thenReturn(Optional.of(existingLog));

        StudyActivityRecord record = StudyActivityRecord.builder()
                .userId(1)
                .studyMinutes(5)
                .cardsReviewed(10)
                .activityType("QUIZ_PRACTICE")
                .build();

        StudyActivitySummary summary = studyActivityService.recordActivity(record);

        assertThat(summary.getCurrentStreak()).isEqualTo(4);
        assertThat(summary.getStreakIncrement()).isEqualTo(0);
        assertThat(summary.isStreakExtended()).isFalse();
        assertThat(summary.getDailyLearningMinutes()).isEqualTo(15);
        assertThat(summary.getDailyFlashcardsReviewed()).isEqualTo(30);
    }

    @Test
    @DisplayName("TC_STREAK_04: Bị gián đoạn học tập (>1 ngày) -> reset streak về 1")
    void recordActivity_brokenStreak_resetsToOne() {
        UserStudyStat stat = UserStudyStat.builder()
                .userId(1)
                .currentStreak(10)
                .highestStreak(10)
                .lastStudyDate(today.minusDays(3))
                .totalLearningMinutes(100)
                .build();

        when(userStudyStatRepository.findByUserIdWithLock(1)).thenReturn(Optional.of(stat));
        when(dailyStudyLogRepository.findByUserIdAndStudyDate(1, today)).thenReturn(Optional.empty());

        StudyActivityRecord record = StudyActivityRecord.builder()
                .userId(1)
                .studyMinutes(5)
                .cardsReviewed(5)
                .activityType("QUIZ_PRACTICE")
                .build();

        StudyActivitySummary summary = studyActivityService.recordActivity(record);

        assertThat(summary.getCurrentStreak()).isEqualTo(1);
        assertThat(summary.getHighestStreak()).isEqualTo(10); // Kỷ lục cao nhất giữ nguyên
        assertThat(summary.getStreakIncrement()).isEqualTo(1);
        assertThat(summary.isStreakExtended()).isTrue();
    }
}
