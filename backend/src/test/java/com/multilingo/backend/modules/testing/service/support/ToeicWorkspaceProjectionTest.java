package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

class ToeicWorkspaceProjectionTest {

    @Test
    @DisplayName("Parse canonical question numbers for all 7 TOEIC parts (q_001 to q_200)")
    void parseCanonicalQuestionNumber_validRanges() {
        // Part 1: 1..6
        assertThat(ToeicWorkspaceProjection.parseCanonicalQuestionNumber("q_001", 1)).isEqualTo(1);
        assertThat(ToeicWorkspaceProjection.parseCanonicalQuestionNumber("q_006", 1)).isEqualTo(6);

        // Part 2: 7..31
        assertThat(ToeicWorkspaceProjection.parseCanonicalQuestionNumber("q_007", 2)).isEqualTo(7);
        assertThat(ToeicWorkspaceProjection.parseCanonicalQuestionNumber("q_031", 2)).isEqualTo(31);

        // Part 3: 32..70
        assertThat(ToeicWorkspaceProjection.parseCanonicalQuestionNumber("q_032", 3)).isEqualTo(32);
        assertThat(ToeicWorkspaceProjection.parseCanonicalQuestionNumber("q_070", 3)).isEqualTo(70);

        // Part 4: 71..100
        assertThat(ToeicWorkspaceProjection.parseCanonicalQuestionNumber("q_071", 4)).isEqualTo(71);
        assertThat(ToeicWorkspaceProjection.parseCanonicalQuestionNumber("q_100", 4)).isEqualTo(100);

        // Part 5: 101..130
        assertThat(ToeicWorkspaceProjection.parseCanonicalQuestionNumber("q_101", 5)).isEqualTo(101);
        assertThat(ToeicWorkspaceProjection.parseCanonicalQuestionNumber("q_130", 5)).isEqualTo(130);

        // Part 6: 131..146
        assertThat(ToeicWorkspaceProjection.parseCanonicalQuestionNumber("q_131", 6)).isEqualTo(131);
        assertThat(ToeicWorkspaceProjection.parseCanonicalQuestionNumber("q_146", 6)).isEqualTo(146);

        // Part 7: 147..200
        assertThat(ToeicWorkspaceProjection.parseCanonicalQuestionNumber("q_147", 7)).isEqualTo(147);
        assertThat(ToeicWorkspaceProjection.parseCanonicalQuestionNumber("q_200", 7)).isEqualTo(200);
    }

    @Test
    @DisplayName("Rejects question numbers outside part range or canonical boundaries")
    void parseCanonicalQuestionNumber_invalidCases() {
        assertThat(ToeicWorkspaceProjection.parseCanonicalQuestionNumber("q_000", 1)).isNull();
        assertThat(ToeicWorkspaceProjection.parseCanonicalQuestionNumber("q_201", 7)).isNull();
        assertThat(ToeicWorkspaceProjection.parseCanonicalQuestionNumber("q_abc", 1)).isNull();
        assertThat(ToeicWorkspaceProjection.parseCanonicalQuestionNumber(null, 1)).isNull();

        // Mismatched part range: q_032 belongs to Part 3, not Part 2
        assertThat(ToeicWorkspaceProjection.parseCanonicalQuestionNumber("q_032", 2)).isNull();
        // q_007 belongs to Part 2, not Part 1
        assertThat(ToeicWorkspaceProjection.parseCanonicalQuestionNumber("q_007", 1)).isNull();
    }

