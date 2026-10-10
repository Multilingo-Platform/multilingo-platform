package com.multilingo.backend.modules.testing.adapter.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.entity.ExamPart;
import com.multilingo.backend.modules.exam.entity.ExamSection;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamSectionRepository;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.grading.dto.GradingKey;
import com.multilingo.backend.modules.testing.grading.dto.GradingResult;
import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;
import com.multilingo.backend.modules.testing.grading.GradingVerdict;
import com.multilingo.backend.modules.testing.grading.impl.ObjectiveGradingServiceImpl;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
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

    @SafeVarargs
    private Map<String, Object> group(String groupId, Map<String, Object>... questions) {
        Map<String, Object> grp = new LinkedHashMap<>();
        grp.put("group_id", groupId);
        grp.put("questions", List.of(questions));
        return grp;
    }

    @SafeVarargs
    private Map<String, Object> canonicalGroupsList(Map<String, Object>... groups) {
        return Map.of("question_groups", List.of(groups));
    }

    @Test
    void loadPartKeys_extractsAllCanonicalTypesAcrossGroups_andGradesCorrectlyWithObjectiveEngine() { // TC_GRD_ADP_01
        Exam exam = mockExam();
        ExamSection reading = mockSection(10, "READING");
        ExamSection listening = mockSection(20, "LISTENING");
        ExamSection writing = mockSection(30, "WRITING");

        ExamPart readingPart = mockPart(101, canonicalGroupsList(
                group("g1",
                        question("q_sc", "SINGLE_CHOICE", "B"),
                        question("q_mc", "MULTIPLE_CHOICE", List.of("A", "C")),
                        question("q_tf", "TRUE_FALSE_NOT_GIVEN", "TRUE"),
                        question("q_yn", "YES_NO_NOT_GIVEN", "NOT_GIVEN")),
                group("g2",
                        question("q_fill", "FILL_IN_THE_BLANK", List.of("stem cells", "pluripotent stem cells")),
                        question("q_feat", "MATCHING_FEATURES", "D"),
                        question("q_head", "MATCHING_HEADINGS", "Paragraph III"))
        ));

        ExamPart listeningPart = mockPart(202, canonicalGroups(
                question("q_map", "MAP_LABELING", "E"),
                question("q_diag", "DIAGRAM_LABELING", List.of("combustion chamber"))
        ));

        ExamPart writingPart = mockPart(303, canonicalGroups(
                question("q_essay", "ESSAY", null)
        ));

        stubExam(exam, List.of(reading, listening, writing), Map.of(
                10, List.of(readingPart),
                20, List.of(listeningPart),
                30, List.of(writingPart)
        ));

        Map<Integer, PartGradingKey> keys = adapter.loadPartKeys(1);

        assertThat(keys).containsKeys(101, 202, 303);
        assertThat(keys.get(101).getAnswers()).hasSize(7);
        assertThat(keys.get(202).getAnswers()).hasSize(2);
        assertThat(keys.get(303).getAnswers()).isEmpty(); // ESSAY skipped

        // Verify array preservation
        assertThat(keys.get(101).getAnswers().get("q_fill").getCorrect())
                .isEqualTo(List.of("stem cells", "pluripotent stem cells"));

        // Grade through ObjectiveGradingServiceImpl
        ObjectiveGradingServiceImpl engine = new ObjectiveGradingServiceImpl();

        AttemptAnswer ansReading = new AttemptAnswer();
        ansReading.setPartId(101);
        ansReading.setUserAnswers(Map.of(
                "q_sc", "b",
                "q_mc", List.of("C", "A"),
                "q_tf", "T",
                "q_yn", "NG",
                "q_fill", "stem   cells",
                "q_feat", "d",
                "q_head", "Paragraph   III"
        ));

        AttemptAnswer ansListening = new AttemptAnswer();
        ansListening.setPartId(202);
        ansListening.setUserAnswers(Map.of(
                "q_map", "e",
                "q_diag", "Combustion Chamber"
        ));

        AttemptAnswer ansWriting = new AttemptAnswer();
        ansWriting.setPartId(303);
        ansWriting.setUserAnswers(Map.of(
                "q_essay", "Essay text submission"
        ));

        GradingResult result = engine.gradeAttempt(
                List.of(ansReading, ansListening, ansWriting), keys);

        assertThat(result.getTotalObjectiveCount()).isEqualTo(9);
        assertThat(result.getCorrectCount()).isEqualTo(9);
        assertThat(result.getTotalScore()).isEqualByComparingTo(new BigDecimal("9.0"));
        assertThat(result.getSectionScores().get("READING")).isEqualByComparingTo(new BigDecimal("7.0"));
        assertThat(result.getSectionScores().get("LISTENING")).isEqualByComparingTo(new BigDecimal("2.0"));
    }

    @Test
    void loadPartKeys_matchingHeadings_mapsOptionIdToAcceptedKey_andGradesCorrectlyWithSubmittedId() { // TC_GRD_ADP_HEAD_01
        Exam exam = mockExam();
        ExamSection reading = mockSection(10, "READING");

        Map<String, Object> headingQuestion = question("q_head_1", "MATCHING_HEADINGS", "A history of transport");
        headingQuestion.put("options", List.of(
                Map.of("id", "i", "text", "A history of transport"),
                Map.of("id", "ii", "text", "Modern transport systems"),
                Map.of("id", "iii", "text", "Future aviation")
        ));
        headingQuestion.put("alternates", List.of("History of transport"));

        ExamPart part = mockPart(101, canonicalGroups(headingQuestion));
        stubExam(exam, List.of(reading), Map.of(10, List.of(part)));

        Map<Integer, PartGradingKey> keys = adapter.loadPartKeys(1);

        assertThat(keys).containsKey(101);
        GradingKey key = keys.get(101).getAnswers().get("q_head_1");
        assertThat(key).isNotNull();
        assertThat(key.getCorrect()).isEqualTo("A history of transport");
        assertThat(key.getAlternates()).contains("i", "History of transport");

        // Grade through actual engine ObjectiveGradingServiceImpl
        ObjectiveGradingServiceImpl engine = new ObjectiveGradingServiceImpl();

        // 1. Submitted option ID "i" (as sent by MatchingRenderer UI) -> CORRECT / 1.0
        AttemptAnswer ansOptionId = new AttemptAnswer();
        ansOptionId.setPartId(101);
        ansOptionId.setUserAnswers(Map.of("q_head_1", "i"));
        GradingResult resOptionId = engine.gradeAttempt(List.of(ansOptionId), keys);
        assertThat(resOptionId.getPartResults().get(101).get("q_head_1").getVerdict())
                .isEqualTo(GradingVerdict.CORRECT);
        assertThat(resOptionId.getTotalScore()).isEqualByComparingTo(new BigDecimal("1.0"));

        // 2. Submitted full heading text -> CORRECT / 1.0
        AttemptAnswer ansText = new AttemptAnswer();
        ansText.setPartId(101);
        ansText.setUserAnswers(Map.of("q_head_1", "A history of transport"));
        GradingResult resText = engine.gradeAttempt(List.of(ansText), keys);
        assertThat(resText.getPartResults().get(101).get("q_head_1").getVerdict())
                .isEqualTo(GradingVerdict.CORRECT);

        // 3. Submitted alternate text -> CORRECT / 1.0
        AttemptAnswer ansAlt = new AttemptAnswer();
        ansAlt.setPartId(101);
        ansAlt.setUserAnswers(Map.of("q_head_1", "History of transport"));
        GradingResult resAlt = engine.gradeAttempt(List.of(ansAlt), keys);
        assertThat(resAlt.getPartResults().get(101).get("q_head_1").getVerdict())
                .isEqualTo(GradingVerdict.CORRECT);

        // 4. Submitted wrong option ID "ii" -> WRONG / 0.0
        AttemptAnswer ansWrong = new AttemptAnswer();
        ansWrong.setPartId(101);
        ansWrong.setUserAnswers(Map.of("q_head_1", "ii"));
        GradingResult resWrong = engine.gradeAttempt(List.of(ansWrong), keys);
        assertThat(resWrong.getPartResults().get(101).get("q_head_1").getVerdict())
                .isEqualTo(GradingVerdict.WRONG);
        assertThat(resWrong.getTotalScore()).isEqualByComparingTo(BigDecimal.ZERO);

        // 5. Blank answer -> BLANK / 0.0
        AttemptAnswer ansBlank = new AttemptAnswer();
        ansBlank.setPartId(101);
        ansBlank.setUserAnswers(Map.of("q_head_1", ""));
        GradingResult resBlank = engine.gradeAttempt(List.of(ansBlank), keys);
        assertThat(resBlank.getPartResults().get(101).get("q_head_1").getVerdict())
                .isEqualTo(GradingVerdict.BLANK);
        assertThat(resBlank.getTotalScore()).isEqualByComparingTo(BigDecimal.ZERO);
    }
}
