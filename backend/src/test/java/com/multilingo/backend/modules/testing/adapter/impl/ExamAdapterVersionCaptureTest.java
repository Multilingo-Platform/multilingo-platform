package com.multilingo.backend.modules.testing.adapter.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.entity.ExamPart;
import com.multilingo.backend.modules.exam.entity.ExamSection;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamSectionRepository;
import com.multilingo.backend.modules.testing.adapter.dto.ExamFixture;
import com.multilingo.backend.modules.testing.adapter.dto.PartFixture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ExamAdapterVersionCaptureTest {

    private final ExamRepository examRepository = mock(ExamRepository.class);
    private final ExamSectionRepository examSectionRepository = mock(ExamSectionRepository.class);
    private final ExamPartRepository examPartRepository = mock(ExamPartRepository.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private DbExamAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new DbExamAdapter(examRepository, examSectionRepository, examPartRepository, objectMapper);
    }

    @Test
    void findSnapshotById_capturesTv2UpdatedAtAndInheritsGroupOptions() {
        Instant tv2UpdatedAt = Instant.parse("2026-10-11T12:00:00Z");

        Exam exam = Exam.builder()
                .title("IELTS Academic Test 5")
                .durationMinutes(120)
                .build();
        exam.setId(5);
        exam.setUpdatedAt(tv2UpdatedAt);

        ExamSection section = ExamSection.builder()
                .exam(exam)
                .skillType("READING")
                .durationMinutes(60)
                .build();
        section.setId(50);

        // Group with shared options (e.g. matching headings)
        List<Map<String, String>> groupOptions = List.of(
                Map.of("id", "i", "text", "Heading One"),
                Map.of("id", "ii", "text", "Heading Two")
        );

        Map<String, Object> qWithoutOptions = new LinkedHashMap<>();
        qWithoutOptions.put("question_id", "q_h1");
        qWithoutOptions.put("type", "MATCHING_HEADINGS");
        qWithoutOptions.put("correct_answer", "i");
        qWithoutOptions.put("explanation", "First heading matches paragraph A.");

        Map<String, Object> group = new LinkedHashMap<>();
        group.put("group_id", "grp_headings");
        group.put("options", groupOptions);
        group.put("questions", List.of(qWithoutOptions));

        Map<String, Object> contentData = new LinkedHashMap<>();
        contentData.put("part_title", "Reading Section 1");
        contentData.put("question_groups", List.of(group));

        ExamPart part = ExamPart.builder()
                .section(section)
                .partNumber(1)
                .contentData(contentData)
                .build();
        part.setId(501);

        when(examRepository.findById(5)).thenReturn(Optional.of(exam));
        when(examSectionRepository.findByExam_Id(5)).thenReturn(List.of(section));
        when(examPartRepository.findBySection_Id(50)).thenReturn(List.of(part));

        ExamFixture snapshot = adapter.findSnapshotById(5).orElseThrow();

        // 1. Verify TV2 updatedAt version is captured
        assertThat(snapshot.getUpdatedAt()).isEqualTo(tv2UpdatedAt);

        // 2. Verify questions inherited group options
        PartFixture pFixture = snapshot.getSections().get(0).getParts().get(0);
        assertThat(pFixture.getQuestions()).hasSize(1);

        @SuppressWarnings("unchecked")
        Map<String, Object> capturedQuestion = (Map<String, Object>) pFixture.getQuestions().get(0);
        assertThat(capturedQuestion).containsKey("options");
        assertThat(capturedQuestion.get("options")).isEqualTo(groupOptions);
        assertThat(capturedQuestion.get("correct_answer")).isEqualTo("i");
        assertThat(capturedQuestion.get("explanation")).isEqualTo("First heading matches paragraph A.");
    }
}
