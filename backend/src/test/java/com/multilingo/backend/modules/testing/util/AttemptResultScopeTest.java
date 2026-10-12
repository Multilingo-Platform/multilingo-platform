package com.multilingo.backend.modules.testing.util;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AttemptResultScopeTest {

    @Test
    @DisplayName("Should extract parts and questions from questionGroups (camelCase)")
    void read_withCamelCaseQuestionGroups() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Reading",
                                "parts", List.of(
                                        Map.of(
                                                "id", 1,
                                                "title", "Passage 1",
                                                "questionGroups", List.of(
                                                        Map.of(
                                                                "questions", List.of(
                                                                        Map.of("id", "q1", "type", "SINGLE_CHOICE"),
                                                                        Map.of("id", "q2", "type", "TRUE_FALSE_NOT_GIVEN")
                                                                )
                                                        )
                                                )
                                        )
                                )
                        )
                )
        );

        List<AttemptResultScope.ScopedPart> parts = AttemptResultScope.read(snapshot);

        assertThat(parts).hasSize(1);
        AttemptResultScope.ScopedPart p1 = parts.get(0);
        assertThat(p1.getPartId()).isEqualTo(1);
        assertThat(p1.getLabel()).isEqualTo("Passage 1");
        assertThat(p1.getSkill()).isEqualTo("READING");
        assertThat(p1.getQuestions()).hasSize(2);
        assertThat(p1.getQuestions().get(0).getQuestionId()).isEqualTo("q1");
        assertThat(p1.getQuestions().get(0).getType()).isEqualTo("SINGLE_CHOICE");
        assertThat(p1.getQuestions().get(0).isObjective()).isTrue();
    }

    @Test
    @DisplayName("Should extract parts and questions from canonical question_groups (snake_case)")
    void read_withSnakeCaseQuestionGroups() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Listening",
                                "parts", List.of(
                                        Map.of(
                                                "id", 2,
                                                "partTitle", "Part 2 Audio",
                                                "question_groups", List.of(
                                                        Map.of(
                                                                "questions", List.of(
                                                                        Map.of("id", "q3", "type", "FILL_IN_THE_BLANK")
                                                                )
                                                        )
                                                )
                                        )
                                )
                        )
                )
        );

        List<AttemptResultScope.ScopedPart> parts = AttemptResultScope.read(snapshot);

        assertThat(parts).hasSize(1);
        AttemptResultScope.ScopedPart p2 = parts.get(0);
        assertThat(p2.getPartId()).isEqualTo(2);
        assertThat(p2.getLabel()).isEqualTo("Part 2 Audio");
        assertThat(p2.getSkill()).isEqualTo("LISTENING");
        assertThat(p2.getQuestions()).hasSize(1);
        assertThat(p2.getQuestions().get(0).getQuestionId()).isEqualTo("q3");
    }

    @Test
    @DisplayName("Should fallback to legacy flat questions when no questionGroups are present")
    void read_fallbackToLegacyFlatQuestions() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Writing",
                                "parts", List.of(
                                        Map.of(
                                                "id", 3,
                                                "questions", List.of(
                                                        Map.of("id", "essay_1", "type", "ESSAY")
                                                )
                                        )
                                )
                        )
                )
        );

        List<AttemptResultScope.ScopedPart> parts = AttemptResultScope.read(snapshot);

        assertThat(parts).hasSize(1);
        AttemptResultScope.ScopedPart p3 = parts.get(0);
        assertThat(p3.getLabel()).isEqualTo("Part 3"); // fallback label
        assertThat(p3.getSkill()).isEqualTo("WRITING");
        assertThat(p3.getQuestions()).hasSize(1);
        assertThat(p3.getQuestions().get(0).isObjective()).isFalse();
    }

    @Test
    @DisplayName("Should prefer groups and not double count when both groups and flat questions exist")
    void read_preferGroups_doNotDoubleCountFlatQuestions() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Reading",
                                "parts", List.of(
                                        Map.of(
                                                "id", 1,
                                                "title", "Reading Part",
                                                "questionGroups", List.of(
                                                        Map.of(
                                                                "questions", List.of(
                                                                        Map.of("id", "q1", "type", "SINGLE_CHOICE")
                                                                )
                                                        )
                                                ),
                                                "questions", List.of(
                                                        Map.of("id", "q1", "type", "SINGLE_CHOICE") // flattened legacy
                                                )
                                        )
                                )
                        )
                )
        );

        List<AttemptResultScope.ScopedPart> parts = AttemptResultScope.read(snapshot);

        assertThat(parts.get(0).getQuestions()).hasSize(1);
    }

    @Test
    @DisplayName("Should use UNKNOWN skill when section name is null or blank")
    void read_unknownSkill() {
        Map<String, Object> snapshot = new HashMap<>();
        Map<String, Object> section = new HashMap<>();
        section.put("name", "   ");
        section.put("parts", List.of(
                Map.of(
                        "id", 1,
                        "questions", List.of(
                                Map.of("id", "q1", "type", "SINGLE_CHOICE")
                        )
                )
        ));
        snapshot.put("sections", List.of(section));

        List<AttemptResultScope.ScopedPart> parts = AttemptResultScope.read(snapshot);

        assertThat(parts.get(0).getSkill()).isEqualTo("UNKNOWN");
    }

    @Test
    @DisplayName("Should reject malformed snapshot structures or missing IDs")
    void read_rejectMalformedStructures() {
        // null snapshot
        assertThatThrownBy(() -> AttemptResultScope.read(null))
                .isInstanceOf(AppException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.GRADING_DATA_ERROR);

        // sections missing
        assertThatThrownBy(() -> AttemptResultScope.read(Map.of()))
                .isInstanceOf(AppException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.GRADING_DATA_ERROR);

        // part id missing
        Map<String, Object> invalidPart = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Reading",
                                "parts", List.of(
                                        Map.of("title", "No ID")
                                )
                        )
                )
        );
        assertThatThrownBy(() -> AttemptResultScope.read(invalidPart))
                .isInstanceOf(AppException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.GRADING_DATA_ERROR);

        // duplicate part id
        Map<String, Object> duplicatePart = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Reading",
                                "parts", List.of(
                                        Map.of("id", 1, "questions", List.of()),
                                        Map.of("id", 1, "questions", List.of())
                                )
                        )
                )
        );
        assertThatThrownBy(() -> AttemptResultScope.read(duplicatePart))
                .isInstanceOf(AppException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.GRADING_DATA_ERROR);

        // question missing type
        Map<String, Object> missingType = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Reading",
                                "parts", List.of(
                                        Map.of("id", 1, "questions", List.of(Map.of("id", "q1")))
                                )
                        )
                )
        );
        assertThatThrownBy(() -> AttemptResultScope.read(missingType))
                .isInstanceOf(AppException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.GRADING_DATA_ERROR);
    }

    @Test
    @DisplayName("P1 Regression: Allow same question ID in different parts of the same exam snapshot")
    void read_allowSameQuestionIdInDifferentParts() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Reading",
                                "parts", List.of(
                                        Map.of(
                                                "id", 1,
                                                "title", "Part 1",
                                                "questions", List.of(
                                                        Map.of("id", "q1", "type", "SINGLE_CHOICE")
                                                )
                                        ),
                                        Map.of(
                                                "id", 2,
                                                "title", "Part 2",
                                                "questions", List.of(
                                                        Map.of("id", "q1", "type", "SINGLE_CHOICE")
                                                )
                                        )
                                )
                        )
                )
        );

        List<AttemptResultScope.ScopedPart> parts = AttemptResultScope.read(snapshot);
        assertThat(parts).hasSize(2);
        assertThat(parts.get(0).getQuestions().get(0).getQuestionId()).isEqualTo("q1");
        assertThat(parts.get(1).getQuestions().get(0).getQuestionId()).isEqualTo("q1");
    }

    @Test
    @DisplayName("P1 Regression: Reject duplicate question ID within the same part across groups")
    void read_rejectDuplicateQuestionIdWithinSamePart() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Reading",
                                "parts", List.of(
                                        Map.of(
                                                "id", 1,
                                                "title", "Part 1",
                                                "questionGroups", List.of(
                                                        Map.of("questions", List.of(Map.of("id", "q1", "type", "SINGLE_CHOICE"))),
                                                        Map.of("questions", List.of(Map.of("id", "q1", "type", "SINGLE_CHOICE")))
                                                )
                                        )
                                )
                        )
                )
        );

        assertThatThrownBy(() -> AttemptResultScope.read(snapshot))
                .isInstanceOf(AppException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.GRADING_DATA_ERROR);
    }

    @Test
    @DisplayName("P2 Regression: Reject non-integer, overflow, zero, or negative part ID")
    void read_rejectNonIntegerOrOverflowOrNegativePartId() {
        // Floating point 1.5
        Map<String, Object> fractionalPart = Map.of(
                "sections", List.of(
                        Map.of("name", "Reading", "parts", List.of(Map.of("id", 1.5, "questions", List.of(Map.of("id", "q1", "type", "SINGLE_CHOICE")))))
                )
        );
        assertThatThrownBy(() -> AttemptResultScope.read(fractionalPart))
                .isInstanceOf(AppException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.GRADING_DATA_ERROR);

        // Long overflow 4294967297L
        Map<String, Object> overflowPart = Map.of(
                "sections", List.of(
                        Map.of("name", "Reading", "parts", List.of(Map.of("id", 4294967297L, "questions", List.of(Map.of("id", "q1", "type", "SINGLE_CHOICE")))))
                )
        );
        assertThatThrownBy(() -> AttemptResultScope.read(overflowPart))
                .isInstanceOf(AppException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.GRADING_DATA_ERROR);

        // Zero
        Map<String, Object> zeroPart = Map.of(
                "sections", List.of(
                        Map.of("name", "Reading", "parts", List.of(Map.of("id", 0, "questions", List.of(Map.of("id", "q1", "type", "SINGLE_CHOICE")))))
                )
        );
        assertThatThrownBy(() -> AttemptResultScope.read(zeroPart))
                .isInstanceOf(AppException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.GRADING_DATA_ERROR);

        // Negative
        Map<String, Object> negativePart = Map.of(
                "sections", List.of(
                        Map.of("name", "Reading", "parts", List.of(Map.of("id", -1, "questions", List.of(Map.of("id", "q1", "type", "SINGLE_CHOICE")))))
                )
        );
        assertThatThrownBy(() -> AttemptResultScope.read(negativePart))
                .isInstanceOf(AppException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.GRADING_DATA_ERROR);
    }

    @Test
    @DisplayName("P1 Regression: Non-string metadata objects are ignored and safely fallback instead of being stringified into labels/skills")
    void read_nonStringMetadataObjects_safeFallback() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", Map.of("secret_key", "SECRET_SKILL_TOKEN"), // object skill
                                "parts", List.of(
                                        Map.of(
                                                "id", 1,
                                                "title", Map.of("correct_answer", "SECRET_ANSWER_KEY"), // object title
                                                "questions", List.of(
                                                        Map.of(
                                                                "id", "q1",
                                                                "type", "SINGLE_CHOICE",
                                                                "title", Map.of("secret_prompt", "SECRET_PROMPT") // object question title
                                                        )
                                                )
                                        )
                                )
                        )
                )
        );

        List<AttemptResultScope.ScopedPart> parts = AttemptResultScope.read(snapshot);
        assertThat(parts).hasSize(1);
        AttemptResultScope.ScopedPart p1 = parts.get(0);
        assertThat(p1.getSkill()).isEqualTo("UNKNOWN");
        assertThat(p1.getLabel()).isEqualTo("Part 1"); // Safe fallback, no stringified map
        assertThat(p1.getLabel()).doesNotContain("SECRET_ANSWER_KEY");
        assertThat(p1.getQuestions().get(0).getLabel()).isNull(); // Safe fallback, no stringified map
    }
}

