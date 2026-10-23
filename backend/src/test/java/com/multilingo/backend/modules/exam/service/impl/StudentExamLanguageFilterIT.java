package com.multilingo.backend.modules.exam.service.impl;

import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class StudentExamLanguageFilterIT {
    @Autowired ExamRepository examRepository;
    @Autowired StudentExamServiceImpl studentExams;

    @Test
    void languageFilterIncludesScriptAndRegionVariantsButOnlyPublishedRows() {
        exam("zh-Hant-TW", true);
        exam("zh", true);
        exam("vi", true);
        exam("zh-Hans-CN", false);

        var result = studentExams.searchExams("", null, 0, 20, "createdAt", "zh-Hant-TW");

        assertThat(result.getItems()).extracting(item -> item.getExamLanguage())
                .containsExactlyInAnyOrder("zh-Hant-TW", "zh");
    }

    private void exam(String language, boolean published) {
        Exam exam = Exam.builder()
                .code("LANG-" + java.util.UUID.randomUUID())
                .title("Language Practice " + language)
                .type("LANGUAGE_PRACTICE")
                .examLanguage(language)
                .durationMinutes(25)
                .isPublished(published)
                .build();
        examRepository.save(exam);
    }
}
