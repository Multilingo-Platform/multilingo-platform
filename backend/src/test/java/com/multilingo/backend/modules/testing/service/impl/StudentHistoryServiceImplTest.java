package com.multilingo.backend.modules.testing.service.impl;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.auth.entity.UserTarget;
import com.multilingo.backend.modules.auth.repository.UserTargetRepository;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.gamification.entity.UserStudyStat;
import com.multilingo.backend.modules.gamification.repository.UserStudyStatRepository;
import com.multilingo.backend.modules.testing.dto.response.StudentHistoryItemResponse;
import com.multilingo.backend.modules.testing.dto.response.StudentHistoryStatsResponse;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudentHistoryServiceImplTest {

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({"IELTS_ACADEMIC,RAW_OBJECTIVE", "IELTS_ACADEMIC,LEGACY_RAW", "TOEIC_LR,RAW_OBJECTIVE", "TOEIC_LR,LEGACY_RAW"})
    void raw_only_history_does_not_fail_or_invent_certificate_scores(String type, String unit) {
        when(testAttemptRepository.findAverageScoresGroupedByType(eq(userId), any(), anyBoolean()))
                .thenReturn(List.<Object[]>of(new Object[]{type, "LEGACY_RAW".equals(unit) ? null : unit, 30.0, 35.0}));
        var attempt = TestAttempt.builder().userId(userId).examId(101).overallScore(BigDecimal.valueOf(30))
                .scoreUnit("LEGACY_RAW".equals(unit) ? null : unit).build();
        attempt.setId(501);
        var exam = new Exam(); exam.setId(101); exam.setType(type);
        when(testAttemptRepository.findRecentAttemptsWithExam(eq(userId), eq(AttemptStatus.COMPLETED),
                any(), anyBoolean(), any(), anyBoolean(), any()))
                .thenReturn(List.<Object[]>of(new Object[]{attempt, exam}));
        when(testAttemptRepository.countByUserIdAndLanguageAndCert(eq(userId), any(), anyBoolean(), any(), anyBoolean()))
                .thenReturn(1L);
        when(testAttemptRepository.sumTimeSpentSecondsByUserIdAndLanguageAndCert(eq(userId), any(), anyBoolean(), any(), anyBoolean()))
                .thenReturn(600L);
        var stats = studentHistoryService.getStudentStats(userId, null, null);
        assertThat(stats.getAverageScore()).isNull();
        assertThat(stats.getHighestScore()).isNull();
        assertThat(stats.getAverageScoresByType()).isEmpty();
        assertThat(stats.getTotalAttempts()).isEqualTo(1);
        assertThat(stats.getTotalPracticeMinutes()).isEqualTo(10);
        assertThat(stats.getRecentScoreTrends()).hasSize(1);
        assertThat(stats.getRecentScoreTrends().get(0).getScore()).isEqualTo(30);
        assertThat(stats.getRecentScoreTrends().get(0).getPercentage()).isNull();
    }

    @Test
    void empty_history_has_no_certificate_scores() {
        var stats = studentHistoryService.getStudentStats(userId, null, null);
        assertThat(stats.getAverageScoresByType()).isEmpty();
        assertThat(stats.getAverageScore()).isNull();
        assertThat(stats.getHighestScore()).isNull();
        assertThat(stats.getRecentScoreTrends()).isEmpty();
    }

    @Test
    void mixed_history_aggregates_only_matching_certificate_units() {
        when(testAttemptRepository.findAverageScoresGroupedByType(eq(userId), any(), anyBoolean()))
                .thenReturn(List.<Object[]>of(
                        new Object[]{"IELTS_ACADEMIC", null, 39.0, 40.0},
                        new Object[]{"IELTS_ACADEMIC", "RAW_OBJECTIVE", 35.0, 38.0},
                        new Object[]{"IELTS_ACADEMIC", "IELTS_BAND", 6.5, 7.0},
                        new Object[]{"TOEIC_LR", "RAW_OBJECTIVE", 99.0, 100.0},
                        new Object[]{"TOEIC_LR", "TOEIC_SCALED", 800.0, 900.0}));
        var stats = studentHistoryService.getStudentStats(userId, "IELTS", null);
        assertThat(stats.getAverageScoresByType()).containsEntry("IELTS", 6.5).containsEntry("TOEIC", 800.0);
        assertThat(stats.getAverageScore()).isEqualTo(6.5);
        assertThat(stats.getHighestScore()).isEqualTo(7.0);
    }

    @Mock
    private TestAttemptRepository testAttemptRepository;

    @Mock
    private ExamRepository examRepository;

    @Mock
    private UserStudyStatRepository userStudyStatRepository;

    @Mock
    private UserTargetRepository userTargetRepository;

    @InjectMocks
    private StudentHistoryServiceImpl studentHistoryService;

    private Integer userId;

    @BeforeEach
    void setUp() {
        userId = 1;
    }

    @Test
    @DisplayName("getStudentStats: Tính toán đúng các chỉ số tổng hợp, streak và danh sách trend điểm số")
    void getStudentStats_ComputesAverageScoreAndTrendCorrectly() {
        when(testAttemptRepository.countByUserIdAndLanguageAndCert(eq(userId), anyString(), anyBoolean(), anyString(), anyBoolean())).thenReturn(5L);
        when(testAttemptRepository.countByUserIdAndStatusAndLanguageAndCert(eq(userId), eq(AttemptStatus.COMPLETED), anyString(), anyBoolean(), anyString(), anyBoolean())).thenReturn(3L);
        when(testAttemptRepository.countByUserIdAndStatusAndLanguageAndCert(eq(userId), eq(AttemptStatus.IN_PROGRESS), anyString(), anyBoolean(), anyString(), anyBoolean())).thenReturn(1L);
        when(testAttemptRepository.countByUserIdAndStatusAndLanguageAndCert(eq(userId), eq(AttemptStatus.GRADING_FAILED), anyString(), anyBoolean(), anyString(), anyBoolean())).thenReturn(1L);
        when(testAttemptRepository.sumTimeSpentSecondsByUserIdAndLanguageAndCert(eq(userId), anyString(), anyBoolean(), anyString(), anyBoolean())).thenReturn(7200L); // 120 minutes

        UserTarget target = new UserTarget();
        target.setTargetScore(BigDecimal.valueOf(7.0));
        target.setTargetLanguage("en");
        target.setTargetCertificate("IELTS");
        when(userTargetRepository.findFirstByUserId(userId)).thenReturn(Optional.of(target));

        UserStudyStat studyStat = new UserStudyStat();
        studyStat.setCurrentStreak(6);
        when(userStudyStatRepository.findByUserId(userId)).thenReturn(Optional.of(studyStat));

        TestAttempt attempt1 = TestAttempt.builder()
                .userId(userId)
                .examId(10)
                .overallScore(BigDecimal.valueOf(7.5))
                .scoreUnit("IELTS_BAND")
                .status(AttemptStatus.COMPLETED)
                .endTime(Instant.now())
                .build();
        attempt1.setId(101);

        Exam exam1 = new Exam();
        exam1.setId(10);
        exam1.setTitle("IELTS Academic Test 1");
        exam1.setType("IELTS_ACADEMIC");
        exam1.setExamLanguage("en");

        List<Object[]> recentRows = new ArrayList<>();
        recentRows.add(new Object[]{attempt1, exam1});
        when(testAttemptRepository.findRecentAttemptsWithExam(eq(userId), eq(AttemptStatus.COMPLETED), anyString(), anyBoolean(), anyString(), anyBoolean(), any(Pageable.class)))
                .thenReturn(recentRows);

        List<Object[]> avgRows = new ArrayList<>();
        avgRows.add(new Object[]{"IELTS_ACADEMIC", "IELTS_BAND", 7.2, 8.5});
        when(testAttemptRepository.findAverageScoresGroupedByType(eq(userId), anyString(), anyBoolean()))
                .thenReturn(avgRows);

        StudentHistoryStatsResponse response = studentHistoryService.getStudentStats(userId);

        assertThat(response).isNotNull();
        assertThat(response.getTotalAttempts()).isEqualTo(5L);
        assertThat(response.getCompletedAttempts()).isEqualTo(3L);
        assertThat(response.getInProgressAttempts()).isEqualTo(1L);
        assertThat(response.getFailedAttempts()).isEqualTo(1L);
        assertThat(response.getAverageScore()).isEqualTo(7.2);
        assertThat(response.getAverageScoresByType()).containsEntry("IELTS", 7.2);
        assertThat(response.getHighestScore()).isEqualTo(8.5);
        assertThat(response.getTotalPracticeMinutes()).isEqualTo(120L);
        assertThat(response.getCurrentStreak()).isEqualTo(6);
        assertThat(response.getTargetAchievedCount()).isEqualTo(1L);
        assertThat(response.getRecentScoreTrends()).hasSize(1);
        assertThat(response.getRecentScoreTrends().get(0).getCertType()).isEqualTo("IELTS");
        assertThat(response.getRecentScoreTrends().get(0).getMaxScore()).isEqualTo(9.0);
    }

    @Test
    @DisplayName("getStudentStats: Tính điểm trung bình riêng theo từng loại đề khi học viên làm nhiều loại đề")
    void getStudentStats_WithMultipleCertTypes_CalculatesAverageScoresByType() {
        when(testAttemptRepository.countByUserIdAndLanguageAndCert(eq(userId), anyString(), anyBoolean(), anyString(), anyBoolean())).thenReturn(4L);
        when(testAttemptRepository.countByUserIdAndStatusAndLanguageAndCert(eq(userId), any(), anyString(), anyBoolean(), anyString(), anyBoolean())).thenReturn(2L);
        UserTarget target = new UserTarget();
        target.setTargetLanguage("en");
        target.setTargetCertificate("IELTS");
        when(userTargetRepository.findFirstByUserId(userId)).thenReturn(Optional.of(target));
        when(userStudyStatRepository.findByUserId(userId)).thenReturn(Optional.empty());

        List<Object[]> avgRows = new ArrayList<>();
        avgRows.add(new Object[]{"IELTS_ACADEMIC", "IELTS_BAND", 7.5, 8.0});
        avgRows.add(new Object[]{"TOEIC_LR", "TOEIC_SCALED", 750.0, 850.0});
        when(testAttemptRepository.findAverageScoresGroupedByType(eq(userId), anyString(), anyBoolean()))
                .thenReturn(avgRows);

        StudentHistoryStatsResponse response = studentHistoryService.getStudentStats(userId);

        assertThat(response).isNotNull();
        // Điểm TB tổng quát ưu tiên hiển thị theo target certificate (IELTS) thay vì gộp số học vô nghĩa
        assertThat(response.getAverageScore()).isEqualTo(7.5);
        // Có đầy đủ điểm TB riêng cho từng loại đề
        assertThat(response.getAverageScoresByType()).containsEntry("IELTS", 7.5);
        assertThat(response.getAverageScoresByType()).containsEntry("TOEIC", 750.0);
    }

    @Test
    @DisplayName("getStudentHistory: Lọc danh sách lượt thi phân trang chính xác")
    void getStudentHistory_AppliesCertificateAndStatusFilter() {
        TestAttempt attempt = TestAttempt.builder()
                .userId(userId)
                .examId(20)
                .overallScore(BigDecimal.valueOf(800.0))
                .scoreUnit("TOEIC_SCALED")
                .status(AttemptStatus.COMPLETED)
                .testMode(TestMode.MOCK_TEST)
                .testScope(TestScope.FULL_EXAM)
                .startTime(Instant.now().minusSeconds(3600))
                .endTime(Instant.now())
                .timeSpentSeconds(3600)
                .build();
        attempt.setId(201);

        Exam exam = new Exam();
        exam.setId(20);
        exam.setCode("TOEIC-2024-01");
        exam.setTitle("TOEIC ETS 2024 Test 1");
        exam.setType("TOEIC_LR");
        exam.setExamLanguage("en");

        UserTarget target = new UserTarget();
        target.setTargetScore(BigDecimal.valueOf(750.0));
        target.setTargetCertificate("TOEIC_LR");
        when(userTargetRepository.findFirstByUserId(userId)).thenReturn(Optional.of(target));

        List<Object[]> rows = new ArrayList<>();
        rows.add(new Object[]{attempt, exam});
        PageImpl<Object[]> pageResult = new PageImpl<>(rows);

        when(testAttemptRepository.findUserAttemptsWithExam(
                eq(userId),
                anyString(),
                anyBoolean(),
                anyString(),
                anyBoolean(),
                eq("TOEIC"),
                eq(true),
                eq(TestMode.MOCK_TEST),
                eq(true),
                eq(AttemptStatus.COMPLETED),
                eq(true),
                any(Pageable.class)
        )).thenReturn(pageResult);

        PageResponse<StudentHistoryItemResponse> pageResponse = studentHistoryService.getStudentHistory(
                userId, "", "TOEIC", "MOCK_TEST", "COMPLETED", 0, 10, "newest"
        );

        assertThat(pageResponse).isNotNull();
        assertThat(pageResponse.getItems()).hasSize(1);
        StudentHistoryItemResponse item = pageResponse.getItems().get(0);
        assertThat(item.getAttemptId()).isEqualTo(201);
        assertThat(item.getExamTitle()).isEqualTo("TOEIC ETS 2024 Test 1");
        assertThat(item.getExamType()).isEqualTo("TOEIC_LR");
        assertThat(item.getOverallScore()).isEqualTo(800.0);
        assertThat(item.getMaxScore()).isEqualTo(990.0);
        assertThat(item.getDurationMinutes()).isEqualTo(60);
        assertThat(item.getTargetAchieved()).isTrue();
    }

    @Test
    @DisplayName("getStudentHistory: Trả về danh sách rỗng khi user chưa có bài thi nào")
    void getStudentHistory_ReturnsEmptyWhenNoAttempts() {
        List<Object[]> emptyRows = new ArrayList<>();
        PageImpl<Object[]> emptyPage = new PageImpl<>(emptyRows);

        when(userTargetRepository.findFirstByUserId(userId)).thenReturn(Optional.empty());

        when(testAttemptRepository.findUserAttemptsWithExam(
                eq(userId),
                anyString(),
                anyBoolean(),
                anyString(),
                anyBoolean(),
                anyString(),
                anyBoolean(),
                any(),
                anyBoolean(),
                any(),
                anyBoolean(),
                any(Pageable.class)
        )).thenReturn(emptyPage);

        PageResponse<StudentHistoryItemResponse> pageResponse = studentHistoryService.getStudentHistory(
                userId, null, null, null, null, 0, 10, null
        );

        assertThat(pageResponse).isNotNull();
        assertThat(pageResponse.getItems()).isEmpty();
        assertThat(pageResponse.getTotalElements()).isEqualTo(0);
    }

    @Test
    @DisplayName("getStudentHistory: Xử lý an toàn khi bài thi đã bị xóa khỏi hệ thống (Exam là null)")
    void getStudentHistory_HandlesDeletedExam_WithLeftJoinFallback() {
        TestAttempt attempt = TestAttempt.builder()
                .userId(userId)
                .examId(999)
                .overallScore(null)
                .status(AttemptStatus.GRADING_FAILED)
                .testMode(TestMode.PRACTICE)
                .testScope(TestScope.FULL_EXAM)
                .startTime(Instant.now().minusSeconds(180))
                .endTime(Instant.now())
                .timeSpentSeconds(180)
                .build();
        attempt.setId(301);

        when(userTargetRepository.findFirstByUserId(userId)).thenReturn(Optional.empty());

        List<Object[]> rows = new ArrayList<>();
        // Record with null Exam (LEFT JOIN when exam was deleted)
        rows.add(new Object[]{attempt, null});
        PageImpl<Object[]> pageResult = new PageImpl<>(rows);

        when(testAttemptRepository.findUserAttemptsWithExam(
                eq(userId),
                anyString(),
                anyBoolean(),
                anyString(),
                anyBoolean(),
                anyString(),
                anyBoolean(),
                any(),
                anyBoolean(),
                any(),
                anyBoolean(),
                any(Pageable.class)
        )).thenReturn(pageResult);

        PageResponse<StudentHistoryItemResponse> pageResponse = studentHistoryService.getStudentHistory(
                userId, null, null, null, null, 0, 10, null
        );

        assertThat(pageResponse).isNotNull();
        assertThat(pageResponse.getItems()).hasSize(1);
        StudentHistoryItemResponse item = pageResponse.getItems().get(0);
        assertThat(item.getAttemptId()).isEqualTo(301);
        assertThat(item.getExamId()).isEqualTo(999);
        assertThat(item.getExamTitle()).isEqualTo("Đề thi đã ngừng phát hành (#999)");
        assertThat(item.getExamCode()).isEqualTo("N/A");
        assertThat(item.getIsExamDeleted()).isTrue();
        assertThat(item.getStatus()).isEqualTo("GRADING_FAILED");
    }

    @Test
    @DisplayName("getStudentHistory: Áp dụng ngôn ngữ mục tiêu của user để loại bỏ đề khác ngôn ngữ")
    void getStudentHistory_AppliesTargetLanguageFilter() {
        UserTarget target = new UserTarget();
        target.setTargetLanguage("vi");
        target.setTargetCertificate("NLTV");
        when(userTargetRepository.findFirstByUserId(userId)).thenReturn(Optional.of(target));

        List<Object[]> rows = new ArrayList<>();
        PageImpl<Object[]> pageResult = new PageImpl<>(rows);

        when(testAttemptRepository.findUserAttemptsWithExam(
                eq(userId),
                eq("vi"),
                eq(true),
                anyString(),
                anyBoolean(),
                anyString(),
                anyBoolean(),
                any(),
                anyBoolean(),
                any(),
                anyBoolean(),
                any(Pageable.class)
        )).thenReturn(pageResult);

        PageResponse<StudentHistoryItemResponse> pageResponse = studentHistoryService.getStudentHistory(
                userId, null, null, null, null, 0, 10, null
        );

        assertThat(pageResponse).isNotNull();
        assertThat(pageResponse.getItems()).isEmpty();
    }
}
