package com.multilingo.backend.modules.exam.repository;

import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.entity.ExamPart;
import com.multilingo.backend.modules.exam.entity.ExamSection;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class ExamRepositoryUpdateTest {

    @Autowired
    private ExamRepository examRepository;

    @Autowired
    private ExamSectionRepository sectionRepository;

    @Autowired
    private ExamPartRepository partRepository;

    @Test
    void testDeleteByExamId() {
        // Arrange
        Exam exam = new Exam();
        exam.setTitle("Test Exam");
        exam.setCode("TEST_CODE");
        exam.setType("IELTS");
        exam.setExamLanguage("en");
        exam.setCreatedAt(java.time.Instant.now());
        exam.setUpdatedAt(java.time.Instant.now());
        exam = examRepository.save(exam);

        ExamSection section = new ExamSection();
        section.setExam(exam);
        section.setSkillType("READING");
        section.setTitle("Section Title");
        section.setCreatedAt(java.time.Instant.now());
        section.setUpdatedAt(java.time.Instant.now());
        section = sectionRepository.save(section);

        ExamPart part = new ExamPart();
        part.setSection(section);
        part.setPartNumber(1);
        part.setContentData(Map.of("key", "value"));
        part.setCreatedAt(java.time.Instant.now());
        part.setUpdatedAt(java.time.Instant.now());
        partRepository.save(part);

        // Act
        partRepository.deleteBySection_IdIn(List.of(section.getId()));
        sectionRepository.deleteByExam_Id(exam.getId());

        // Assert
        assertThat(partRepository.findAll()).isEmpty();
        assertThat(sectionRepository.findAll()).isEmpty();
    }
}
