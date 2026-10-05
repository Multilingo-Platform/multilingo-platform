package com.multilingo.backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.JpaTestConfig;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamSectionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
@Import(JpaTestConfig.class)
class MockDataSeederTest {

    @Autowired
    private ExamRepository examRepository;

    @Autowired
    private ExamSectionRepository examSectionRepository;

    @Autowired
    private ExamPartRepository examPartRepository;

    private MockDataSeeder seeder;

    @BeforeEach
    void setUp() {
        seeder = new MockDataSeeder(examRepository, examSectionRepository, examPartRepository, new ObjectMapper());
        examPartRepository.deleteAll();
        examSectionRepository.deleteAll();
        examRepository.deleteAll();
    }

    @Test
    void run_seedsExamAndSectionsAndParts_whenDatabaseIsEmpty() {
        assertThat(examRepository.count()).isZero();

        seeder.run();

        assertThat(examRepository.count()).isEqualTo(1);
        assertThat(examSectionRepository.count()).isEqualTo(2);
        assertThat(examPartRepository.count()).isEqualTo(4);

        var exam = examRepository.findByCode("TOEIC_MOCK_01");
        assertThat(exam).isPresent();
        assertThat(exam.get().getTitle()).isEqualTo("TOEIC ETS Mini Practice Exam 2026");
    }

    @Test
    void run_skipsSeeding_whenDatabaseAlreadyHasExams() {
        seeder.run();
        long initialExams = examRepository.count();

        // Second run should be idempotent
        seeder.run();

        assertThat(examRepository.count()).isEqualTo(initialExams);
    }
}