    @Test
    @DisplayName("Strips Question N prefix in Part 3/4 only when matching canonical number")
    void stripPart34PromptPrefix_matchingAndMismatched() {
        // Matching: strips prefix
        assertThat(ToeicWorkspaceProjection.stripPart34PromptPrefix("Question 32 What event does the woman mention?", 32))
                .isEqualTo("What event does the woman mention?");
        assertThat(ToeicWorkspaceProjection.stripPart34PromptPrefix("Question 32: What event does the woman mention?", 32))
                .isEqualTo("What event does the woman mention?");
        assertThat(ToeicWorkspaceProjection.stripPart34PromptPrefix("Question 71 - Who has recorded the message?", 71))
                .isEqualTo("Who has recorded the message?");
        assertThat(ToeicWorkspaceProjection.stripPart34PromptPrefix("question 32. Where is the man going?", 32))
                .isEqualTo("Where is the man going?");

        // Mismatched: preserves entire text
        assertThat(ToeicWorkspaceProjection.stripPart34PromptPrefix("Question 33 What event does the woman mention?", 32))
                .isEqualTo("Question 33 What event does the woman mention?");

        // No prefix: preserves text
        assertThat(ToeicWorkspaceProjection.stripPart34PromptPrefix("What event does the woman mention?", 32))
                .isEqualTo("What event does the woman mention?");

        // Text is only the prefix: preserves text to avoid empty prompt
        assertThat(ToeicWorkspaceProjection.stripPart34PromptPrefix("Question 32", 32))
                .isEqualTo("Question 32");
    }

    @Test
    @DisplayName("Projects question_number 1..200 and strips Part 3/4 prefixes across TOEIC sections")
    void project_fullToeicSnapshot() {
        Map<String, Object> snapshot = buildSampleToeicSnapshot();

        Map<String, Object> projected = ToeicWorkspaceProjection.project(snapshot, TestMode.PRACTICE);

        assertThat(projected).isNotNull();
        // Check Part 1 question
        Map<String, Object> q1 = getQuestion(projected, 0, 0, 0);
        assertThat(q1.get("question_number")).isEqualTo(1);
        assertThat(q1.get("questionNumber")).isEqualTo(1);

        // Check Part 3 question with prefix stripped
        Map<String, Object> q32 = getQuestion(projected, 0, 2, 0);
        assertThat(q32.get("question_number")).isEqualTo(32);
        assertThat(q32.get("questionNumber")).isEqualTo(32);
        assertThat(q32.get("question_text")).isEqualTo("What event does the woman mention?");

        // Immutability: original snapshot must NOT have question_number
        Map<String, Object> origQ1 = getQuestion(snapshot, 0, 0, 0);
        assertThat(origQ1).doesNotContainKey("question_number");
    }

    @ParameterizedTest
    @CsvSource({
            "question_number, 201", "questionNumber, 7",
            "question_number, 0", "questionNumber, -1",
            "question_number, 1.5", "questionNumber, 4294967297"
    })
    void project_invalidExplicitNumber_fallsBackToCanonicalId(String field, BigDecimal invalidNumber) {
        Map<String, Object> snapshot = buildSampleToeicSnapshot();
        Map<String, Object> original = getQuestion(snapshot, 0, 0, 0);
        original.put("question_id", "q_006");
        original.put(field, invalidNumber);

        Map<String, Object> projected = ToeicWorkspaceProjection.project(snapshot, TestMode.MOCK_TEST);
        Map<String, Object> question = getQuestion(projected, 0, 0, 0);

        assertThat(question.get("question_number")).isEqualTo(6);
        assertThat(question.get("questionNumber")).isEqualTo(6);
        assertThat(question.get("question_text")).isEqualTo("Question 6");
        assertThat(original.get(field)).isEqualTo(invalidNumber);
    }

    @ParameterizedTest
    @CsvSource({"question_number, 201", "questionNumber, 7"})
    void project_invalidExplicitNumber_withoutCanonicalId_omitsNumber(String field, int invalidNumber) {
        Map<String, Object> snapshot = buildSampleToeicSnapshot();
        Map<String, Object> original = getQuestion(snapshot, 0, 0, 0);
        original.put("question_id", "legacy-question");
        original.put(field, invalidNumber);

        Map<String, Object> projected = ToeicWorkspaceProjection.project(snapshot, TestMode.MOCK_TEST);
        Map<String, Object> question = getQuestion(projected, 0, 0, 0);

        assertThat(question).doesNotContainKeys("question_number", "questionNumber");
        assertThat(question.get("question_text")).isEqualTo("Question");
        assertThat(original.get(field)).isEqualTo(invalidNumber);
    }

