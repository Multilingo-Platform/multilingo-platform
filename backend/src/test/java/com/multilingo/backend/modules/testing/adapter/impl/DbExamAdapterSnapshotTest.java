package com.multilingo.backend.modules.testing.adapter.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.entity.ExamPart;
import com.multilingo.backend.modules.exam.entity.ExamSection;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamSectionRepository;
import com.multilingo.backend.modules.testing.adapter.dto.ExamFixture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DbExamAdapterSnapshotTest {

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
    void findSnapshotById_preservesCorrectAnswerAndExplanation_whileStrippingInternalAiSecrets() throws Exception {
        Exam exam = Exam.builder()
                .title("IELTS Practice")
                .durationMinutes(60)
                .build();
        exam.setId(1);

        ExamSection section = ExamSection.builder()
                .exam(exam)
                .skillType("READING")
                .durationMinutes(60)
                .build();
        section.setId(10);

        Map<String, Object> question = new LinkedHashMap<>();
        question.put("question_id", "q_1");
        question.put("type", "SINGLE_CHOICE");
        question.put("question_text", "What is the capital?");
        question.put("options", List.of(Map.of("id", "A", "text", "Paris"), Map.of("id", "B", "text", "London")));
        // Fields that MUST be preserved for review snapshot:
        question.put("correct_answer", "A");
        question.put("explanation", "Paris is the capital of France.");
        // Fields that MUST be stripped:
        question.put("ai_prompt_context", "Secret prompt context for grading");
        question.put("ai_feedback", Map.of("secret", "val"));
        question.put("grading_key", "secret_key");

        Map<String, Object> contentData = new LinkedHashMap<>();
        contentData.put("part_title", "Part 1: Geography");
        contentData.put("instruction", "Answer the question");
        contentData.put("question_groups", List.of(Map.of(
                "group_id", "g1",
                "questions", List.of(question)
        )));

        ExamPart part = ExamPart.builder()
                .section(section)
                .partNumber(1)
                .contentData(contentData)
                .build();
        part.setId(100);

        when(examRepository.findById(1)).thenReturn(Optional.of(exam));
        when(examSectionRepository.findByExam_Id(1)).thenReturn(List.of(section));
        when(examPartRepository.findBySection_Id(10)).thenReturn(List.of(part));

        // When finding for snapshot
        ExamFixture snapshotFixture = adapter.findSnapshotById(1).orElseThrow();
        String snapshotJson = objectMapper.writeValueAsString(snapshotFixture);

        // Then correct_answer and explanation MUST be retained
        assertThat(snapshotJson).contains("correct_answer");
        assertThat(snapshotJson).contains("\"correct_answer\":\"A\"");
        assertThat(snapshotJson).contains("explanation");
        assertThat(snapshotJson).contains("Paris is the capital of France.");

        // And ai_prompt_context, grading_key MUST be stripped
        assertThat(snapshotJson).doesNotContain("ai_prompt_context");
        assertThat(snapshotJson).doesNotContain("Secret prompt context");
        assertThat(snapshotJson).doesNotContain("grading_key");

        // Whereas findById (client workspace adapter) still strips correct_answer and explanation:
        ExamFixture clientFixture = adapter.findById(1).orElseThrow();
        String clientJson = objectMapper.writeValueAsString(clientFixture);
        assertThat(clientJson).doesNotContain("correct_answer");
        assertThat(clientJson).doesNotContain("explanation");
        assertThat(clientJson).doesNotContain("ai_prompt_context");
    }
}
