package com.multilingo.backend.modules.exam.service.impl;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.exam.dto.response.StudentExamSummaryResponse;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudentExamServiceImplTest {

    @Mock
    private ExamRepository examRepository;

    @Mock
    private TestAttemptRepository testAttemptRepository;

    @InjectMocks
    private StudentExamServiceImpl studentExamService;

    @Test
    void searchExams_PopulatesJoinsFromTestAttempts() {
        Exam exam = new Exam();
        exam.setId(5);
        exam.setCode("TOEIC-TEST-01");
        exam.setTitle("ETS TOEIC 2024 Test 1");
        exam.setType("TOEIC_LR");
        exam.setIsPublished(true);
        exam.setDurationMinutes(120);

        when(examRepository.findPublishedExams(eq(""), eq(null), eq(false), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(exam)));
        when(testAttemptRepository.countAttemptsGroupByExamId())
                .thenReturn(List.<Object[]>of(new Object[]{5, 42L}));

        PageResponse<StudentExamSummaryResponse> response = studentExamService.searchExams(null, null, 0, 10, "popular");

        assertThat(response.getItems()).hasSize(1);
        StudentExamSummaryResponse item = response.getItems().get(0);
        assertThat(item.getId()).isEqualTo(5);
        assertThat(item.getJoins()).isEqualTo(42);
    }

    @Test
    void searchExams_MapsNltvTypeCorrectly() {
        Exam exam = new Exam();
        exam.setId(8);
        exam.setCode("NLTV-SAMPLE-01");
        exam.setTitle("Đề thi Năng lực Tiếng Việt mẫu");
        exam.setType("NLTV");
        exam.setIsPublished(true);
        exam.setDurationMinutes(180);

        when(examRepository.findPublishedExams(eq(""), eq(null), eq(false), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(exam)));

        PageResponse<StudentExamSummaryResponse> response = studentExamService.searchExams(null, null, 0, 10, "newest");

        assertThat(response.getItems()).hasSize(1);
        StudentExamSummaryResponse item = response.getItems().get(0);
        assertThat(item.getType()).isEqualTo("NLTV");
        assertThat(item.getLevel()).isEqualTo("Đa bậc");
        assertThat(item.getTags()).containsExactly("Nghe hiểu", "Đọc hiểu", "Viết");
    }

    @Test
    void searchExams_WithUserId_PopulatesUserAttempts() {
        Exam exam = new Exam();
        exam.setId(10);
        exam.setCode("IELTS-18-01");
        exam.setTitle("IELTS 18 Test 1");
        exam.setType("IELTS_ACADEMIC");
        exam.setIsPublished(true);
        exam.setDurationMinutes(60);

        when(examRepository.findPublishedExams(eq(""), eq(null), eq(false), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(exam)));
        when(testAttemptRepository.countAttemptsGroupByExamId())
                .thenReturn(List.<Object[]>of(new Object[]{10, 15L}));
        when(testAttemptRepository.findUserAttemptSummariesByUserId(1))
                .thenReturn(List.<Object[]>of(new Object[]{10, 2L, 7.5}));

        PageResponse<StudentExamSummaryResponse> response = studentExamService.searchExams(null, null, 0, 10, "newest", null, 1);

        assertThat(response.getItems()).hasSize(1);
        StudentExamSummaryResponse item = response.getItems().get(0);
        assertThat(item.getId()).isEqualTo(10);
        assertThat(item.getJoins()).isEqualTo(15);
        assertThat(item.getIsAttempted()).isTrue();
        assertThat(item.getUserAttemptsCount()).isEqualTo(2);
        assertThat(item.getUserHighestScore()).isEqualTo(7.5);
    }
}