    @ParameterizedTest
    @CsvSource({"question_number, 1", "questionNumber, 6"})
    void project_validExplicitPartBoundary_withoutCanonicalId_preservesNumber(String field, int number) {
        Map<String, Object> snapshot = buildSampleToeicSnapshot();
        Map<String, Object> original = getQuestion(snapshot, 0, 0, 0);
        original.put("question_id", "legacy-question");
        original.put(field, number);

        Map<String, Object> projected = ToeicWorkspaceProjection.project(snapshot, TestMode.PRACTICE);
        Map<String, Object> question = getQuestion(projected, 0, 0, 0);

        assertThat(question.get("question_number")).isEqualTo(number);
        assertThat(question.get("questionNumber")).isEqualTo(number);
    }

    @ParameterizedTest
    @CsvSource({
            "question_number, '201'", "questionNumber, '7'",
            "question_number, 'invalid'", "questionNumber, '4294967297'"
    })
    void project_invalidExplicitStringNumber_fallsBackToCanonicalId(String field, String invalidValue) {
        Map<String, Object> snapshot = buildSampleToeicSnapshot();
        Map<String, Object> original = getQuestion(snapshot, 0, 0, 0);
        original.put("question_id", "q_006");
        original.put(field, invalidValue);

        Map<String, Object> projected = ToeicWorkspaceProjection.project(snapshot, TestMode.MOCK_TEST);
        Map<String, Object> question = getQuestion(projected, 0, 0, 0);

        assertThat(question.get("question_number")).isEqualTo(6);
        assertThat(question.get("questionNumber")).isEqualTo(6);
        assertThat(question.get("question_text")).isEqualTo("Question 6");
        assertThat(original.get(field)).isEqualTo(invalidValue);
    }

    @ParameterizedTest
    @CsvSource({"question_number, '1'", "questionNumber, '6'"})
    void project_validExplicitStringPartBoundary_withoutCanonicalId_preservesNumber(String field, String numberStr) {
        Map<String, Object> snapshot = buildSampleToeicSnapshot();
        Map<String, Object> original = getQuestion(snapshot, 0, 0, 0);
        original.put("question_id", "legacy-question");
        original.put(field, numberStr);

        Map<String, Object> projected = ToeicWorkspaceProjection.project(snapshot, TestMode.PRACTICE);
        Map<String, Object> question = getQuestion(projected, 0, 0, 0);

        int expected = Integer.parseInt(numberStr);
        assertThat(question.get("question_number")).isEqualTo(expected);
        assertThat(question.get("questionNumber")).isEqualTo(expected);
    }

    @Test
    @DisplayName("Mock mode strips transcripts, spoken texts, and forces empty option text for Part 1/2")
    void project_mockModeFiltersListeningClues() {
        Map<String, Object> snapshot = buildSampleToeicSnapshot();
        // Add spoken text in Part 1 options and transcripts
        Map<String, Object> q1 = getQuestion(snapshot, 0, 0, 0);
        q1.put("transcript", "A woman is looking at a computer screen.");
        q1.put("spoken_text", "Look at the picture labeled number 1");
        q1.put("options", List.of(
                Map.of("id", "A", "text", "She is typing on a keyboard."),
                Map.of("id", "B", "text", "She is drinking coffee.")
        ));

        Map<String, Object> q32 = getQuestion(snapshot, 0, 2, 0);
        q32.put("transcript", "W: Hello John, are you going to the picnic? M: Yes.");
        q32.put("answer_clue", "The woman says picnic");

        Map<String, Object> projected = ToeicWorkspaceProjection.project(snapshot, TestMode.MOCK_TEST);

        // Part 1 in Mock: options text must be empty, transcripts removed
        Map<String, Object> projQ1 = getQuestion(projected, 0, 0, 0);
        assertThat(projQ1).doesNotContainKey("transcript");
        assertThat(projQ1).doesNotContainKey("spoken_text");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> p1Options = (List<Map<String, Object>>) projQ1.get("options");
        assertThat(p1Options).extracting(o -> o.get("id")).containsExactly("A", "B");
        assertThat(p1Options).extracting(o -> o.get("text")).containsExactly("", "");

        // Part 3 in Mock: options text preserved (written in test book), transcripts removed
        Map<String, Object> projQ32 = getQuestion(projected, 0, 2, 0);
        assertThat(projQ32).doesNotContainKey("transcript");
        assertThat(projQ32).doesNotContainKey("answer_clue");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> p3Options = (List<Map<String, Object>>) projQ32.get("options");
        assertThat(p3Options.get(0).get("text")).isEqualTo("A company picnic");
    }

