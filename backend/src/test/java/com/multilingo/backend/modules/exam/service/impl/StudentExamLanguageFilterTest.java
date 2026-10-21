package com.multilingo.backend.modules.exam.service.impl;

import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class StudentExamLanguageFilterTest {
    private final ExamRepository repository = mock(ExamRepository.class);
    private final StudentExamServiceImpl service = new StudentExamServiceImpl(repository);

    @Test
    void filtersByCanonicalBaseLanguageAndReturnsExamLanguage() {
        Exam exam = new Exam();
        exam.setId(5);
        exam.setCode("LANG-JP");
        exam.setType("LANGUAGE_PRACTICE");
        exam.setTitle("日本語 読解練習");
        exam.setExamLanguage("zh-Hant-TW");
        exam.setDurationMinutes(25);
        when(repository.findPublishedExamsByLanguage(anyString(), any(), anyBoolean(), anyBoolean(), anyString(), any()))
                .thenReturn(new PageImpl<>(List.of(exam), PageRequest.of(0, 10), 1));

        var result = service.searchExams("", List.of("LANGUAGE_PRACTICE"), 0, 10, "createdAt", "zh-Hant-TW");

        verify(repository).findPublishedExamsByLanguage(eq(""), eq(List.of("LANGUAGE_PRACTICE")), eq(true), eq(true), eq("zh"), any());
        assertThat(result.getItems()).singleElement().satisfies(item -> {
            assertThat(item.getExamLanguage()).isEqualTo("zh-Hant-TW");
            assertThat(item.getType()).isEqualTo("LANGUAGE_PRACTICE");
        });
    }

    @Test
    void rejectsUnsupportedLanguageFilterBeforeQuery() {
        assertThatThrownBy(() -> service.searchExams(null, null, 0, 10, "createdAt", "it"))
                .isInstanceOf(com.multilingo.backend.common.exception.AppException.class);
        verifyNoInteractions(repository);
    }

    @Test
    void mapsOfficialNltvAsMultilevelWithAllThreeSkills() {
        Exam exam = new Exam();
        exam.setId(18);
        exam.setCode("NLTV-SAMPLE-T1-V1");
        exam.setType("NLTV");
        exam.setExamLanguage("vi");
        exam.setTitle("Đề thi NLTV mẫu");
        exam.setDurationMinutes(180);
        when(repository.findPublishedExamsByLanguage(anyString(), any(), anyBoolean(), anyBoolean(), anyString(), any()))
                .thenReturn(new PageImpl<>(List.of(exam), PageRequest.of(0, 10), 1));

        var result = service.searchExams("", List.of("NLTV"), 0, 10, "createdAt", "vi");

        assertThat(result.getItems()).singleElement().satisfies(item -> {
            assertThat(item.getType()).isEqualTo("NLTV");
            assertThat(item.getLevel()).isEqualTo("Đa bậc");
            assertThat(item.getTags()).containsExactly("Nghe hiểu", "Đọc hiểu", "Viết");
            assertThat(item.getDurationMinutes()).isEqualTo(180);
        });
    }
}
