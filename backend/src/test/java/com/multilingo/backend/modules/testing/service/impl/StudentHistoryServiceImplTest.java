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
        when(testAttemptRepository.countByUserId(userId)).thenReturn(5L);
        when(testAttemptRepository.countByUserIdAndStatus(userId, AttemptStatus.COMPLETED)).thenReturn(3L);
        when(testAttemptRepository.countByUserIdAndStatus(userId, AttemptStatus.IN_PROGRESS)).thenReturn(1L);
        when(testAttemptRepository.countByUserIdAndStatus(userId, AttemptStatus.GRADING_FAILED)).thenReturn(1L);
        when(testAttemptRepository.findAverageScoreByUserId(userId)).thenReturn(7.2);
        when(testAttemptRepository.findHighestScoreByUserId(userId)).thenReturn(BigDecimal.valueOf(8.5));
        when(testAttemptRepository.sumTimeSpentSecondsByUserId(userId)).thenReturn(7200L); // 120 minutes

        UserTarget target = new UserTarget();
        target.setTargetScore(BigDecimal.valueOf(7.0));
        when(userTargetRepository.findFirstByUserId(userId)).thenReturn(Optional.of(target));

        UserStudyStat studyStat = new UserStudyStat();
        studyStat.setCurrentStreak(6);
        when(userStudyStatRepository.findByUserId(userId)).thenReturn(Optional.of(studyStat));

        TestAttempt attempt1 = TestAttempt.builder()
                .userId(userId)
                .examId(10)
                .overallScore(BigDecimal.valueOf(7.5))
                .status(AttemptStatus.COMPLETED)
                .endTime(Instant.now())
                .build();
        attempt1.setId(101);

        when(testAttemptRepository.findTop10ByUserIdAndStatusOrderByEndTimeDesc(userId, AttemptStatus.COMPLETED))
                .thenReturn(List.of(attempt1));

        Exam exam1 = new Exam();
        exam1.setId(10);
        exam1.setTitle("IELTS Academic Test 1");
        exam1.setType("IELTS_ACADEMIC");
        when(examRepository.findById(10)).thenReturn(Optional.of(exam1));

        StudentHistoryStatsResponse response = studentHistoryService.getStudentStats(userId);

        assertThat(response).isNotNull();
        assertThat(response.getTotalAttempts()).isEqualTo(5L);
        assertThat(response.getCompletedAttempts()).isEqualTo(3L);
        assertThat(response.getInProgressAttempts()).isEqualTo(1L);
        assertThat(response.getFailedAttempts()).isEqualTo(1L);
        assertThat(response.getAverageScore()).isEqualTo(7.2);
        assertThat(response.getHighestScore()).isEqualTo(8.5);
        assertThat(response.getTotalPracticeMinutes()).isEqualTo(120L);
        assertThat(response.getCurrentStreak()).isEqualTo(6);
        assertThat(response.getTargetAchievedCount()).isEqualTo(1L);
        assertThat(response.getRecentScoreTrends()).hasSize(1);
        assertThat(response.getRecentScoreTrends().get(0).getCertType()).isEqualTo("IELTS");
        assertThat(response.getRecentScoreTrends().get(0).getMaxScore()).isEqualTo(9.0);
    }

    @Test
    @DisplayName("getStudentHistory: Lọc danh sách lượt thi phân trang chính xác")
    void getStudentHistory_AppliesCertificateAndStatusFilter() {
        TestAttempt attempt = TestAttempt.builder()
                .userId(userId)
                .examId(20)
                .overallScore(BigDecimal.valueOf(800.0))
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
        when(userTargetRepository.findFirstByUserId(userId)).thenReturn(Optional.of(target));

        List<Object[]> rows = new ArrayList<>();
        rows.add(new Object[]{attempt, exam});
        PageImpl<Object[]> pageResult = new PageImpl<>(rows);

        when(testAttemptRepository.findUserAttemptsWithExam(
                eq(userId),
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
}