    @Test
    @DisplayName("Mock mode replaces free-form prompt and question_text in Part 1/2 with safe canonical question label, redacts group content_html and spoken aliases")
    void project_mockModeSanitizesPart1And2Prompts() throws Exception {
        Map<String, Object> snapshot = buildSampleToeicSnapshot();

        // Simulate group-level spoken text and spoken aliases in Part 1 and Part 2
        Map<String, Object> p1Group = getGroup(snapshot, 0, 0);
        p1Group.put("content_html", "<p>Photograph 1 spoken dialogue: A woman is sitting at a desk.</p>");
        p1Group.put("spoken_prompt", "Group 1 spoken prompt audio");
        p1Group.put("shared_media", Map.of("type", "image", "url", "https://img.example.com/p1.png"));

        Map<String, Object> p2Group = getGroup(snapshot, 0, 1);
        p2Group.put("content_html", "<p>Part 2 Question 7 spoken dialogue: Where is the meeting being held?</p>");
        p2Group.put("spoken_prompt", "Group 2 spoken prompt audio");

        // Simulate free-form prompt/question_text and spoken aliases in questions
        Map<String, Object> q1 = getQuestion(snapshot, 0, 0, 0); // Part 1, q_001
        q1.put("question_text", "Look at the picture labeled number 1: a woman is typing");
        q1.put("prompt", "Spoken prompt: woman typing on computer");
        q1.put("content", "Secret audio text for Q1");

        Map<String, Object> q7 = getQuestion(snapshot, 0, 1, 0); // Part 2, q_007
        q7.put("question_text", "Where is the meeting being held?");
        q7.put("prompt", "Spoken question: Where is the meeting being held?");
        q7.put("spoken_prompt", "Question 7 spoken prompt");
        q7.put("spokenPrompt", "Question 7 spoken prompt camelCase");
        q7.put("title", "Question 7 spoken audio");
        q7.put("content", "Secret audio question for Q7");

        Map<String, Object> projected = ToeicWorkspaceProjection.project(snapshot, TestMode.MOCK_TEST);

        // Group-level redaction
        Map<String, Object> projP1Group = getGroup(projected, 0, 0);
        assertThat(projP1Group).doesNotContainKey("content_html");
        assertThat(projP1Group).doesNotContainKey("spoken_prompt");
        assertThat(projP1Group.get("shared_media")).isEqualTo(Map.of("type", "image", "url", "https://img.example.com/p1.png"));

        Map<String, Object> projP2Group = getGroup(projected, 0, 1);
        assertThat(projP2Group).doesNotContainKey("content_html");
        assertThat(projP2Group).doesNotContainKey("spoken_prompt");

        // Question-level sanitization
        Map<String, Object> projQ1 = getQuestion(projected, 0, 0, 0);
        assertThat(projQ1.get("question_text")).isEqualTo("Question 1");
        assertThat(projQ1.get("prompt")).isEqualTo("Question 1");
        assertThat(projQ1).doesNotContainKey("content");

        Map<String, Object> projQ7 = getQuestion(projected, 0, 1, 0);
        assertThat(projQ7.get("question_text")).isEqualTo("Question 7");
        assertThat(projQ7.get("prompt")).isEqualTo("Question 7");
        assertThat(projQ7.get("title")).isEqualTo("Question 7");
        assertThat(projQ7).doesNotContainKey("content");
        assertThat(projQ7).doesNotContainKey("spoken_prompt");
        assertThat(projQ7).doesNotContainKey("spokenPrompt");

        String json = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(projected);
        assertThat(json).doesNotContain("Where is the meeting being held?");
        assertThat(json).doesNotContain("Look at the picture labeled number 1");
        assertThat(json).doesNotContain("Secret audio");
        assertThat(json).doesNotContain("Photograph 1 spoken dialogue");
        assertThat(json).doesNotContain("Part 2 Question 7 spoken dialogue");
        assertThat(json).doesNotContain("spoken prompt");
        assertThat(json).contains("\"question_text\":\"Question 1\"");
        assertThat(json).contains("\"question_text\":\"Question 7\"");
        assertThat(json).contains("https://img.example.com/p1.png");
    }

