package com.multilingo.backend.modules.testing.util;

import com.multilingo.backend.modules.testing.grading.dto.GradingKey;
import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class SnapshotGradingKeyExtractorTest {

    @Test
    void enablesNfcComparisonOnlyForSnapshotsWithTheLanguagePolicyStamp() {
        Map<String, Object> question = Map.of("question_id", "q", "type", "FILL_IN_THE_BLANK", "correct_answer", "café");
        Map<String, Object> part = Map.of("id", 1, "questions", List.of(question));
        Map<String, Object> section = Map.of("name", "READING", "parts", List.of(part));
        Map<String, Object> legacy = Map.of("sections", List.of(section));
        Map<String, Object> current = Map.of("languagePolicyVersion", "TV3_LANG_V1", "sections", List.of(section));

        assertThat(SnapshotGradingKeyExtractor.extractFromSnapshot(legacy).get(1).getAnswers().get("q").isNormalizeNfc()).isFalse();
        assertThat(SnapshotGradingKeyExtractor.extractFromSnapshot(current).get(1).getAnswers().get("q").isNormalizeNfc()).isTrue();
    }

    @Test
    void extractFromSnapshot_extractsGradingKeysDirectlyFromSnapshot() {
        Map<String, Object> q1 = new LinkedHashMap<>();
        q1.put("question_id", "q_1");
        q1.put("type", "SINGLE_CHOICE");
        q1.put("correct_answer", "A");

        Map<String, Object> q2 = new LinkedHashMap<>();
        q2.put("question_id", "q_2");
        q2.put("type", "FILL_IN_THE_BLANK");
        q2.put("correct_answer", "plasticity");
        q2.put("alternates", List.of("neuroplasticity", "neural plasticity"));

        Map<String, Object> essay = new LinkedHashMap<>();
        essay.put("question_id", "q_essay");
        essay.put("type", "ESSAY");

        Map<String, Object> part = new LinkedHashMap<>();
        part.put("id", 101);
        part.put("title", "Part 1");
        part.put("questions", List.of(q1, q2, essay));

        Map<String, Object> section = new LinkedHashMap<>();
        section.put("id", 1);
        section.put("name", "READING");
        section.put("parts", List.of(part));

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("id", 10);
        snapshot.put("title", "Exam 10");
        snapshot.put("sections", List.of(section));

        Map<Integer, PartGradingKey> result = SnapshotGradingKeyExtractor.extractFromSnapshot(snapshot);

        assertThat(result).containsKey(101);
        PartGradingKey pgk = result.get(101);
        assertThat(pgk.getPartId()).isEqualTo(101);
        assertThat(pgk.getSectionName()).isEqualTo("READING");

        Map<String, GradingKey> answers = pgk.getAnswers();
        assertThat(answers).hasSize(2); // q_1 and q_2, ESSAY is skipped

        GradingKey key1 = answers.get("q_1");
        assertThat(key1.getQuestionId()).isEqualTo("q_1");
        assertThat(key1.getType()).isEqualTo("SINGLE_CHOICE");
        assertThat(key1.getCorrect()).isEqualTo("A");

        GradingKey key2 = answers.get("q_2");
        assertThat(key2.getQuestionId()).isEqualTo("q_2");
        assertThat(key2.getType()).isEqualTo("FILL_IN_THE_BLANK");
        assertThat(key2.getCorrect()).isEqualTo("plasticity");
        assertThat(key2.getAlternates()).containsExactly("neuroplasticity", "neural plasticity");
    }

    @Test
    void extractFromSnapshot_resolvesMatchingHeadingsOptionsFromSnapshot() {
        Map<String, Object> optI = Map.of("id", "i", "text", "The first heading");
        Map<String, Object> optII = Map.of("id", "ii", "text", "The second heading");

        Map<String, Object> qHeading = new LinkedHashMap<>();
        qHeading.put("question_id", "q_heading_1");
        qHeading.put("type", "MATCHING_HEADINGS");
        qHeading.put("correct_answer", "i");
        qHeading.put("options", List.of(optI, optII));

        Map<String, Object> part = new LinkedHashMap<>();
        part.put("id", 202);
        part.put("questions", List.of(qHeading));

        Map<String, Object> section = new LinkedHashMap<>();
        section.put("name", "READING");
        section.put("parts", List.of(part));

        Map<String, Object> snapshot = Map.of("sections", List.of(section));

        Map<Integer, PartGradingKey> result = SnapshotGradingKeyExtractor.extractFromSnapshot(snapshot);
        assertThat(result).containsKey(202);

        GradingKey key = result.get(202).getAnswers().get("q_heading_1");
        assertThat(key.getCorrect()).isEqualTo("i");
        // alternates should include the heading text
        assertThat(key.getAlternates()).contains("The first heading");
    }

    @Test
    void extractFromSnapshotPreservesPairedAnswerMetadataForBothMembers() {
        Map<String, Object> pair = Map.of("id", "listening-17-18", "mode", "DISTINCT_UNORDERED",
                "question_ids", List.of("l_017", "l_018"));
        Map<String, Object> first = new LinkedHashMap<>(Map.of("question_id", "l_017", "type", "SINGLE_CHOICE",
                "correct_answer", List.of("A", "E"), "answer_group", pair));
        Map<String, Object> second = new LinkedHashMap<>(Map.of("question_id", "l_018", "type", "SINGLE_CHOICE",
                "correct_answer", List.of("A", "E"), "answer_group", pair));
        Map<String, Object> part = Map.of("id", 501, "questions", List.of(first, second));
        Map<String, Object> snapshot = Map.of("sections", List.of(Map.of("name", "LISTENING", "parts", List.of(part))));

        var keys = SnapshotGradingKeyExtractor.extractFromSnapshot(snapshot).get(501).getAnswers();

        assertThat(keys.get("l_017").getAnswerGroup()).isEqualTo(keys.get("l_018").getAnswerGroup());
        assertThat(keys.get("l_017").getAnswerGroup().questionIds()).containsExactly("l_017", "l_018");
    }

    @Test
    void extractFromSnapshotRejectsMalformedPairedAnswerMetadata() {
        Map<String, Object> question = Map.of("question_id", "l_017", "type", "SINGLE_CHOICE",
                "correct_answer", List.of("A", "E"), "answer_group", Map.of("id", "pair", "mode", "DISTINCT_UNORDERED",
                        "question_ids", List.of("l_017", "l_018", "l_019")));
        Map<String, Object> part = Map.of("id", 502, "questions", List.of(question));
        Map<String, Object> snapshot = Map.of("sections", List.of(Map.of("parts", List.of(part))));

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> SnapshotGradingKeyExtractor.extractFromSnapshot(snapshot))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void extractFromSnapshot_returnsEmptyMapWhenSnapshotHasNoKeys() {
        // Legacy snapshot without correct_answer
        Map<String, Object> q = Map.of("question_id", "q_1", "type", "SINGLE_CHOICE");
        Map<String, Object> part = Map.of("id", 101, "questions", List.of(q));
        Map<String, Object> section = Map.of("name", "READING", "parts", List.of(part));
        Map<String, Object> snapshot = Map.of("sections", List.of(section));

        Map<Integer, PartGradingKey> result = SnapshotGradingKeyExtractor.extractFromSnapshot(snapshot);
        assertThat(result).isEmpty();
    }

    @Test
    void extractFromSnapshot_handlesNullAndMalformedSnapshotGracefully() {
        assertThat(SnapshotGradingKeyExtractor.extractFromSnapshot(null)).isEmpty();
        assertThat(SnapshotGradingKeyExtractor.extractFromSnapshot(Map.of())).isEmpty();
        assertThat(SnapshotGradingKeyExtractor.extractFromSnapshot(Map.of("sections", "not-a-list"))).isEmpty();
    }

    @Test
    void hasObjectiveQuestions_returnsFalseForWritingOnlySnapshot() {
        Map<String, Object> essay = Map.of("question_id", "essay_1", "type", "ESSAY");
        Map<String, Object> part = Map.of("id", 301, "questions", List.of(essay));
        Map<String, Object> section = Map.of("name", "WRITING", "parts", List.of(part));
        Map<String, Object> snapshot = Map.of("sections", List.of(section));

        assertThat(SnapshotGradingKeyExtractor.hasObjectiveQuestions(snapshot)).isFalse();
        assertThat(SnapshotGradingKeyExtractor.hasObjectiveQuestionsInPart(part)).isFalse();
    }

    @Test
    void hasObjectiveQuestions_returnsTrueForObjectiveOrMixedSnapshot() {
        Map<String, Object> mcq = Map.of("question_id", "mcq_1", "type", "SINGLE_CHOICE");
        Map<String, Object> part = Map.of("id", 101, "questions", List.of(mcq));
        Map<String, Object> section = Map.of("name", "READING", "parts", List.of(part));
        Map<String, Object> snapshot = Map.of("sections", List.of(section));

        assertThat(SnapshotGradingKeyExtractor.hasObjectiveQuestions(snapshot)).isTrue();
        assertThat(SnapshotGradingKeyExtractor.hasObjectiveQuestionsInPart(part)).isTrue();
    }

    @Test
    void extractFromSnapshot_extractsKeysFromQuestionMetadataWithCorrectOptionIndex() {
        Map<String, Object> qMetaOnly = new LinkedHashMap<>();
        qMetaOnly.put("question_id", "q_photo_1");
        qMetaOnly.put("type", "MULTIPLE_CHOICE");
        qMetaOnly.put("metadata", Map.of(
                "options", List.of("", "", "", ""),
                "correct_option_index", 0,
                "correct_answer", ""
        ));

        Map<String, Object> qWithText = new LinkedHashMap<>();
        qWithText.put("question_id", "q_mcq_2");
        qWithText.put("type", "MULTIPLE_CHOICE");
        qWithText.put("metadata", Map.of(
                "options", List.of("Job fair", "Cooking class", "Company picnic"),
                "correct_option_index", 2,
                "correct_answer", "Company picnic"
        ));

        Map<String, Object> group = new LinkedHashMap<>();
        group.put("questions", List.of(qMetaOnly, qWithText));

        Map<String, Object> part = new LinkedHashMap<>();
        part.put("id", 156);
        part.put("questionGroups", List.of(group));

        Map<String, Object> section = new LinkedHashMap<>();
        section.put("name", "LISTENING");
        section.put("parts", List.of(part));

        Map<String, Object> snapshot = Map.of("sections", List.of(section));

        Map<Integer, PartGradingKey> result = SnapshotGradingKeyExtractor.extractFromSnapshot(snapshot);
        assertThat(result).containsKey(156);

        PartGradingKey pgk = result.get(156);
        Map<String, GradingKey> answers = pgk.getAnswers();
        assertThat(answers).hasSize(2);

        // Photo question with empty options -> letter 'A'
        GradingKey key1 = answers.get("q_photo_1");
        assertThat(key1.getCorrect()).isEqualTo("A");

        // Question with option text and index 2 -> correct 'Company picnic', alternate 'C'
        GradingKey key2 = answers.get("q_mcq_2");
        assertThat(key2.getCorrect()).isEqualTo("Company picnic");
        assertThat(key2.getAlternates()).contains("C");
    }

    @Test
    void extractFromSnapshot_extractsSentenceEndingsWithSevenOptions() {
        List<String> endings = List.of(
                "made them feel optimistic.",
                "took relatively little notice of bad news.",
                "responded to negative and positive information in the same way.",
                "were feeling under stress.",
                "put them in a stressful situation.",
                "behaved in a similar manner, regardless of the circumstances.",
                "thought it more likely that they would experience something bad."
        );

        Map<String, Object> q31 = new LinkedHashMap<>();
        q31.put("question_id", "q_031");
        q31.put("type", "MATCHING_SENTENCE_ENDINGS");
        q31.put("question_text", "At times when they were relaxed, the firefighters usually ..............");
        q31.put("metadata", Map.of(
                "options", endings,
                "correct_option_index", 0,
                "correct_answer", "made them feel optimistic."
        ));

        Map<String, Object> group = new LinkedHashMap<>();
        group.put("questions", List.of(q31));

        Map<String, Object> part = new LinkedHashMap<>();
        part.put("id", 158);
        part.put("questionGroups", List.of(group));

        Map<String, Object> section = Map.of("name", "READING", "parts", List.of(part));
        Map<String, Object> snapshot = Map.of("sections", List.of(section));

        Map<Integer, PartGradingKey> result = SnapshotGradingKeyExtractor.extractFromSnapshot(snapshot);
        assertThat(result).containsKey(158);

        PartGradingKey pgk = result.get(158);
        GradingKey key = pgk.getAnswers().get("q_031");
        assertThat(key.getCorrect()).isEqualTo("made them feel optimistic.");
        assertThat(key.getAlternates()).contains("A");
        assertThat(key.getType()).isEqualTo("MATCHING_SENTENCE_ENDINGS");
    }

    @Test
    void hasObjectiveQuestions_handlesNullAndEmptySnapshot() {
        assertThat(SnapshotGradingKeyExtractor.hasObjectiveQuestions(null)).isFalse();
        assertThat(SnapshotGradingKeyExtractor.hasObjectiveQuestions(Map.of())).isFalse();
        assertThat(SnapshotGradingKeyExtractor.hasObjectiveQuestions(Map.of("sections", List.of()))).isFalse();
        assertThat(SnapshotGradingKeyExtractor.hasObjectiveQuestionsInPart(null)).isFalse();
    }
}
