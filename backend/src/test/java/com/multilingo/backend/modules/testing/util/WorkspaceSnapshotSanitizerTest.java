package com.multilingo.backend.modules.testing.util;

import org.junit.jupiter.api.Test;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

class WorkspaceSnapshotSanitizerTest {

    @Test
    void sanitize_nullSnapshot_returnsEmptyMap() {
        Map<String, Object> result = WorkspaceSnapshotSanitizer.sanitize(null);
        assertThat(result).isNotNull();
        assertThat(result).isEmpty();
    }

    @Test
    void sanitize_nestedThreeLevels_removesSnakeAndCamelBlacklistedKeys_whilePreservingOtherFields() {
        // Arrange: 3-4 nested levels with snake_case and camelCase private keys
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("id", "q_1");
        question.put("prompt", "Choose the best answer");
        question.put("options", List.of("A", "B", "C", "D"));
        question.put("unknown_public_field", "public_value");
        // Blacklisted keys at question level
        question.put("correct_answer", "A");
        question.put("correctAnswer", "A");
        question.put("explanation", "Because A is right");
        question.put("ai_prompt_context", "context 1");
        question.put("aiPromptContext", "context 2");
        question.put("ai_feedback", Map.of("score", 10));
        question.put("aiFeedback", Map.of("score", 10));
        question.put("feedback", "Good job");
        question.put("grading_key", "k1");
        question.put("gradingKey", "k1");
        question.put("grading_keys", List.of("k1", "k2"));
        question.put("gradingKeys", List.of("k1", "k2"));
        question.put("is_correct_flags", Map.of("q_1", true));
        question.put("isCorrectFlags", Map.of("q_1", true));
        question.put("earned_score", 1.0);
        question.put("earnedScore", 1.0);
        question.put("skill_stats", Map.of("listening", 100));
        question.put("skillStats", Map.of("listening", 100));
        question.put("accepted_answers", List.of("A"));
        question.put("acceptedAnswers", List.of("A"));

        Map<String, Object> part = new LinkedHashMap<>();
        part.put("id", 10);
        part.put("instruction", "Listen and answer");
        part.put("media", Map.of("audioUrl", "https://audio.mp3"));
        part.put("groups", List.of(Map.of("id", "g1", "name", "Group 1")));
        part.put("questions", List.of(question));
        // Blacklisted key at part level
        part.put("grading_key", "part_key");

        Map<String, Object> section = new LinkedHashMap<>();
        section.put("id", 100);
        section.put("name", "Listening");
        section.put("parts", List.of(part));
        // Blacklisted key at section level
        section.put("explanation", "Section explanation");

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("id", 1);
        snapshot.put("title", "IELTS Mock 1");
        snapshot.put("sections", List.of(section));

        // Act
        Map<String, Object> sanitized = WorkspaceSnapshotSanitizer.sanitize(snapshot);

        // Assert: top level preserved
        assertThat(sanitized.get("id")).isEqualTo(1);
        assertThat(sanitized.get("title")).isEqualTo("IELTS Mock 1");
        assertThat(sanitized).containsKey("sections");

        // Section level preserved, blacklisted removed
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> sections = (List<Map<String, Object>>) sanitized.get("sections");
        assertThat(sections).hasSize(1);
        Map<String, Object> s0 = sections.getFirst();
        assertThat(s0.get("name")).isEqualTo("Listening");
        assertThat(s0).doesNotContainKey("explanation");

        // Part level preserved, blacklisted removed
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> parts = (List<Map<String, Object>>) s0.get("parts");
        assertThat(parts).hasSize(1);
        Map<String, Object> p0 = parts.getFirst();
        assertThat(p0.get("instruction")).isEqualTo("Listen and answer");
        assertThat(p0.get("media")).isEqualTo(Map.of("audioUrl", "https://audio.mp3"));
        assertThat(p0.get("groups")).isNotNull();
        assertThat(p0).doesNotContainKey("grading_key");

        // Question level preserved, blacklisted removed
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> questions = (List<Map<String, Object>>) p0.get("questions");
        assertThat(questions).hasSize(1);
        Map<String, Object> q0 = questions.getFirst();
        assertThat(q0.get("id")).isEqualTo("q_1");
        assertThat(q0.get("prompt")).isEqualTo("Choose the best answer");
        assertThat(q0.get("options")).isEqualTo(List.of("A", "B", "C", "D"));
        assertThat(q0.get("unknown_public_field")).isEqualTo("public_value");

        assertThat(q0).doesNotContainKeys(
                "correct_answer", "correctAnswer",
                "explanation",
                "ai_prompt_context", "aiPromptContext",
                "ai_feedback", "aiFeedback",
                "feedback",
                "grading_key", "gradingKey",
                "grading_keys", "gradingKeys",
                "is_correct_flags", "isCorrectFlags",
                "earned_score", "earnedScore",
                "skill_stats", "skillStats",
                "accepted_answers", "acceptedAnswers"
        );
    }

    @Test
    void sanitize_doesNotMutateSourceMap() {
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("id", "q_1");
        question.put("correct_answer", "A");
        question.put("explanation", "Secret reasoning");

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("questions", List.of(question));

        Map<String, Object> sanitized = WorkspaceSnapshotSanitizer.sanitize(snapshot);

        // Sanitize returned map does not have blacklisted keys
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> sanitizedQuestions = (List<Map<String, Object>>) sanitized.get("questions");
        assertThat(sanitizedQuestions.getFirst()).doesNotContainKeys("correct_answer", "explanation");

        // Original source map still contains all blacklisted keys intact
        assertThat(question).containsKey("correct_answer");
        assertThat(question).containsKey("explanation");
    }

    @Test
    void sanitize_preservesTextValuesContainingBlacklistedWords() {
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("id", "q_2");
        question.put("prompt", "Please write an explanation and give feedback on correct_answer");
        question.put("correct_answer", "A");

        Map<String, Object> snapshot = Map.of("question", question);

        Map<String, Object> sanitized = WorkspaceSnapshotSanitizer.sanitize(snapshot);

        @SuppressWarnings("unchecked")
        Map<String, Object> sanitizedQ = (Map<String, Object>) sanitized.get("question");
        assertThat(sanitizedQ.get("prompt"))
                .isEqualTo("Please write an explanation and give feedback on correct_answer");
        assertThat(sanitizedQ).doesNotContainKey("correct_answer");
    }
}
