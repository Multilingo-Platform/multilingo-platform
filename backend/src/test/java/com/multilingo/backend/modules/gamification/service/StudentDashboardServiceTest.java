package com.multilingo.backend.modules.gamification.service;

import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.repository.UserRepository;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.gamification.constant.TimeRange;
import com.multilingo.backend.modules.gamification.dto.dashboard.StudentDashboardResponse;
import com.multilingo.backend.modules.gamification.entity.DailyStudyLog;
import com.multilingo.backend.modules.gamification.entity.UserStudyStat;
import com.multilingo.backend.modules.gamification.repository.DailyStudyLogRepository;
import com.multilingo.backend.modules.gamification.repository.UserStudyStatRepository;
import com.multilingo.backend.modules.gamification.service.impl.StudentDashboardServiceImpl;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.vocab.dto.response.UserVocabStatsProjection;
import com.multilingo.backend.modules.vocab.repository.UserFlashcardRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudentDashboardServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserStudyStatRepository userStudyStatRepository;

    @Mock
    private DailyStudyLogRepository dailyStudyLogRepository;

    @Mock
    private TestAttemptRepository testAttemptRepository;

    @Mock
    private UserFlashcardRepository userFlashcardRepository;

    @Mock
    private ExamRepository examRepository;

    @InjectMocks
    private StudentDashboardServiceImpl studentDashboardService;

    private User mockUser;

    @BeforeEach
    void setUp() {
        mockUser = User.builder()
                .fullName("Nguyễn Hữu Giáp")
                .avatarUrl("https://example.com/avatar.png")
                .targetLanguage("en")
                .build();
        mockUser.setId(1);
    }

    @Test
    @DisplayName("TC_DASHBOARD_GET_01: Active user returns isNewUser=false and full statistics")
    void getStudentDashboard_ActiveUser_Success() {
        // Given
        when(userRepository.findById(1)).thenReturn(Optional.of(mockUser));

        UserStudyStat studyStat = UserStudyStat.builder()
                .userId(1)
                .currentStreak(5)
                .highestStreak(10)
                .totalLearningMinutes(240)
                .totalXp(500L)
                .lastStudyDate(LocalDate.now())
                .build();
        when(userStudyStatRepository.findByUserId(1)).thenReturn(Optional.of(studyStat));

        when(testAttemptRepository.countByUserIdAndStatus(1, AttemptStatus.COMPLETED)).thenReturn(3L);
        when(testAttemptRepository.findAverageScoreByUserId(1)).thenReturn(7.5);

        TestAttempt latestAttempt = TestAttempt.builder()
                .userId(1)
                .examId(101)
                .overallScore(BigDecimal.valueOf(8.0))
                .endTime(Instant.now())
                .status(AttemptStatus.COMPLETED)
                .build();
        when(testAttemptRepository.findFirstByUserIdAndStatusOrderByEndTimeDesc(1, AttemptStatus.COMPLETED))
                .thenReturn(Optional.of(latestAttempt));

        Exam mockExam = Exam.builder().title("IELTS Practice Test 1").build();
        mockExam.setId(101);
        when(examRepository.findById(101)).thenReturn(Optional.of(mockExam));

        UserVocabStatsProjection vocabProjection = mock(UserVocabStatsProjection.class);
        when(vocabProjection.getTotalCards()).thenReturn(50L);
        when(vocabProjection.getMasteredCards()).thenReturn(30L);
        when(vocabProjection.getLearningCards()).thenReturn(20L);
        when(vocabProjection.getDueReviewCards()).thenReturn(5L);
        when(userFlashcardRepository.getUserVocabStats(eq(1), any(Instant.class))).thenReturn(vocabProjection);

        DailyStudyLog logToday = DailyStudyLog.builder()
                .userId(1)
                .studyDate(LocalDate.now())
                .learningMinutes(45)
                .flashcardsReviewed(20)
                .practiceQuestionsAnswered(15)
                .practiceXpEarned(40)
                .build();
        when(dailyStudyLogRepository.findAllByUserIdAndStudyDateBetween(eq(1), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(logToday));

        // When
        StudentDashboardResponse response = studentDashboardService.getStudentDashboard(1, "THIS_WEEK", 2026);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getIsNewUser()).isFalse();
        assertThat(response.getUserProfile().getFullName()).isEqualTo("Nguyễn Hữu Giáp");
        assertThat(response.getStreak().getCurrentStreak()).isEqualTo(5);
        assertThat(response.getStreak().getIsStudiedToday()).isTrue();
        assertThat(response.getExamStats().getTotalExamsTaken()).isEqualTo(3L);
        assertThat(response.getExamStats().getAverageScore()).isEqualTo(7.5);
        assertThat(response.getExamStats().getLatestExamTitle()).isEqualTo("IELTS Practice Test 1");
        assertThat(response.getVocabStats().getTotalWords()).isEqualTo(50L);
        assertThat(response.getVocabStats().getMasteryRate()).isEqualTo(60.0);
        assertThat(response.getVocabStats().getDueTodayCount()).isEqualTo(5L);
        assertThat(response.getActivityHeatmap()).isNotNull();
        assertThat(response.getProgressChart()).isNotNull();
        assertThat(response.getSuggestedActions()).hasSize(2);
    }

    @Test
    @DisplayName("TC_DASHBOARD_GET_02: New user cold start returns isNewUser=true, streak=1 and placement test action")
    void getStudentDashboard_NewUser_ColdStart() {
        // Given
        when(userRepository.findById(1)).thenReturn(Optional.of(mockUser));
        when(userStudyStatRepository.findByUserId(1)).thenReturn(Optional.empty());

        when(testAttemptRepository.countByUserIdAndStatus(1, AttemptStatus.COMPLETED)).thenReturn(0L);

        UserVocabStatsProjection vocabProjection = mock(UserVocabStatsProjection.class);
        when(vocabProjection.getTotalCards()).thenReturn(0L);
        when(vocabProjection.getMasteredCards()).thenReturn(0L);
        when(vocabProjection.getLearningCards()).thenReturn(0L);
        when(vocabProjection.getDueReviewCards()).thenReturn(0L);
        when(userFlashcardRepository.getUserVocabStats(eq(1), any(Instant.class))).thenReturn(vocabProjection);

        when(dailyStudyLogRepository.findAllByUserIdAndStudyDateBetween(eq(1), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(Collections.emptyList());

        // When
        StudentDashboardResponse response = studentDashboardService.getStudentDashboard(1, "THIS_WEEK", 2026);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getIsNewUser()).isTrue();
        assertThat(response.getStreak().getCurrentStreak()).isEqualTo(1); // Day 1 streak
        assertThat(response.getExamStats().getTotalExamsTaken()).isEqualTo(0L);
        assertThat(response.getExamStats().getAverageScore()).isEqualTo(0.0);
        assertThat(response.getVocabStats().getTotalWords()).isEqualTo(0L);
        assertThat(response.getVocabStats().getMasteryRate()).isEqualTo(0.0);
        assertThat(response.getSuggestedActions()).hasSize(2);
        assertThat(response.getSuggestedActions().get(0).getType()).isEqualTo("VOCAB_REVIEW");
        assertThat(response.getSuggestedActions().get(1).getType()).isEqualTo("EXAM_PRACTICE");
    }

    @Test
    @DisplayName("TC_DASHBOARD_CALC_01: Avoid divide by zero when totalWords=0")
    void getStudentDashboard_AvoidDivisionByZero() {
        // Given
        when(userRepository.findById(1)).thenReturn(Optional.of(mockUser));
        when(userStudyStatRepository.findByUserId(1)).thenReturn(Optional.of(
                UserStudyStat.builder().userId(1).currentStreak(2).highestStreak(2).totalLearningMinutes(10).totalXp(10L).build()
        ));

        when(testAttemptRepository.countByUserIdAndStatus(1, AttemptStatus.COMPLETED)).thenReturn(1L);
        when(testAttemptRepository.findAverageScoreByUserId(1)).thenReturn(6.0);
        when(testAttemptRepository.findFirstByUserIdAndStatusOrderByEndTimeDesc(1, AttemptStatus.COMPLETED))
                .thenReturn(Optional.empty());

        UserVocabStatsProjection vocabProjection = mock(UserVocabStatsProjection.class);
        when(vocabProjection.getTotalCards()).thenReturn(0L);
        when(vocabProjection.getMasteredCards()).thenReturn(0L);
        when(vocabProjection.getLearningCards()).thenReturn(0L);
        when(vocabProjection.getDueReviewCards()).thenReturn(0L);
        when(userFlashcardRepository.getUserVocabStats(eq(1), any(Instant.class))).thenReturn(vocabProjection);

        when(dailyStudyLogRepository.findAllByUserIdAndStudyDateBetween(eq(1), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(Collections.emptyList());

        // When
        StudentDashboardResponse response = studentDashboardService.getStudentDashboard(1, "THIS_WEEK", 2026);

        // Then
        assertThat(response.getVocabStats().getMasteryRate()).isEqualTo(0.0);
    }

    @Test
    @DisplayName("TC_DASHBOARD_STREAK_02: Streak at risk when lastStudyDate is yesterday (isStudiedToday=false)")
    void getStudentDashboard_StreakAtRisk() {
        // Given
        when(userRepository.findById(1)).thenReturn(Optional.of(mockUser));
        UserStudyStat studyStat = UserStudyStat.builder()
                .userId(1)
                .currentStreak(4)
                .highestStreak(7)
                .totalLearningMinutes(120)
                .totalXp(300L)
                .lastStudyDate(LocalDate.now().minusDays(1))
                .build();
        when(userStudyStatRepository.findByUserId(1)).thenReturn(Optional.of(studyStat));

        when(testAttemptRepository.countByUserIdAndStatus(1, AttemptStatus.COMPLETED)).thenReturn(1L);
        when(testAttemptRepository.findAverageScoreByUserId(1)).thenReturn(8.0);
        when(testAttemptRepository.findFirstByUserIdAndStatusOrderByEndTimeDesc(1, AttemptStatus.COMPLETED))
                .thenReturn(Optional.empty());

        UserVocabStatsProjection vocabProjection = mock(UserVocabStatsProjection.class);
        when(vocabProjection.getTotalCards()).thenReturn(10L);
        when(vocabProjection.getMasteredCards()).thenReturn(5L);
        when(vocabProjection.getLearningCards()).thenReturn(5L);
        when(vocabProjection.getDueReviewCards()).thenReturn(0L);
        when(userFlashcardRepository.getUserVocabStats(eq(1), any(Instant.class))).thenReturn(vocabProjection);

        when(dailyStudyLogRepository.findAllByUserIdAndStudyDateBetween(eq(1), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(Collections.emptyList());

        // When
        StudentDashboardResponse response = studentDashboardService.getStudentDashboard(1, "THIS_WEEK", 2026);

        // Then
        assertThat(response.getStreak().getCurrentStreak()).isEqualTo(4);
        assertThat(response.getStreak().getIsStudiedToday()).isFalse();
    }

    @Test
    @DisplayName("TC_DASHBOARD_HEAT_02: Verify correct mapping of 5 Heatmap levels")
    void calculateHeatmapLevels_Accurate() {
        // Given
        when(userRepository.findById(1)).thenReturn(Optional.of(mockUser));
        when(userStudyStatRepository.findByUserId(1)).thenReturn(Optional.of(
                UserStudyStat.builder().userId(1).currentStreak(1).highestStreak(1).totalLearningMinutes(165).totalXp(100L).build()
        ));
        when(testAttemptRepository.countByUserIdAndStatus(1, AttemptStatus.COMPLETED)).thenReturn(1L);
        when(testAttemptRepository.findAverageScoreByUserId(1)).thenReturn(7.0);
        when(testAttemptRepository.findFirstByUserIdAndStatusOrderByEndTimeDesc(1, AttemptStatus.COMPLETED)).thenReturn(Optional.empty());

        UserVocabStatsProjection vocabProjection = mock(UserVocabStatsProjection.class);
        when(vocabProjection.getTotalCards()).thenReturn(1L);
        when(vocabProjection.getMasteredCards()).thenReturn(1L);
        when(vocabProjection.getLearningCards()).thenReturn(0L);
        when(vocabProjection.getDueReviewCards()).thenReturn(0L);
        when(userFlashcardRepository.getUserVocabStats(eq(1), any(Instant.class))).thenReturn(vocabProjection);

        LocalDate yearStart = LocalDate.of(2026, 1, 1);
        List<DailyStudyLog> logs = List.of(
                DailyStudyLog.builder().userId(1).studyDate(yearStart).learningMinutes(0).build(),
                DailyStudyLog.builder().userId(1).studyDate(yearStart.plusDays(1)).learningMinutes(15).build(),
                DailyStudyLog.builder().userId(1).studyDate(yearStart.plusDays(2)).learningMinutes(30).build(),
                DailyStudyLog.builder().userId(1).studyDate(yearStart.plusDays(3)).learningMinutes(60).build(),
                DailyStudyLog.builder().userId(1).studyDate(yearStart.plusDays(4)).learningMinutes(90).build()
        );
        when(dailyStudyLogRepository.findAllByUserIdAndStudyDateBetween(eq(1), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(logs);

        // When
        StudentDashboardResponse response = studentDashboardService.getStudentDashboard(1, "THIS_WEEK", 2026);

        // Then
        var points = response.getActivityHeatmap().getDataPoints();
        assertThat(points).hasSize(5);
        assertThat(points.get(0).getLevel()).isEqualTo(0);
        assertThat(points.get(1).getLevel()).isEqualTo(1);
        assertThat(points.get(2).getLevel()).isEqualTo(2);
        assertThat(points.get(3).getLevel()).isEqualTo(3);
        assertThat(points.get(4).getLevel()).isEqualTo(4);
    }

    @Test
    @DisplayName("TC_DASHBOARD_PROGRESS_01: THIS_MONTH aggregates into 4 weeks")
    void getStudentDashboard_ThisMonth_Aggregates4Weeks() {
        // Given
        when(userRepository.findById(1)).thenReturn(Optional.of(mockUser));
        when(userStudyStatRepository.findByUserId(1)).thenReturn(Optional.of(
                UserStudyStat.builder().userId(1).currentStreak(1).highestStreak(1).totalLearningMinutes(60).totalXp(50L).build()
        ));
        when(testAttemptRepository.countByUserIdAndStatus(1, AttemptStatus.COMPLETED)).thenReturn(0L);
        when(testAttemptRepository.findAverageScoreByUserId(1)).thenReturn(0.0);

        UserVocabStatsProjection vocabProjection = mock(UserVocabStatsProjection.class);
        when(userFlashcardRepository.getUserVocabStats(eq(1), any(Instant.class))).thenReturn(vocabProjection);

        LocalDate today = LocalDate.now();
        DailyStudyLog logW1 = DailyStudyLog.builder().userId(1).studyDate(today.withDayOfMonth(3)).learningMinutes(30).practiceQuestionsAnswered(5).build();
        DailyStudyLog logW2 = DailyStudyLog.builder().userId(1).studyDate(today.withDayOfMonth(10)).learningMinutes(45).practiceQuestionsAnswered(10).build();

        when(dailyStudyLogRepository.findAllByUserIdAndStudyDateBetween(eq(1), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(logW1, logW2));

        // When
        StudentDashboardResponse response = studentDashboardService.getStudentDashboard(1, "THIS_MONTH", today.getYear());

        // Then
        var chartPoints = response.getProgressChart().getDataPoints();
        assertThat(chartPoints).hasSize(4);
        assertThat(chartPoints.get(0).getLabel()).isEqualTo("Tuần 1");
        assertThat(chartPoints.get(0).getLearningMinutes()).isEqualTo(30);
        assertThat(chartPoints.get(1).getLabel()).isEqualTo("Tuần 2");
        assertThat(chartPoints.get(1).getLearningMinutes()).isEqualTo(45);
        assertThat(chartPoints.get(2).getLabel()).isEqualTo("Tuần 3");
        assertThat(chartPoints.get(2).getLearningMinutes()).isEqualTo(0);
        assertThat(chartPoints.get(3).getLabel()).isEqualTo("Tuần 4");
        assertThat(chartPoints.get(3).getLearningMinutes()).isEqualTo(0);
    }

    @Test
    @DisplayName("TC_DASHBOARD_PROGRESS_02: ALL aggregates into 12 months")
    void getStudentDashboard_All_Aggregates12Months() {
        // Given
        when(userRepository.findById(1)).thenReturn(Optional.of(mockUser));
        when(userStudyStatRepository.findByUserId(1)).thenReturn(Optional.of(
                UserStudyStat.builder().userId(1).currentStreak(1).highestStreak(1).totalLearningMinutes(120).totalXp(100L).build()
        ));
        when(testAttemptRepository.countByUserIdAndStatus(1, AttemptStatus.COMPLETED)).thenReturn(0L);
        when(testAttemptRepository.findAverageScoreByUserId(1)).thenReturn(0.0);

        UserVocabStatsProjection vocabProjection = mock(UserVocabStatsProjection.class);
        when(userFlashcardRepository.getUserVocabStats(eq(1), any(Instant.class))).thenReturn(vocabProjection);

        DailyStudyLog logJan = DailyStudyLog.builder().userId(1).studyDate(LocalDate.of(2026, 1, 15)).learningMinutes(50).practiceQuestionsAnswered(12).build();
        DailyStudyLog logOct = DailyStudyLog.builder().userId(1).studyDate(LocalDate.of(2026, 10, 5)).learningMinutes(90).practiceQuestionsAnswered(25).build();

        when(dailyStudyLogRepository.findAllByUserIdAndStudyDateBetween(eq(1), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(logJan, logOct));

        // When
        StudentDashboardResponse response = studentDashboardService.getStudentDashboard(1, "ALL", 2026);

        // Then
        var chartPoints = response.getProgressChart().getDataPoints();
        assertThat(chartPoints).hasSize(12);
        assertThat(chartPoints.get(0).getLabel()).isEqualTo("Th1");
        assertThat(chartPoints.get(0).getLearningMinutes()).isEqualTo(50);
        assertThat(chartPoints.get(9).getLabel()).isEqualTo("Th10");
        assertThat(chartPoints.get(9).getLearningMinutes()).isEqualTo(90);
        assertThat(chartPoints.get(1).getLabel()).isEqualTo("Th2");
        assertThat(chartPoints.get(1).getLearningMinutes()).isEqualTo(0);
    }
}
