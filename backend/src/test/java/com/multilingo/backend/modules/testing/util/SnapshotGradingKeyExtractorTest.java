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
    void hasObjectiveQuestions_handlesNullAndEmptySnapshot() {
        assertThat(SnapshotGradingKeyExtractor.hasObjectiveQuestions(null)).isFalse();
        assertThat(SnapshotGradingKeyExtractor.hasObjectiveQuestions(Map.of())).isFalse();
        assertThat(SnapshotGradingKeyExtractor.hasObjectiveQuestions(Map.of("sections", List.of()))).isFalse();
        assertThat(SnapshotGradingKeyExtractor.hasObjectiveQuestionsInPart(null)).isFalse();
    }
}