    @Test
    @DisplayName("Mock mode redacts the flat compatibility questions list even when the Part also has question_groups")
    void project_mockModeRedactsFlatQuestionsAlongsideGroups() throws Exception {
        Map<String, Object> snapshot = buildSampleToeicSnapshot();
        Map<String, Object> part1 = getPart(snapshot, 0, 0);

        // DbExamAdapter exposes the same questions both grouped and as a flat compatibility list;
        // after the snapshot is (de)serialized the two lists are independent objects.
        Map<String, Object> flatQ1 = new LinkedHashMap<>();
        flatQ1.put("question_id", "q_001");
        flatQ1.put("question_text", "Secret flat question text");
        flatQ1.put("transcript", "Secret flat transcript");
        flatQ1.put("answer_clue", "Secret flat clue");
        flatQ1.put("options", List.of(
                new LinkedHashMap<>(Map.of("id", "A", "text", "Secret spoken option A")),
                new LinkedHashMap<>(Map.of("id", "B", "text", "Secret spoken option B"))
        ));
        part1.put("questions", new ArrayList<>(List.of(flatQ1)));

        Map<String, Object> projected = ToeicWorkspaceProjection.project(snapshot, TestMode.MOCK_TEST);

        Map<String, Object> projPart1 = getPart(projected, 0, 0);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> flatQuestions = (List<Map<String, Object>>) projPart1.get("questions");
        assertThat(flatQuestions).hasSize(1);
        Map<String, Object> projFlatQ1 = flatQuestions.get(0);
        assertThat(projFlatQ1).doesNotContainKeys("transcript", "answer_clue");
        assertThat(projFlatQ1.get("question_text")).isEqualTo("Question 1");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> flatOptions = (List<Map<String, Object>>) projFlatQ1.get("options");
        assertThat(flatOptions).extracting(o -> o.get("text")).containsExactly("", "");

        // The grouped copy is redacted as well (unchanged behaviour).
        assertThat(getQuestion(projected, 0, 0, 0).get("question_text")).isEqualTo("Question 1");

        String json = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(projected);
        assertThat(json).doesNotContain("Secret");

        // Immutability: the persisted snapshot is never mutated.
        assertThat(flatQ1.get("question_text")).isEqualTo("Secret flat question text");
        assertThat(flatQ1).containsKey("transcript");
    }

    @Test
    @DisplayName("Legacy snapshot without TOEIC code/type is preserved without projection")
    void project_legacySnapshot_withoutToeicCode_returnsUnchanged() {
        Map<String, Object> legacySnapshot = new LinkedHashMap<>();
        legacySnapshot.put("id", 999);
        legacySnapshot.put("title", "Old Exam Without Code");
        legacySnapshot.put("sections", List.of());

        Map<String, Object> result = ToeicWorkspaceProjection.project(legacySnapshot, TestMode.MOCK_TEST);

        assertThat(result).isEqualTo(legacySnapshot);
    }

