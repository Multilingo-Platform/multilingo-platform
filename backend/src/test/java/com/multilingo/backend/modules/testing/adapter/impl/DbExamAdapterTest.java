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
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DbExamAdapterTest {

    private final ExamRepository examRepository = mock(ExamRepository.class);
    private final ExamSectionRepository examSectionRepository = mock(ExamSectionRepository.class);
    private final ExamPartRepository examPartRepository = mock(ExamPartRepository.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final DbExamAdapter adapter = new DbExamAdapter(
            examRepository, examSectionRepository, examPartRepository, objectMapper);

    @Test
    void findById_recursivelyRemovesPrivateGradingFieldsAndPreservesPublicContent() {
        Map<String, Object> nestedMetadata = new LinkedHashMap<>();
        nestedMetadata.put("hint", "Public hint");
        nestedMetadata.put("correct_answer", "B");
        nestedMetadata.put("explanation", "Private explanation");
        nestedMetadata.put("ai_prompt_context", "Private prompt");
        nestedMetadata.put("ai_feedback", "Private feedback");
        nestedMetadata.put("grading_key", "Private grading key");
        nestedMetadata.put("is_correct_flags", Map.of("q1", true));
        nestedMetadata.put("earned_score", 1);

        Map<String, Object> nestedItem = new LinkedHashMap<>();
        nestedItem.put("label", "Public option");
        nestedItem.put("grading_keys", List.of("secret"));
        nestedItem.put("skill_stats", Map.of("reading", 1));

        Map<String, Object> question = new LinkedHashMap<>();
        question.put("question_id", "q1");
        question.put("question_text", "Public question");
        question.put("metadata", nestedMetadata);
        question.put("items", List.of(nestedItem));

        stubExamWithQuestions(List.of(question));

        ExamFixture fixture = adapter.findById(1).orElseThrow();
        @SuppressWarnings("unchecked")
        Map<String, Object> sanitized = (Map<String, Object>) fixture.getSections().get(0)
                .getParts().get(0).getQuestions().get(0);
        String json = writeJson(sanitized);

        assertThat(json)
                .contains("Public question", "Public hint", "Public option")
                .doesNotContain(
                        "correct_answer", "explanation", "ai_prompt_context", "ai_feedback",
                        "grading_key", "grading_keys", "is_correct_flags", "earned_score", "skill_stats");
    }

    @Test
    void findById_doesNotMutateSourceQuestionData() {
        Map<String, Object> nested = new LinkedHashMap<>();
        nested.put("public", "keep");
        nested.put("correct_answer", "A");
        nested.put("children", new ArrayList<>(List.of(
                new LinkedHashMap<>(Map.of("explanation", "secret", "text", "visible")))));

        Map<String, Object> question = new LinkedHashMap<>();
        question.put("question_id", "q1");
        question.put("metadata", nested);
        List<Map<String, Object>> sourceQuestions = new ArrayList<>(List.of(question));
        String before = writeJson(sourceQuestions);
        stubExamWithQuestions(sourceQuestions);

        ExamFixture fixture = adapter.findById(1).orElseThrow();

        assertThat(writeJson(sourceQuestions)).isEqualTo(before);
        assertThat(sourceQuestions.get(0)).containsKey("metadata");
        assertThat(nested).containsEntry("correct_answer", "A");
        assertThat(fixture.getSections().get(0).getParts().get(0).getQuestions().get(0))
                .isNotSameAs(question);
    }

    @Test
    void findById_mapsCanonicalPartAndQuestionGroupsInOrder() {
        Map<String, Object> firstQuestion = new LinkedHashMap<>();
        firstQuestion.put("question_id", "q1");
        firstQuestion.put("question_text", "First question");
        firstQuestion.put("correct_answer", "A");

        Map<String, Object> secondQuestion = new LinkedHashMap<>();
        secondQuestion.put("question_id", "q2");
        secondQuestion.put("question_text", "Second question");

        Map<String, Object> firstGroup = new LinkedHashMap<>();
        firstGroup.put("group_id", "group-1");
        firstGroup.put("instruction", "First instruction");
        firstGroup.put("content_html", "<h3>First group</h3>");
        firstGroup.put("shared_audio", Map.of("url", "https://cdn/audio.mp3", "duration_seconds", 20));
        firstGroup.put("shared_media", Map.of("type", "image", "url", "https://cdn/image.png"));
        firstGroup.put("questions", List.of(firstQuestion));

        Map<String, Object> secondGroup = new LinkedHashMap<>();
        secondGroup.put("group_id", "group-2");
        secondGroup.put("instruction", "Second instruction");
        secondGroup.put("content_html", "<p>Second group</p>");
        secondGroup.put("questions", List.of(secondQuestion));

        stubExamWithContent(Map.of(
                "part_title", "Part 1: Form Completion",
                "instruction", "Complete the form.",
                "shared_audio", Map.of("url", "https://cdn/part.mp3", "duration_seconds", 245),
                "shared_media", Map.of("type", "image", "url", "https://cdn/part.png"),
                "content_html", "<p>Part introduction</p>",
                "question_groups", List.of(firstGroup, secondGroup)));

        var part = adapter.findById(1).orElseThrow().getSections().get(0).getParts().get(0);

        assertThat(part.getId()).isEqualTo(100);
        assertThat(part.getPartNumber()).isEqualTo(7);
        assertThat(part.getPartTitle()).isEqualTo("Part 1: Form Completion");
        assertThat(part.getTitle()).isEqualTo("Part 1: Form Completion");
        assertThat(part.getInstruction()).isEqualTo("Complete the form.");
        assertThat(part.getContentHtml()).isEqualTo("<p>Part introduction</p>");
        assertThat(part.getSharedAudio()).containsEntry("url", "https://cdn/part.mp3");
        assertThat(part.getSharedMedia()).containsEntry("url", "https://cdn/part.png");
        assertThat(part.getQuestionGroups()).hasSize(2);
        Map<?, ?> mappedFirstGroup = (Map<?, ?>) part.getQuestionGroups().get(0);
        assertThat(mappedFirstGroup.get("group_id")).isEqualTo("group-1");
        assertThat(mappedFirstGroup.get("instruction")).isEqualTo("First instruction");
        assertThat(mappedFirstGroup.get("content_html")).isEqualTo("<h3>First group</h3>");
        assertThat(((Map<?, ?>) mappedFirstGroup.get("shared_audio")).get("url"))
                .isEqualTo("https://cdn/audio.mp3");
        assertThat(((Map<?, ?>) mappedFirstGroup.get("shared_media")).get("url"))
                .isEqualTo("https://cdn/image.png");
        assertThat(((Map<?, ?>) part.getQuestionGroups().get(1)).get("group_id")).isEqualTo("group-2");
        assertThat(part.getQuestions()).hasSize(2);
        assertThat(((Map<?, ?>) part.getQuestions().get(0)).get("question_id")).isEqualTo("q1");
        assertThat(((Map<?, ?>) part.getQuestions().get(1)).get("question_id")).isEqualTo("q2");
        assertThat(writeJson(part.getQuestionGroups())).doesNotContain("correct_answer");
    }

    @Test
    void findById_keepsLegacyFlatQuestionsCompatibleWhenCanonicalFieldsAreAbsent() {
        Map<String, Object> legacyQuestion = new LinkedHashMap<>();
        legacyQuestion.put("question_id", "legacy-q1");
        legacyQuestion.put("question_text", "Legacy question");

        stubExamWithContent(Map.of(
                "title", "Legacy Part",
                "instruction", "Legacy instruction",
                "content_html", "<p>Legacy content</p>",
                "questions", List.of(legacyQuestion)));

        var part = adapter.findById(1).orElseThrow().getSections().get(0).getParts().get(0);

        assertThat(part.getTitle()).isEqualTo("Legacy Part");
        assertThat(part.getPartTitle()).isNull();
        assertThat(part.getContentHtml()).isEqualTo("<p>Legacy content</p>");
        assertThat(part.getQuestionGroups()).isNull();
        assertThat(part.getQuestions()).hasSize(1);
        assertThat(((Map<?, ?>) part.getQuestions().get(0)).get("question_id")).isEqualTo("legacy-q1");
    }

    @Test
    void serializedWorkspace_containsVisibleCanonicalContentAndPreservesIdsAndOrder() {
        stubExamWithContent(canonicalContentWithPrivateFields());

        String json = serializeWorkspace(adapter.findById(1).orElseThrow());

        assertThat(json).contains(
                "Part 1: Form Completion",
                "Complete the form.",
                "<p>Part introduction</p>",
                "https://cdn/part.mp3",
                "https://cdn/part.png",
                "group-1",
                "First instruction",
                "<h3>First group</h3>",
                "https://cdn/audio.mp3",
                "https://cdn/image.png",
                "q1",
                "First question",
                "q2",
                "Second question",
                "\"id\":100",
                "\"partNumber\":7");
        assertThat(json.indexOf("group-1")).isLessThan(json.indexOf("group-2"));
        assertThat(json.indexOf("q1")).isLessThan(json.indexOf("q2"));
    }

    @Test
    void serializedWorkspace_neverExposesNestedPrivateGradingFields() {
        stubExamWithContent(canonicalContentWithPrivateFields());

        String json = serializeWorkspace(adapter.findById(1).orElseThrow());

        assertThat(json).doesNotContain(
                "correct_answer", "explanation", "ai_prompt_context", "ai_feedback",
                "grading_key", "grading_keys", "is_correct_flags", "earned_score", "skill_stats");
    }

    @Test
    void findById_rejectsMalformedCanonicalQuestionGroups() {
        stubExamWithContent(Map.of(
                "question_groups", "not-an-array",
                "questions", List.of(Map.of("question_id", "legacy-q1"))));

        assertThatThrownBy(() -> adapter.findById(1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("question_groups");
    }

    @Test
    void findById_rejectsMissingOrInvalidGroupQuestions() {
        Map<String, Object> groupWithoutQuestions = Map.of("group_id", "group-1");
        stubExamWithContent(Map.of("question_groups", List.of(groupWithoutQuestions)));

        assertThatThrownBy(() -> adapter.findById(1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("questions");
    }

    @Test
    void findById_rejectsNonObjectGroupQuestions() {
        Map<String, Object> groupWithInvalidQuestion = Map.of(
                "group_id", "group-1",
                "questions", List.of("not-a-question-object"));
        stubExamWithContent(Map.of("question_groups", List.of(groupWithInvalidQuestion)));

        assertThatThrownBy(() -> adapter.findById(1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("objects");
    }

    @Test
    void findById_ordersPartsByPartNumberAndPreservesLegacyFlatQuestions() {
        Exam exam = mock(Exam.class);
        ExamSection section = mock(ExamSection.class);
        ExamPart laterPart = mock(ExamPart.class);
        ExamPart earlierPart = mock(ExamPart.class);

        when(examRepository.findById(1)).thenReturn(Optional.of(exam));
        when(exam.getId()).thenReturn(1);
        when(exam.getTitle()).thenReturn("Exam");
        when(examSectionRepository.findByExam_Id(1)).thenReturn(List.of(section));
        when(section.getId()).thenReturn(10);
        when(section.getSkillType()).thenReturn("READING");
        when(examPartRepository.findBySection_Id(10)).thenReturn(List.of(laterPart, earlierPart));

        when(laterPart.getId()).thenReturn(200);
        when(laterPart.getPartNumber()).thenReturn(2);
        when(laterPart.getContentData()).thenReturn(Map.of(
                "questions", List.of(Map.of("question_id", "legacy-q2"))));
        when(earlierPart.getId()).thenReturn(100);
        when(earlierPart.getPartNumber()).thenReturn(1);
        when(earlierPart.getContentData()).thenReturn(Map.of(
                "questions", List.of(Map.of("question_id", "legacy-q1"))));

        List<PartFixture> parts = adapter.findById(1).orElseThrow()
                .getSections().get(0).getParts();

        assertThat(parts).extracting(PartFixture::getId).containsExactly(100, 200);
        assertThat(((Map<?, ?>) parts.get(0).getQuestions().get(0)).get("question_id"))
                .isEqualTo("legacy-q1");
    }

    private void stubExamWithQuestions(List<Map<String, Object>> questions) {
        stubExamWithContent(Map.of(
                "title", "Part 1",
                "instruction", "Public instruction",
                "questions", questions));
    }

    private void stubExamWithContent(Map<String, Object> contentData) {
        Exam exam = mock(Exam.class);
        ExamSection section = mock(ExamSection.class);
        ExamPart part = mock(ExamPart.class);

        when(examRepository.findById(1)).thenReturn(Optional.of(exam));
        when(exam.getId()).thenReturn(1);
        when(exam.getTitle()).thenReturn("Exam");
        when(exam.getDurationMinutes()).thenReturn(60);
        when(examSectionRepository.findByExam_Id(1)).thenReturn(List.of(section));
        when(section.getId()).thenReturn(10);
        when(section.getSkillType()).thenReturn("READING");
        when(section.getDurationMinutes()).thenReturn(60);
        when(examPartRepository.findBySection_Id(10)).thenReturn(List.of(part));
        when(part.getId()).thenReturn(100);
        when(part.getPartNumber()).thenReturn(7);
        when(part.getContentData()).thenReturn(contentData);
    }

    private Map<String, Object> canonicalContentWithPrivateFields() {
        Map<String, Object> firstQuestion = new LinkedHashMap<>();
        firstQuestion.put("question_id", "q1");
        firstQuestion.put("question_text", "First question");
        firstQuestion.put("correct_answer", "A");
        firstQuestion.put("explanation", "Secret explanation");
        firstQuestion.put("ai_prompt_context", "Secret AI context");
        firstQuestion.put("ai_feedback", "Secret AI feedback");
        firstQuestion.put("grading_key", "Secret grading key");
        firstQuestion.put("grading_keys", List.of("secret"));
        firstQuestion.put("is_correct_flags", Map.of("q1", true));
        firstQuestion.put("earned_score", 1);
        firstQuestion.put("skill_stats", Map.of("reading", 1));

        Map<String, Object> secondQuestion = new LinkedHashMap<>();
        secondQuestion.put("question_id", "q2");
        secondQuestion.put("question_text", "Second question");

        Map<String, Object> firstGroup = new LinkedHashMap<>();
        firstGroup.put("group_id", "group-1");
        firstGroup.put("instruction", "First instruction");
        firstGroup.put("content_html", "<h3>First group</h3>");
        firstGroup.put("shared_audio", Map.of("url", "https://cdn/audio.mp3"));
        firstGroup.put("shared_media", Map.of("type", "image", "url", "https://cdn/image.png"));
        firstGroup.put("questions", List.of(firstQuestion));

        Map<String, Object> secondGroup = new LinkedHashMap<>();
        secondGroup.put("group_id", "group-2");
        secondGroup.put("questions", List.of(secondQuestion));

        Map<String, Object> content = new LinkedHashMap<>();
        content.put("part_title", "Part 1: Form Completion");
        content.put("instruction", "Complete the form.");
        content.put("shared_audio", Map.of("url", "https://cdn/part.mp3"));
        content.put("shared_media", Map.of("type", "image", "url", "https://cdn/part.png"));
        content.put("content_html", "<p>Part introduction</p>");
        content.put("question_groups", List.of(firstGroup, secondGroup));
        return content;
    }

    private String serializeWorkspace(ExamFixture fixture) {
        Map<String, Object> snapshot = objectMapper.convertValue(fixture, Map.class);
        WorkspaceResponse response = WorkspaceResponse.builder()
                .examSnapshot(snapshot)
                .build();
        return writeJson(response);
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception exception) {
            throw new AssertionError(exception);
        }
    }
}
