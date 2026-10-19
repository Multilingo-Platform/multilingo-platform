package com.multilingo.backend.modules.testing.ai.grading;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WritingDiffBuilderTest {

    @Test
    @DisplayName("Should produce single EQUAL segment when corrections list is empty and essay is not empty")
    void build_noCorrections_returnsSingleEqualSegment() {
        String original = "This is a clean essay.";
        List<WritingGrade.Correction> corrections = List.of();

        List<WritingGrade.DiffSegment> diff = WritingDiffBuilder.build(original, corrections);

        assertThat(diff).hasSize(1);
        assertThat(diff.getFirst().type()).isEqualTo(WritingGrade.DiffType.EQUAL);
        assertThat(diff.getFirst().text()).isEqualTo(original);
        assertThat(WritingDiffBuilder.joinWithoutInsert(diff)).isEqualTo(original);
        assertThat(WritingDiffBuilder.joinWithoutDelete(diff)).isEqualTo(original);
    }

    @Test
    @DisplayName("Should produce empty diff when original essay and corrections are empty")
    void build_emptyOriginalAndCorrections_returnsEmptyDiff() {
        List<WritingGrade.DiffSegment> diff = WritingDiffBuilder.build("", List.of());
        assertThat(diff).isEmpty();
        assertThat(WritingDiffBuilder.joinWithoutInsert(diff)).isEmpty();
        assertThat(WritingDiffBuilder.joinWithoutDelete(diff)).isEmpty();
    }

    @Test
    @DisplayName("Should produce valid diff for pure replacement")
    void build_singleReplacement_producesEqualDeleteInsertEqual() {
        String original = "He go to school.";
        // Replace "go" (index 3 to 5) with "goes"
        List<WritingGrade.Correction> corrections = List.of(
                new WritingGrade.Correction(3, 5, "goes", "Subject-verb agreement")
        );

        List<WritingGrade.DiffSegment> diff = WritingDiffBuilder.build(original, corrections);

        assertThat(diff).hasSize(4);
        assertThat(diff.get(0)).isEqualTo(new WritingGrade.DiffSegment(WritingGrade.DiffType.EQUAL, "He "));
        assertThat(diff.get(1)).isEqualTo(new WritingGrade.DiffSegment(WritingGrade.DiffType.DELETE, "go"));
        assertThat(diff.get(2)).isEqualTo(new WritingGrade.DiffSegment(WritingGrade.DiffType.INSERT, "goes"));
        assertThat(diff.get(3)).isEqualTo(new WritingGrade.DiffSegment(WritingGrade.DiffType.EQUAL, " to school."));

        assertThat(WritingDiffBuilder.joinWithoutInsert(diff)).isEqualTo("He go to school.");
        assertThat(WritingDiffBuilder.joinWithoutDelete(diff)).isEqualTo("He goes to school.");
    }

    @Test
    @DisplayName("Should produce valid diff for pure insertion (start == end)")
    void build_singleInsertion_producesEqualInsertEqual() {
        String original = "He went school.";
        // Insert "to " at index 8
        List<WritingGrade.Correction> corrections = List.of(
                new WritingGrade.Correction(8, 8, "to ", "Missing preposition")
        );

        List<WritingGrade.DiffSegment> diff = WritingDiffBuilder.build(original, corrections);

        assertThat(diff).hasSize(3);
        assertThat(diff.get(0)).isEqualTo(new WritingGrade.DiffSegment(WritingGrade.DiffType.EQUAL, "He went "));
        assertThat(diff.get(1)).isEqualTo(new WritingGrade.DiffSegment(WritingGrade.DiffType.INSERT, "to "));
        assertThat(diff.get(2)).isEqualTo(new WritingGrade.DiffSegment(WritingGrade.DiffType.EQUAL, "school."));

        assertThat(WritingDiffBuilder.joinWithoutInsert(diff)).isEqualTo("He went school.");
        assertThat(WritingDiffBuilder.joinWithoutDelete(diff)).isEqualTo("He went to school.");
    }

    @Test
    @DisplayName("Should produce valid diff for pure deletion (empty replacement)")
    void build_singleDeletion_producesEqualDeleteEqual() {
        String original = "He went to the school.";
        // Delete "the " (index 11 to 15)
        List<WritingGrade.Correction> corrections = List.of(
                new WritingGrade.Correction(11, 15, "", "Unnecessary article")
        );

        List<WritingGrade.DiffSegment> diff = WritingDiffBuilder.build(original, corrections);

        assertThat(diff).hasSize(3);
        assertThat(diff.get(0)).isEqualTo(new WritingGrade.DiffSegment(WritingGrade.DiffType.EQUAL, "He went to "));
        assertThat(diff.get(1)).isEqualTo(new WritingGrade.DiffSegment(WritingGrade.DiffType.DELETE, "the "));
        assertThat(diff.get(2)).isEqualTo(new WritingGrade.DiffSegment(WritingGrade.DiffType.EQUAL, "school."));

        assertThat(WritingDiffBuilder.joinWithoutInsert(diff)).isEqualTo("He went to the school.");
        assertThat(WritingDiffBuilder.joinWithoutDelete(diff)).isEqualTo("He went to school.");
    }

    @Test
    @DisplayName("Should handle multiple non-overlapping sequential corrections")
    void build_multipleSequentialCorrections_reproducesBothOriginalAndCorrected() {
        String original = "They is very happy and they works hard.";
        // 1. replace "is" (5..7) -> "are"
        // 2. replace "works" (28..33) -> "work"
        List<WritingGrade.Correction> corrections = List.of(
                new WritingGrade.Correction(5, 7, "are", "Agreement with plural subject"),
                new WritingGrade.Correction(28, 33, "work", "Plural verb agreement")
        );

        List<WritingGrade.DiffSegment> diff = WritingDiffBuilder.build(original, corrections);

        assertThat(WritingDiffBuilder.joinWithoutInsert(diff)).isEqualTo(original);
        assertThat(WritingDiffBuilder.joinWithoutDelete(diff)).isEqualTo("They are very happy and they work hard.");
    }

    @Test
    @DisplayName("Should reject overlapping corrections")
    void build_overlappingCorrections_throwsException() {
        String original = "Hello world";
        List<WritingGrade.Correction> corrections = List.of(
                new WritingGrade.Correction(0, 5, "Hi", "Greeting"),
                new WritingGrade.Correction(3, 8, "there", "Overlap")
        );

        assertThatThrownBy(() -> WritingDiffBuilder.build(original, corrections))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("overlap");
    }

    @Test
    @DisplayName("Should reject out of order corrections")
    void build_unsortedCorrections_throwsException() {
        String original = "Hello world";
        List<WritingGrade.Correction> corrections = List.of(
                new WritingGrade.Correction(6, 11, "everyone", "Noun"),
                new WritingGrade.Correction(0, 5, "Hi", "Greeting")
        );

        assertThatThrownBy(() -> WritingDiffBuilder.build(original, corrections))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Should reject offsets exceeding original string bounds")
    void build_outOfBoundsOffsets_throwsException() {
        String original = "Hello";
        List<WritingGrade.Correction> corrections = List.of(
                new WritingGrade.Correction(0, 10, "Hi", "Out of bounds")
        );

        assertThatThrownBy(() -> WritingDiffBuilder.build(original, corrections))
                .isInstanceOf(IndexOutOfBoundsException.class);
    }

    @Test
    @DisplayName("Should reject correction that cuts surrogate pair")
    void build_surrogateCut_throwsException() {
        // String containing emoji (surrogate pair)
        String original = "A😀B"; // 'A' (index 0), emoji (indices 1, 2), 'B' (index 3)
        // Attempt to start inside surrogate pair at index 2
        List<WritingGrade.Correction> corrections = List.of(
                new WritingGrade.Correction(2, 3, "X", "Cuts surrogate pair")
        );

        assertThatThrownBy(() -> WritingDiffBuilder.build(original, corrections))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("surrogate");
    }
}