    @Test
    @DisplayName("Non-TOEIC exam like IELTS is preserved without projection")
    void project_ieltsExam_returnsUnchanged() {
        Map<String, Object> ieltsSnapshot = new LinkedHashMap<>();
        ieltsSnapshot.put("id", 100);
        ieltsSnapshot.put("code", "IELTS-CAM-20-T1-AC");
        ieltsSnapshot.put("type", "IELTS_ACADEMIC");
        ieltsSnapshot.put("sections", List.of());

        Map<String, Object> result = ToeicWorkspaceProjection.project(ieltsSnapshot, TestMode.MOCK_TEST);

        assertThat(result).isEqualTo(ieltsSnapshot);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Helper methods
    // ─────────────────────────────────────────────────────────────────────────────

    private Map<String, Object> buildSampleToeicSnapshot() {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("id", 1);
        snapshot.put("code", "TOEIC-ETS-2024-T1-V1");
        snapshot.put("type", "TOEIC_LR");

        // Part 1: q_001
        Map<String, Object> q1 = new LinkedHashMap<>();
        q1.put("question_id", "q_001");
        q1.put("question_text", "Question 1");
        q1.put("options", List.of(
                new LinkedHashMap<>(Map.of("id", "A", "text", "")),
                new LinkedHashMap<>(Map.of("id", "B", "text", ""))
        ));

        Map<String, Object> p1Group = new LinkedHashMap<>();
        p1Group.put("questions", List.of(q1));

        Map<String, Object> part1 = new LinkedHashMap<>();
        part1.put("id", 101);
        part1.put("part_number", 1);
        part1.put("question_groups", List.of(p1Group));

        // Part 2: q_007
        Map<String, Object> q7 = new LinkedHashMap<>();
        q7.put("question_id", "q_007");
        q7.put("question_text", "Question 7");
        q7.put("options", List.of(
                new LinkedHashMap<>(Map.of("id", "A", "text", "")),
                new LinkedHashMap<>(Map.of("id", "B", "text", ""))
        ));

        Map<String, Object> p2Group = new LinkedHashMap<>();
        p2Group.put("questions", List.of(q7));

        Map<String, Object> part2 = new LinkedHashMap<>();
        part2.put("id", 102);
        part2.put("part_number", 2);
        part2.put("question_groups", List.of(p2Group));

        // Part 3: q_032
        Map<String, Object> q32 = new LinkedHashMap<>();
        q32.put("question_id", "q_032");
        q32.put("question_text", "Question 32 What event does the woman mention?");
        q32.put("options", List.of(
                new LinkedHashMap<>(Map.of("id", "A", "text", "A company picnic")),
                new LinkedHashMap<>(Map.of("id", "B", "text", "A conference"))
        ));

        Map<String, Object> p3Group = new LinkedHashMap<>();
        p3Group.put("questions", List.of(q32));

        Map<String, Object> part3 = new LinkedHashMap<>();
        part3.put("id", 103);
        part3.put("part_number", 3);
        part3.put("question_groups", List.of(p3Group));

        Map<String, Object> listeningSection = new LinkedHashMap<>();
        listeningSection.put("id", 10);
        listeningSection.put("name", "LISTENING");
        listeningSection.put("parts", List.of(part1, part2, part3));

        snapshot.put("sections", List.of(listeningSection));
        return snapshot;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getGroup(Map<String, Object> snapshot, int sectionIdx, int partIdx) {
        List<Map<String, Object>> sections = (List<Map<String, Object>>) snapshot.get("sections");
        List<Map<String, Object>> parts = (List<Map<String, Object>>) sections.get(sectionIdx).get("parts");
        List<Map<String, Object>> groups = (List<Map<String, Object>>) parts.get(partIdx).get("question_groups");
        return groups.get(0);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getPart(Map<String, Object> snapshot, int sectionIdx, int partIdx) {
        List<Map<String, Object>> sections = (List<Map<String, Object>>) snapshot.get("sections");
        List<Map<String, Object>> parts = (List<Map<String, Object>>) sections.get(sectionIdx).get("parts");
        return parts.get(partIdx);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getQuestion(Map<String, Object> snapshot, int sectionIdx, int partIdx, int qIdx) {
        List<Map<String, Object>> sections = (List<Map<String, Object>>) snapshot.get("sections");
        List<Map<String, Object>> parts = (List<Map<String, Object>>) sections.get(sectionIdx).get("parts");
        List<Map<String, Object>> groups = (List<Map<String, Object>>) parts.get(partIdx).get("question_groups");
        List<Map<String, Object>> questions = (List<Map<String, Object>>) groups.get(0).get("questions");
        return questions.get(qIdx);
    }
}
