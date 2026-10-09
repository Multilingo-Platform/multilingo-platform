package com.multilingo.backend.modules.testing.adapter.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.entity.ExamPart;
import com.multilingo.backend.modules.exam.entity.ExamSection;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamSectionRepository;
import com.multilingo.backend.modules.testing.grading.dto.GradingKey;
import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DbGradingAdapterTest {

    private final ExamRepository examRepository = mock(ExamRepository.class);
    private final ExamSectionRepository examSectionRepository = mock(ExamSectionRepository.class);
    private final ExamPartRepository examPartRepository = mock(ExamPartRepository.class);
    private final DbGradingAdapter adapter = new DbGradingAdapter(
            examRepository, examSectionRepository, examPartRepository, new ObjectMapper());

    @Test
    void loadPartKeys_extractsQuestionsFromAllGroupsAcrossAllParts() {
        Exam exam = mockExam();
        ExamSection reading = mockSection(10, "READING");
        ExamSection listening = mockSection(20, "LISTENING");
        ExamPart readingPart = mockPart(101, canonicalGroupsWithTwoGroups(
                question("q1", "SINGLE_CHOICE", "A"),
                question("q2", "MULTIPLE_CHOICE", List.of("B", "C"))));
        ExamPart listeningPart = mockPart(202, canonicalGroups(
                question("q3", "TRUE_FALSE_NOT_GIVEN", "TRUE")));
        stubExam(exam, List.of(reading, listening), Map.of(
                10, List.of(readingPart),
                20, List.of(listeningPart)));

        Map<Integer, PartGradingKey> keys = adapter.loadPartKeys(1);

        assertThat(keys).containsKeys(101, 202);
        assertThat(keys.get(101).getSectionName()).isEqualTo("READING");
        assertThat(keys.get(101).getAnswers()).containsKeys("q1", "q2");
        assertThat(keys.get(101).getAnswers().get("q2").getCorrect())
                .isEqualTo(List.of("B", "C"));
        assertThat(keys.get(202).getSectionName()).isEqualTo("LISTENING");
        assertThat(keys.get(202).getAnswers().get("q3").getCorrect()).isEqualTo("TRUE");
    }

    @Test
    void loadPartKeys_excludesEssayQuestionsFromObjectiveKeys() {
        Exam exam = mockExam();
        ExamSection writing = mockSection(30, "WRITING");
        ExamPart writingPart = mockPart(303, canonicalGroups(
                question("essay-1", "ESSAY", null),
                question("q4", "SINGLE_CHOICE", "D")));
        stubExam(exam, List.of(writing), Map.of(30, List.of(writingPart)));

        Map<Integer, PartGradingKey> keys = adapter.loadPartKeys(1);

        assertThat(keys).containsKey(303);
        assertThat(keys.get(303).getAnswers()).containsOnlyKeys("q4");
        assertThat(keys.get(303).getAnswers()).doesNotContainKey("essay-1");
    }

    @Test
    void loadPartKeys_preservesCanonicalAcceptedAlternativesExactly() {
        List<String> acceptedAnswers = List.of("New York", "NYC", "new york city");
        Exam exam = mockExam();
        ExamSection reading = mockSection(10, "READING");
        ExamPart part = mockPart(101, canonicalGroups(
                question("q-fill", "FILL_IN_THE_BLANK", acceptedAnswers)));
        stubExam(exam, List.of(reading), Map.of(10, List.of(part)));

        GradingKey key = adapter.loadPartKeys(1).get(101).getAnswers().get("q-fill");

        assertThat(key.getCorrect()).isEqualTo(acceptedAnswers);
        assertThat(key.getAlternates()).isNull();
    }

    @Test
    void loadPartKeys_rejectsDuplicateQuestionIdsWithinSamePart() {
        Exam exam = mockExam();
        ExamSection reading = mockSection(10, "READING");
        ExamPart part = mockPart(101, canonicalGroupsWithTwoGroups(
                question("duplicate-id", "SINGLE_CHOICE", "A"),
                question("duplicate-id", "SINGLE_CHOICE", "B")));
        stubExam(exam, List.of(reading), Map.of(10, List.of(part)));

        assertThatThrownBy(() -> adapter.loadPartKeys(1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("duplicate-id");
    }

    @Test
    void loadPartKeys_rejectsDuplicateQuestionIdsWhenEssayIsFirst() {
        Exam exam = mockExam();
        ExamSection writing = mockSection(30, "WRITING");
        ExamPart part = mockPart(303, canonicalGroupsWithTwoGroups(
                question("duplicate-id", "ESSAY", null),
                question("duplicate-id", "SINGLE_CHOICE", "A")));
        stubExam(exam, List.of(writing), Map.of(30, List.of(part)));

        assertThatThrownBy(() -> adapter.loadPartKeys(1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("duplicate-id");
    }

    @Test
    void loadPartKeys_rejectsDuplicateQuestionIdsWhenCorrectAnswerIsMissing() {
        Map<String, Object> missingCorrect = new LinkedHashMap<>();
        missingCorrect.put("question_id", "duplicate-id");
        missingCorrect.put("type", "SINGLE_CHOICE");
        Exam exam = mockExam();
        ExamSection reading = mockSection(10, "READING");
        ExamPart part = mockPart(101, canonicalGroupsWithTwoGroups(
                question("duplicate-id", "SINGLE_CHOICE", "A"), missingCorrect));
        stubExam(exam, List.of(reading), Map.of(10, List.of(part)));

        assertThatThrownBy(() -> adapter.loadPartKeys(1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("duplicate-id");
    }

    @Test
    void loadPartKeys_rejectsMalformedCanonicalQuestionGroups() {
        Exam exam = mockExam();
        ExamSection reading = mockSection(10, "READING");
        ExamPart part = mockPart(101, Map.of("question_groups", List.of(
                Map.of("group_id", "group-1"))));
        stubExam(exam, List.of(reading), Map.of(10, List.of(part)));

        assertThatThrownBy(() -> adapter.loadPartKeys(1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("question group questions");
    }

    @Test
    void loadPartKeys_rejectsCanonicalQuestionWithoutQuestionId() {
        Map<String, Object> invalidQuestion = question(null, "SINGLE_CHOICE", "A");
        Exam exam = mockExam();
        ExamSection reading = mockSection(10, "READING");
        ExamPart part = mockPart(101, canonicalGroups(invalidQuestion));
        stubExam(exam, List.of(reading), Map.of(10, List.of(part)));

        assertThatThrownBy(() -> adapter.loadPartKeys(1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("question_id");
    }

    @Test
    void loadPartKeys_rejectsCanonicalQuestionWithBlankQuestionId() {
        Map<String, Object> invalidQuestion = question(" ", "SINGLE_CHOICE", "A");
        Exam exam = mockExam();
        ExamSection reading = mockSection(10, "READING");
        ExamPart part = mockPart(101, canonicalGroups(invalidQuestion));
        stubExam(exam, List.of(reading), Map.of(10, List.of(part)));

        assertThatThrownBy(() -> adapter.loadPartKeys(1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("question_id");
    }

    @Test
    void loadPartKeys_rejectsCanonicalQuestionWithoutValidType() {
        Map<String, Object> invalidQuestion = question("q1", null, "A");
        Exam exam = mockExam();
        ExamSection reading = mockSection(10, "READING");
        ExamPart part = mockPart(101, canonicalGroups(invalidQuestion));
        stubExam(exam, List.of(reading), Map.of(10, List.of(part)));

        assertThatThrownBy(() -> adapter.loadPartKeys(1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("type");
    }

    @Test
    void loadPartKeys_rejectsCanonicalQuestionWithBlankType() {
        Map<String, Object> invalidQuestion = question("q1", " ", "A");
        Exam exam = mockExam();
        ExamSection reading = mockSection(10, "READING");
        ExamPart part = mockPart(101, canonicalGroups(invalidQuestion));
        stubExam(exam, List.of(reading), Map.of(10, List.of(part)));

        assertThatThrownBy(() -> adapter.loadPartKeys(1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("type");
    }

    @Test
    void loadPartKeys_preservesSupportedLegacyFlatQuestions() {
        Map<String, Object> legacyQuestion = question(
                "legacy-fill", "FILL_IN_THE_BLANK", "color");
        legacyQuestion.put("alternates", List.of("colour"));
        Exam exam = mockExam();
        ExamSection reading = mockSection(10, "READING");
        ExamPart part = mockPart(101, Map.of("questions", List.of(legacyQuestion)));
        stubExam(exam, List.of(reading), Map.of(10, List.of(part)));

        GradingKey key = adapter.loadPartKeys(1).get(101).getAnswers().get("legacy-fill");

        assertThat(key.getCorrect()).isEqualTo("color");
        assertThat(key.getAlternates()).containsExactly("colour");
    }

    private Exam mockExam() {
        Exam exam = mock(Exam.class);
        when(examRepository.findById(1)).thenReturn(Optional.of(exam));
        when(exam.getId()).thenReturn(1);
        return exam;
    }

    private ExamSection mockSection(Integer id, String skillType) {
        ExamSection section = mock(ExamSection.class);
        when(section.getId()).thenReturn(id);
        when(section.getSkillType()).thenReturn(skillType);
        return section;
    }

    private ExamPart mockPart(Integer id, Map<String, Object> contentData) {
        ExamPart part = mock(ExamPart.class);
        when(part.getId()).thenReturn(id);
        when(part.getContentData()).thenReturn(contentData);
        return part;
    }

    private void stubExam(Exam exam, List<ExamSection> sections,
                          Map<Integer, List<ExamPart>> partsBySection) {
        when(examSectionRepository.findByExam_Id(1)).thenReturn(sections);
        partsBySection.forEach((sectionId, parts) ->
                when(examPartRepository.findBySection_Id(sectionId)).thenReturn(parts));
    }

    private Map<String, Object> canonicalGroups(Map<String, Object>... questions) {
        Map<String, Object> firstGroup = new LinkedHashMap<>();
        firstGroup.put("group_id", "group-1");
        firstGroup.put("questions", List.of(questions));
        return Map.of("question_groups", List.of(firstGroup));
    }

    private Map<String, Object> canonicalGroupsWithTwoGroups(
            Map<String, Object> firstQuestion, Map<String, Object> secondQuestion) {
        Map<String, Object> firstGroup = new LinkedHashMap<>();
        firstGroup.put("group_id", "group-1");
        firstGroup.put("questions", List.of(firstQuestion));
        Map<String, Object> secondGroup = new LinkedHashMap<>();
        secondGroup.put("group_id", "group-2");
        secondGroup.put("questions", List.of(secondQuestion));
        return Map.of("question_groups", List.of(firstGroup, secondGroup));
    }

    private Map<String, Object> question(String id, String type, Object correctAnswer) {
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("question_id", id);
        question.put("type", type);
        question.put("correct_answer", correctAnswer);
        return question;
    }
}
