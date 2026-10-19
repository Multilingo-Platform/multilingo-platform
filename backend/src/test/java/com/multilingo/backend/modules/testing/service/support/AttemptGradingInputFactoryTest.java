package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.grading.dto.GradingKey;
import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AttemptGradingInputFactoryTest {

    private AttemptGradingInputFactory factory;

    @BeforeEach
    void setUp() {
        factory = new AttemptGradingInputFactory();
    }

    private Map<String, Object> createSnapshot(List<Map<String, Object>> parts) {
        return Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Reading",
                                "parts", parts
                        )
                )
        );
    }

    private PartGradingKey createPartKey(int partId, String qId, String type, Object correct) {
        PartGradingKey pgk = new PartGradingKey();
        pgk.setPartId(partId);
        pgk.setSectionName("Original Section");
        GradingKey key = new GradingKey();
        key.setQuestionId(qId);
        key.setType(type);
        key.setCorrect(correct);
        pgk.setAnswers(new HashMap<>(Map.of(qId, key)));
        return pgk;
    }

    @Test
    @DisplayName("Should inject transient empty answer for untouched part")
    void prepare_withUntouchedPart_injectsTransientEmptyAnswer() {
        Map<String, Object> snapshot = createSnapshot(List.of(
                Map.of("id", 1, "title", "Part 1", "questions", List.of(Map.of("id", "q1", "type", "SINGLE_CHOICE"))),
                Map.of("id", 2, "title", "Part 2", "questions", List.of(Map.of("id", "q2", "type", "SINGLE_CHOICE")))
        ));

        AttemptAnswer saved1 = AttemptAnswer.builder().partId(1).userAnswers(Map.of("q1", "A")).build();
        List<AttemptAnswer> savedAnswers = List.of(saved1);

        Map<Integer, PartGradingKey> loadedKeys = Map.of(
                1, createPartKey(1, "q1", "SINGLE_CHOICE", "A"),
                2, createPartKey(2, "q2", "SINGLE_CHOICE", "B")
        );

        AttemptGradingInputFactory.GradingInput input = factory.prepare(snapshot, savedAnswers, loadedKeys);

        assertThat(input.getAnswers()).hasSize(2);
        AttemptAnswer ans1 = input.getAnswers().stream().filter(a -> a.getPartId() == 1).findFirst().orElseThrow();
        assertThat(ans1.getUserAnswers()).containsEntry("q1", "A");

        AttemptAnswer ans2 = input.getAnswers().stream().filter(a -> a.getPartId() == 2).findFirst().orElseThrow();
        assertThat(ans2.getId()).isNull();
        assertThat(ans2.getUserAnswers()).isEmpty();
    }

    @Test
    @DisplayName("Should filter out saved answers outside snapshot scope")
    void prepare_filtersOutSavedAnswerOutsideScope() {
        Map<String, Object> snapshot = createSnapshot(List.of(
                Map.of("id", 1, "title", "Part 1", "questions", List.of(Map.of("id", "q1", "type", "SINGLE_CHOICE")))
        ));

        AttemptAnswer saved1 = AttemptAnswer.builder().partId(1).userAnswers(Map.of("q1", "A")).build();
        AttemptAnswer savedOutside = AttemptAnswer.builder().partId(99).userAnswers(Map.of("q99", "Z")).build();
        List<AttemptAnswer> savedAnswers = List.of(saved1, savedOutside);

        Map<Integer, PartGradingKey> loadedKeys = Map.of(
                1, createPartKey(1, "q1", "SINGLE_CHOICE", "A")
        );

        AttemptGradingInputFactory.GradingInput input = factory.prepare(snapshot, savedAnswers, loadedKeys);

        assertThat(input.getAnswers()).hasSize(1);
        assertThat(input.getAnswers().get(0).getPartId()).isEqualTo(1);
    }

    @Test
    @DisplayName("Should assign section name of key according to snapshot skill")
    void prepare_setsSectionNameAccordingToSnapshotSkill() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "listening comprehension",
                                "parts", List.of(
                                        Map.of("id", 1, "questions", List.of(Map.of("id", "q1", "type", "SINGLE_CHOICE")))
                                )
                        )
                )
        );

        Map<Integer, PartGradingKey> loadedKeys = Map.of(
                1, createPartKey(1, "q1", "SINGLE_CHOICE", "A")
        );

        AttemptGradingInputFactory.GradingInput input = factory.prepare(snapshot, List.of(), loadedKeys);

        assertThat(input.getPartKeys().get(1).getSectionName()).isEqualTo("LISTENING COMPREHENSION");
    }

    @Test
    @DisplayName("Writing-only part should be processed without requiring objective key")
    void prepare_writingOnlyPart_doesNotRequireObjectiveKey() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Writing",
                                "parts", List.of(
                                        Map.of("id", 10, "questions", List.of(Map.of("id", "essay1", "type", "ESSAY")))
                                )
                        )
                )
        );

        AttemptGradingInputFactory.GradingInput input = factory.prepare(snapshot, List.of(), Map.of());

        assertThat(input.getAnswers()).hasSize(1);
        assertThat(input.getAnswers().get(0).getPartId()).isEqualTo(10);
        assertThat(input.getPartKeys()).doesNotContainKey(10);
    }

    @Test
    @DisplayName("Should throw GRADING_DATA_ERROR when key is missing for objective question")
    void prepare_missingKey_throwsError() {
        Map<String, Object> snapshot = createSnapshot(List.of(
                Map.of("id", 1, "questions", List.of(Map.of("id", "q1", "type", "SINGLE_CHOICE")))
        ));

        assertThatThrownBy(() -> factory.prepare(snapshot, List.of(), Map.of()))
                .isInstanceOf(AppException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.GRADING_DATA_ERROR);
    }

    @Test
    @DisplayName("Should throw GRADING_DATA_ERROR when key type does not match snapshot question type")
    void prepare_typeMismatch_throwsError() {
        Map<String, Object> snapshot = createSnapshot(List.of(
                Map.of("id", 1, "questions", List.of(Map.of("id", "q1", "type", "SINGLE_CHOICE")))
        ));

        Map<Integer, PartGradingKey> loadedKeys = Map.of(
                1, createPartKey(1, "q1", "TRUE_FALSE_NOT_GIVEN", "TRUE")
        );

        assertThatThrownBy(() -> factory.prepare(snapshot, List.of(), loadedKeys))
                .isInstanceOf(AppException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.GRADING_DATA_ERROR);
    }

    @Test
    @DisplayName("Should deep copy keys so original loadedKeys is not mutated")
    void prepare_copiesKeys_doesNotMutateLoaded() {
        Map<String, Object> snapshot = createSnapshot(List.of(
                Map.of("id", 1, "questions", List.of(Map.of("id", "q1", "type", "SINGLE_CHOICE")))
        ));

        PartGradingKey original = createPartKey(1, "q1", "SINGLE_CHOICE", "A");
        original.setSectionName("Old Section");
        Map<Integer, PartGradingKey> loadedKeys = Map.of(1, original);

        AttemptGradingInputFactory.GradingInput input = factory.prepare(snapshot, List.of(), loadedKeys);

        assertThat(input.getPartKeys().get(1).getSectionName()).isEqualTo("READING");
        assertThat(original.getSectionName()).isEqualTo("Old Section");
    }

    @Test
    void prepareCopiesThePairMetadataWithScopedGradingKeys() {
        var group = new GradingKey.AnswerGroup("listening-17-18", "DISTINCT_UNORDERED",
                List.of("l_017", "l_018"));
        GradingKey first = new GradingKey();
        first.setQuestionId("l_017"); first.setType("SINGLE_CHOICE"); first.setCorrect(List.of("A", "E"));
        first.setAnswerGroup(group);
        GradingKey second = new GradingKey();
        second.setQuestionId("l_018"); second.setType("SINGLE_CHOICE"); second.setCorrect(List.of("A", "E"));
        second.setAnswerGroup(group);
        PartGradingKey loaded = new PartGradingKey();
        loaded.setPartId(10); loaded.setAnswers(Map.of("l_017", first, "l_018", second));
        Map<String, Object> snapshot = createSnapshot(List.of(Map.of("id", 10, "questions", List.of(
                Map.of("question_id", "l_017", "type", "SINGLE_CHOICE"),
                Map.of("question_id", "l_018", "type", "SINGLE_CHOICE")))));

        var scoped = factory.prepare(snapshot, List.of(), Map.of(10, loaded)).getPartKeys().get(10).getAnswers();

        assertThat(scoped.get("l_017").getAnswerGroup()).isEqualTo(group);
        assertThat(scoped.get("l_018").getAnswerGroup()).isEqualTo(group);
        assertThat(scoped.get("l_017")).isNotSameAs(first);
    }
}
