package com.multilingo.backend.modules.exam.repository;

import com.multilingo.backend.common.JpaTestConfig;
import com.multilingo.backend.modules.exam.entity.Exam;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
@Import(JpaTestConfig.class)
class ExamRepositoryTest {

    @Autowired
    private ExamRepository examRepository;

    @Test
    void saveAndFindByCode_returnsExam() {
        Exam exam = Exam.builder()
                .code("TEST_01")
                .title("Test TOEIC")
                .type("TOEIC")
                .examLanguage("en")
                .durationMinutes(120)
                .isPublished(true)
                .isVipOnly(false)
                .build();

        examRepository.save(exam);

        Optional<Exam> found = examRepository.findByCode("TEST_01");
        assertThat(found).isPresent();
        assertThat(found.get().getTitle()).isEqualTo("Test TOEIC");
    }
}
