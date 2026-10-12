package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.entity.ExamPart;
import com.multilingo.backend.modules.exam.entity.ExamSection;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamSectionRepository;
import com.multilingo.backend.modules.testing.dto.response.LearnerExamStructureResponse;
import com.multilingo.backend.modules.testing.service.impl.LearnerExamStructureServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LearnerExamStructureServiceTest {

    @Mock ExamRepository examRepository;
    @Mock ExamSectionRepository sectionRepository;
    @Mock ExamPartRepository partRepository;

    private LearnerExamStructureService service;

    @BeforeEach
    void setUp() {
        service = new LearnerExamStructureServiceImpl(examRepository, sectionRepository, partRepository);
    }

    @Test
    void returns_published_exam_structure_with_real_ids_and_metadata_order() {
        // Given published exam, even if isVipOnly=true
        Exam exam = Exam.builder()
                .code("IELTS-1")
                .title("IELTS Mock")
                .type("IELTS")
                .durationMinutes(120)
                .isPublished(true)
                .isVipOnly(true)
                .build();
        exam.setId(9);

        // Sections: out of order, including tie on orderIndex (order 2, id 95 vs id 90)
        ExamSection sectionTie2 = section(95, "WRITING", "Writing Section", 60, 2, exam);
        ExamSection sectionTie1 = section(90, "LISTENING", "Listening Section", 40, 2, exam);
        ExamSection sectionFirst = section(70, "READING", "Reading Section", 60, 1, exam);

        // Parts for sectionFirst: test canonical part_title, fallback title, duplicate partNumber tie-break by id
        ExamPart partTie2 = part(703, 1, Map.of("title", "Part 1 Duplicate Tie 2"), sectionFirst);
        ExamPart partTie1 = part(701, 1, Map.of("part_title", "Part 1 Canonical"), sectionFirst);
        ExamPart partSecond = part(702, 2, Map.of("title", "Part 2 Fallback"), sectionFirst);

        when(examRepository.findById(9)).thenReturn(Optional.of(exam));
        when(sectionRepository.findByExam_Id(9)).thenReturn(List.of(sectionTie2, sectionFirst, sectionTie1));
        when(partRepository.findBySection_Id(70)).thenReturn(List.of(partSecond, partTie2, partTie1));
        when(partRepository.findBySection_Id(90)).thenReturn(List.of());
        when(partRepository.findBySection_Id(95)).thenReturn(List.of());

        // When
        LearnerExamStructureResponse response = service.getPublishedExamStructure(9);

        // Then: Exam fields
        assertThat(response.getId()).isEqualTo(9);
        assertThat(response.getCode()).isEqualTo("IELTS-1");
        assertThat(response.getTitle()).isEqualTo("IELTS Mock");
        assertThat(response.getType()).isEqualTo("IELTS");
        assertThat(response.getDurationMinutes()).isEqualTo(120);

        // Then: Sections sorted by orderIndex asc, tie-break by id asc
        assertThat(response.getSections()).hasSize(3);
        assertThat(response.getSections()).extracting(LearnerExamStructureResponse.Section::getId)
                .containsExactly(70, 90, 95);

        LearnerExamStructureResponse.Section sec1 = response.getSections().get(0);
        assertThat(sec1.getId()).isEqualTo(70);
        assertThat(sec1.getSkillType()).isEqualTo("READING");
        assertThat(sec1.getTitle()).isEqualTo("Reading Section");
        assertThat(sec1.getDurationMinutes()).isEqualTo(60);
        assertThat(sec1.getOrderIndex()).isEqualTo(1);

        // Then: Parts sorted by partNumber asc, tie-break by id asc
        assertThat(sec1.getParts()).hasSize(3);
        assertThat(sec1.getParts()).extracting(LearnerExamStructureResponse.Part::getId)
                .containsExactly(701, 703, 702);

        LearnerExamStructureResponse.Part p1 = sec1.getParts().get(0);
        assertThat(p1.getId()).isEqualTo(701);
        assertThat(p1.getPartNumber()).isEqualTo(1);
        assertThat(p1.getTitle()).isEqualTo("Part 1 Canonical");

        LearnerExamStructureResponse.Part p2 = sec1.getParts().get(1);
        assertThat(p2.getId()).isEqualTo(703);
        assertThat(p2.getPartNumber()).isEqualTo(1);
        assertThat(p2.getTitle()).isEqualTo("Part 1 Duplicate Tie 2");

        LearnerExamStructureResponse.Part p3 = sec1.getParts().get(2);
        assertThat(p3.getId()).isEqualTo(702);
        assertThat(p3.getPartNumber()).isEqualTo(2);
        assertThat(p3.getTitle()).isEqualTo("Part 2 Fallback");
    }

    @Test
    void part_with_missing_title_or_null_content_returns_null_title() {
        Exam exam = Exam.builder()
                .code("TOEIC-1")
                .title("TOEIC Practice")
                .type("TOEIC")
                .durationMinutes(120)
                .isPublished(true)
                .build();
        exam.setId(1);

        ExamSection sec = section(10, "LISTENING", "Listening", 45, 1, exam);
        ExamPart partNoTitle = part(101, 1, Map.of("other_field", "value"), sec);
        ExamPart partNullContent = part(102, 2, null, sec);

        when(examRepository.findById(1)).thenReturn(Optional.of(exam));
        when(sectionRepository.findByExam_Id(1)).thenReturn(List.of(sec));
        when(partRepository.findBySection_Id(10)).thenReturn(List.of(partNoTitle, partNullContent));

        LearnerExamStructureResponse response = service.getPublishedExamStructure(1);

        assertThat(response.getSections().get(0).getParts()).hasSize(2);
        assertThat(response.getSections().get(0).getParts().get(0).getTitle()).isNull();
        assertThat(response.getSections().get(0).getParts().get(1).getTitle()).isNull();
    }

    @Test
    void part_with_non_string_title_falls_back_or_returns_null_without_exposing_data() {
        Exam exam = Exam.builder()
                .code("SECURE-1")
                .title("Secure Exam")
                .type("IELTS")
                .durationMinutes(60)
                .isPublished(true)
                .build();
        exam.setId(3);

        ExamSection sec = section(20, "READING", "Reading", 60, 1, exam);
        
        ExamPart partMapCanonical = part(201, 1, Map.of(
                "part_title", Map.of("correct_answer", "B"),
                "title", "Safe Legacy Title"
        ), sec);
        
        ExamPart partListLegacy = part(202, 2, Map.of(
                "title", List.of("question1", "question2")
        ), sec);
        
        ExamPart partBothMap = part(203, 3, Map.of(
                "part_title", Map.of("gradingKey", "XYZ"),
                "title", Map.of("questions", "...")
        ), sec);

        when(examRepository.findById(3)).thenReturn(Optional.of(exam));
        when(sectionRepository.findByExam_Id(3)).thenReturn(List.of(sec));
        when(partRepository.findBySection_Id(20)).thenReturn(List.of(partMapCanonical, partListLegacy, partBothMap));

        LearnerExamStructureResponse response = service.getPublishedExamStructure(3);

        List<LearnerExamStructureResponse.Part> parts = response.getSections().get(0).getParts();
        assertThat(parts).hasSize(3);
        
        assertThat(parts.get(0).getTitle()).isEqualTo("Safe Legacy Title");
        assertThat(parts.get(1).getTitle()).isNull();
        assertThat(parts.get(2).getTitle()).isNull();
    }

    @Test
    void exam_and_section_without_children_return_empty_lists() {
        Exam exam = Exam.builder()
                .code("EMPTY-1")
                .title("Empty Exam")
                .type("IELTS")
                .durationMinutes(60)
                .isPublished(true)
                .build();
        exam.setId(2);

        when(examRepository.findById(2)).thenReturn(Optional.of(exam));
        when(sectionRepository.findByExam_Id(2)).thenReturn(Collections.emptyList());

        LearnerExamStructureResponse response = service.getPublishedExamStructure(2);

        assertThat(response.getSections()).isNotNull().isEmpty();
    }

    @Test
    void rejects_unpublished_and_missing_exams_without_calling_section_or_part_repositories() {
        Exam unpublished = Exam.builder().title("Draft").isPublished(false).build();
        unpublished.setId(10);
        Exam nullPublished = Exam.builder().title("Null Draft").isPublished(null).build();
        nullPublished.setId(11);

        when(examRepository.findById(10)).thenReturn(Optional.of(unpublished));
        when(examRepository.findById(11)).thenReturn(Optional.of(nullPublished));
        when(examRepository.findById(404)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getPublishedExamStructure(10))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).getErrorCode())
                .isEqualTo(ErrorCode.EXAM_NOT_FOUND);

        assertThatThrownBy(() -> service.getPublishedExamStructure(11))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).getErrorCode())
                .isEqualTo(ErrorCode.EXAM_NOT_FOUND);

        assertThatThrownBy(() -> service.getPublishedExamStructure(404))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).getErrorCode())
                .isEqualTo(ErrorCode.EXAM_NOT_FOUND);

        verifyNoInteractions(sectionRepository, partRepository);
    }

    private ExamSection section(Integer id, String skillType, String title, int durationMinutes, int orderIndex, Exam exam) {
        ExamSection section = ExamSection.builder()
                .exam(exam)
                .skillType(skillType)
                .title(title)
                .durationMinutes(durationMinutes)
                .orderIndex(orderIndex)
                .build();
        section.setId(id);
        return section;
    }

    private ExamPart part(Integer id, int partNumber, Map<String, Object> contentData, ExamSection section) {
        ExamPart part = ExamPart.builder()
                .section(section)
                .partNumber(partNumber)
                .contentData(contentData)
                .build();
        part.setId(id);
        return part;
    }
}
