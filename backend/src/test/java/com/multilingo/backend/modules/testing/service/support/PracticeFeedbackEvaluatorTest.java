package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.dto.response.PracticeFeedbackResponse;
import com.multilingo.backend.modules.testing.grading.GradingVerdict;
import com.multilingo.backend.modules.testing.grading.ObjectiveGradingService;
import com.multilingo.backend.modules.testing.grading.impl.ObjectiveGradingServiceImpl;
import com.multilingo.backend.modules.testing.service.support.PracticeFeedbackRequestValidator.ValidatedFeedbackInput;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class PracticeFeedbackEvaluatorTest {

    private PracticeFeedbackEvaluator evaluator;

    @BeforeEach
    void setUp() {
        evaluator = new PracticeFeedbackEvaluator(new ObjectiveGradingServiceImpl());
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Fixture helpers
    // ─────────────────────────────────────────────────────────────────────────────

    private Map<String, Object> createComprehensiveSnapshot() {
        Map<String, Object> qSc = new LinkedHashMap<>();
        qSc.put("question_id", "q_sc");
        qSc.put("type", "SINGLE_CHOICE");
        qSc.put("correct_answer", "A");
        qSc.put("explanation", "Giải thích câu SINGLE_CHOICE");

        Map<String, Object> qTfng = new LinkedHashMap<>();
        qTfng.put("question_id", "q_tfng");
        qTfng.put("type", "TRUE_FALSE_NOT_GIVEN");
        qTfng.put("correct_answer", "TRUE");
        qTfng.put("explanation", "Giải thích câu TFNG");

        Map<String, Object> qYnng = new LinkedHashMap<>();
        qYnng.put("question_id", "q_ynng");
        qYnng.put("type", "YES_NO_NOT_GIVEN");
        qYnng.put("correct_answer", "YES");

        Map<String, Object> qFitb = new LinkedHashMap<>();
        qFitb.put("question_id", "q_fitb");
        qFitb.put("type", "FILL_IN_THE_BLANK");
        qFitb.put("correct_answer", "plasticity");
        qFitb.put("alternates", List.of("neuroplasticity", "neural plasticity"));

        Map<String, Object> qMc = new LinkedHashMap<>();
        qMc.put("question_id", "q_mc");
        qMc.put("type", "MULTIPLE_CHOICE");
        qMc.put("correct_answer", List.of("A", "C"));

        Map<String, Object> qMatching = new LinkedHashMap<>();
        qMatching.put("question_id", "q_matching");
        qMatching.put("type", "MATCHING");
        qMatching.put("correct_answer", Map.of("1", "A", "2", "B"));

        Map<String, Object> qFeatures = new LinkedHashMap<>();
        qFeatures.put("question_id", "q_features");
        qFeatures.put("type", "MATCHING_FEATURES");
        qFeatures.put("correct_answer", "B");

        Map<String, Object> qHeadings = new LinkedHashMap<>();
        qHeadings.put("question_id", "q_headings");
        qHeadings.put("type", "MATCHING_HEADINGS");
        qHeadings.put("correct_answer", "i");
        qHeadings.put("options", List.of(
                Map.of("id", "i", "text", "The first heading"),
                Map.of("id", "ii", "text", "The second heading")
        ));

        Map<String, Object> qDiagram = new LinkedHashMap<>();
        qDiagram.put("question_id", "q_diagram");
        qDiagram.put("type", "DIAGRAM_LABELING");
        qDiagram.put("correct_answer", "lobe");

        Map<String, Object> qMap = new LinkedHashMap<>();
        qMap.put("question_id", "q_map");
        qMap.put("type", "MAP_LABELING");
        qMap.put("correct_answer", "lake");

        Map<String, Object> qAliasMcq = new LinkedHashMap<>();
        qAliasMcq.put("question_id", "q_alias_mcq");
        qAliasMcq.put("type", "MCQ");
        qAliasMcq.put("correct_answer", "D");

        Map<String, Object> qAliasFillin = new LinkedHashMap<>();
        qAliasFillin.put("question_id", "q_alias_fillin");
        qAliasFillin.put("type", "FILL_IN");
        qAliasFillin.put("correct_answer", "oxygen");

        Map<String, Object> qNoKey = new LinkedHashMap<>();
        qNoKey.put("question_id", "q_no_key");
        qNoKey.put("type", "SINGLE_CHOICE");

        Map<String, Object> qNoExp = new LinkedHashMap<>();
        qNoExp.put("question_id", "q_no_exp");
        qNoExp.put("type", "SINGLE_CHOICE");
        qNoExp.put("correct_answer", "B");

        Map<String, Object> qBadExp = new LinkedHashMap<>();
        qBadExp.put("question_id", "q_bad_exp");
        qBadExp.put("type", "SINGLE_CHOICE");
        qBadExp.put("correct_answer", "C");
        qBadExp.put("explanation", 99999); // invalid non-string explanation

        Map<String, Object> qEssay = new LinkedHashMap<>();
        qEssay.put("question_id", "q_essay");
        qEssay.put("type", "ESSAY");

        Map<String, Object> part10 = new LinkedHashMap<>();
        part10.put("id", 10);
        part10.put("title", "Part 10 Flat");
        part10.put("questions", List.of(
                qSc, qTfng, qYnng, qFitb, qMc, qMatching, qFeatures, qHeadings,
                qDiagram, qMap, qAliasMcq, qAliasFillin, qNoKey, qNoExp, qBadExp, qEssay
        ));

        Map<String, Object> section = new LinkedHashMap<>();
        section.put("name", "READING");
        section.put("parts", List.of(part10));

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("sections", List.of(section));
        return snapshot;
    }

    private Map<String, Object> pairedSnapshot() {
        Map<String, Object> answerGroup = Map.of("id", "listening-17-18", "mode", "DISTINCT_UNORDERED",
                "question_ids", List.of("l_017", "l_018"));
        Map<String, Object> first = new LinkedHashMap<>(Map.of("question_id", "l_017", "type", "SINGLE_CHOICE",
                "correct_answer", List.of("A", "E"), "answer_group", answerGroup,
                "explanation", "Explanation 17"));
        Map<String, Object> second = new LinkedHashMap<>(Map.of("question_id", "l_018", "type", "SINGLE_CHOICE",
                "correct_answer", List.of("A", "E"), "answer_group", answerGroup,
                "explanation", "Explanation 18"));
        Map<String, Object> part = new LinkedHashMap<>();
        part.put("id", 10);
        part.put("question_groups", List.of(Map.of("questions", List.of(first, second))));
        return Map.of("sections", List.of(Map.of("name", "LISTENING", "parts", List.of(part))));
    }

    private Map<String, Object> deepCopyMap(Map<String, Object> original) {
        Map<String, Object> copy = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : original.entrySet()) {
            if (entry.getValue() instanceof Map<?, ?> m) {
                copy.put(entry.getKey(), deepCopyMap((Map<String, Object>) m));
            } else if (entry.getValue() instanceof List<?> l) {
                List<Object> copyList = new ArrayList<>();
                for (Object item : l) {
                    if (item instanceof Map<?, ?> im) {
                        copyList.add(deepCopyMap((Map<String, Object>) im));
                    } else {
                        copyList.add(item);
                    }
                }
                copy.put(entry.getKey(), copyList);
            } else {
                copy.put(entry.getKey(), entry.getValue());
            }
        }
        return copy;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Objective grading parity tests
    // ─────────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("SINGLE_CHOICE: correct answer, wrong answer, blank null")
    void evaluate_singleChoice() {
        Map<String, Object> snapshot = createComprehensiveSnapshot();

        // Correct
        PracticeFeedbackResponse res1 = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_sc", "A"));
        assertThat(res1.getAttemptId()).isEqualTo(42);
        assertThat(res1.getPartId()).isEqualTo(10);
        assertThat(res1.getQuestionId()).isEqualTo("q_sc");
        assertThat(res1.getType()).isEqualTo("SINGLE_CHOICE");
        assertThat(res1.getUserAnswer()).isEqualTo("A");
        assertThat(res1.getVerdict()).isEqualTo(GradingVerdict.CORRECT);
        assertThat(res1.getScore()).isEqualByComparingTo("1");
        assertThat(res1.getCorrectAnswer()).isEqualTo("A");
        assertThat(res1.getExplanation()).isEqualTo("Giải thích câu SINGLE_CHOICE");

        // Wrong
        PracticeFeedbackResponse res2 = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_sc", "B"));
        assertThat(res2.getVerdict()).isEqualTo(GradingVerdict.WRONG);
        assertThat(res2.getScore()).isEqualByComparingTo("0");

        // Blank (null)
        PracticeFeedbackResponse res3 = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_sc", null));
        assertThat(res3.getVerdict()).isEqualTo(GradingVerdict.BLANK);
        assertThat(res3.getScore()).isEqualByComparingTo("0");
        assertThat(res3.getUserAnswer()).isNull();
    }

    @Test
    void evaluate_pairedPracticeReturnsBothCurrentAnswersAndDoesNotPersist() {
        Map<String, Object> snapshot = pairedSnapshot();
        String snapshotBefore = snapshot.toString();
        Map<String, Object> groupAnswers = new LinkedHashMap<>();
        groupAnswers.put("l_018", "A");
        groupAnswers.put("l_017", "A");
        var response = evaluator.evaluate(42, snapshot,
                new ValidatedFeedbackInput(10, "l_017", "A", groupAnswers));

        assertThat(response.getCorrectAnswer()).isEqualTo(List.of("A", "E"));
        assertThat(response.getGroupResults()).extracting(PracticeFeedbackResponse.GroupAnswer::questionId)
                .containsExactly("l_017", "l_018");
        assertThat(response.getGroupResults()).extracting(PracticeFeedbackResponse.GroupAnswer::verdict)
                .containsExactly(GradingVerdict.CORRECT, GradingVerdict.WRONG);
        assertThat(response.getGroupResults()).extracting(PracticeFeedbackResponse.GroupAnswer::score)
                .containsExactly(BigDecimal.ONE, BigDecimal.ZERO);
        assertThat(snapshot.toString()).isEqualTo(snapshotBefore);
    }

    @Test
    void evaluate_pairedPracticeRequiresWholeInScopePairAndMatchingAnchor() {
        Map<String, Object> snapshot = pairedSnapshot();

        assertThatThrownBy(() -> evaluator.evaluate(42, snapshot,
                new ValidatedFeedbackInput(10, "l_017", "A", Map.of("l_017", "A", "outside", "E"))))
                .isInstanceOf(AppException.class);
        assertThatThrownBy(() -> evaluator.evaluate(42, snapshot,
                new ValidatedFeedbackInput(10, "l_017", "B", Map.of("l_017", "A", "l_018", "E"))))
                .isInstanceOf(AppException.class);
        assertThatThrownBy(() -> evaluator.evaluate(42, snapshot,
                new ValidatedFeedbackInput(10, "l_017", "A")))
                .isInstanceOf(AppException.class);
    }

    @Test
    @DisplayName("TRUE_FALSE_NOT_GIVEN: aliases t, true, not_given, case-insensitive")
    void evaluate_tfng_aliases() {
        Map<String, Object> snapshot = createComprehensiveSnapshot();

        PracticeFeedbackResponse res = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_tfng", "t"));
        assertThat(res.getVerdict()).isEqualTo(GradingVerdict.CORRECT);
        assertThat(res.getScore()).isEqualByComparingTo("1");

        PracticeFeedbackResponse resWrong = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_tfng", "false"));
        assertThat(resWrong.getVerdict()).isEqualTo(GradingVerdict.WRONG);
    }

    @Test
    @DisplayName("YES_NO_NOT_GIVEN: aliases y, yes, case-insensitive")
    void evaluate_ynng_aliases() {
        Map<String, Object> snapshot = createComprehensiveSnapshot();

        PracticeFeedbackResponse res = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_ynng", "y"));
        assertThat(res.getVerdict()).isEqualTo(GradingVerdict.CORRECT);
        assertThat(res.getScore()).isEqualByComparingTo("1");
    }

    @Test
    @DisplayName("FILL_IN_THE_BLANK: accepted alternates, spacing collapse")
    void evaluate_fillIn_alternates() {
        Map<String, Object> snapshot = createComprehensiveSnapshot();

        // Primary correct
        PracticeFeedbackResponse res1 = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_fitb", " plasticity "));
        assertThat(res1.getVerdict()).isEqualTo(GradingVerdict.CORRECT);
        assertThat(res1.getScore()).isEqualByComparingTo("1");

        // Alternate
        PracticeFeedbackResponse res2 = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_fitb", "neural   plasticity"));
        assertThat(res2.getVerdict()).isEqualTo(GradingVerdict.CORRECT);
        assertThat(res2.getScore()).isEqualByComparingTo("1");

        // Wrong
        PracticeFeedbackResponse res3 = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_fitb", "elasticity"));
        assertThat(res3.getVerdict()).isEqualTo(GradingVerdict.WRONG);
    }

    @Test
    @DisplayName("MULTIPLE_CHOICE: full match vs partial vs empty")
    void evaluate_multipleChoice() {
        Map<String, Object> snapshot = createComprehensiveSnapshot();

        // Exact match (order independent)
        PracticeFeedbackResponse res1 = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_mc", List.of("C", "A")));
        assertThat(res1.getVerdict()).isEqualTo(GradingVerdict.CORRECT);
        assertThat(res1.getScore()).isEqualByComparingTo("1");

        // Partial match is WRONG in MCQ
        PracticeFeedbackResponse res2 = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_mc", List.of("A")));
        assertThat(res2.getVerdict()).isEqualTo(GradingVerdict.WRONG);
        assertThat(res2.getScore()).isEqualByComparingTo("0");

        // Null / empty is BLANK
        PracticeFeedbackResponse res3 = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_mc", Collections.emptyList()));
        assertThat(res3.getVerdict()).isEqualTo(GradingVerdict.BLANK);
    }

    @Test
    @DisplayName("MATCHING: partial credit (1 pair -> WRONG/score 1, 2 pairs -> CORRECT/score 2, empty -> BLANK)")
    void evaluate_matching_partialCredit() {
        Map<String, Object> snapshot = createComprehensiveSnapshot();

        // 1 of 2 pairs correct -> WRONG verdict, but score 1
        PracticeFeedbackResponse resPartial = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_matching", Map.of("1", "A", "2", "WRONG")));
        assertThat(resPartial.getQuestionId()).isEqualTo("q_matching");
        assertThat(resPartial.getVerdict()).isEqualTo(GradingVerdict.WRONG);
        assertThat(resPartial.getScore()).isEqualByComparingTo("1");

        // All 2 pairs correct -> CORRECT verdict, score 2
        PracticeFeedbackResponse resFull = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_matching", Map.of("1", "A", "2", "B")));
        assertThat(resFull.getVerdict()).isEqualTo(GradingVerdict.CORRECT);
        assertThat(resFull.getScore()).isEqualByComparingTo("2");

        // Empty map -> BLANK verdict, score 0
        PracticeFeedbackResponse resBlank = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_matching", Collections.emptyMap()));
        assertThat(resBlank.getVerdict()).isEqualTo(GradingVerdict.BLANK);
        assertThat(resBlank.getScore()).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("MATCHING_HEADINGS: accepts heading option id or heading text")
    void evaluate_matchingHeadings_optionIdAndText() {
        Map<String, Object> snapshot = createComprehensiveSnapshot();

        // By ID: "i"
        PracticeFeedbackResponse resId = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_headings", "i"));
        assertThat(resId.getVerdict()).isEqualTo(GradingVerdict.CORRECT);

        // By text: "The first heading"
        PracticeFeedbackResponse resText = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_headings", "The first heading"));
        assertThat(resText.getVerdict()).isEqualTo(GradingVerdict.CORRECT);

        // Wrong option
        PracticeFeedbackResponse resWrong = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_headings", "ii"));
        assertThat(resWrong.getVerdict()).isEqualTo(GradingVerdict.WRONG);
    }

    @Test
    @DisplayName("Type aliases: MCQ normalized to SINGLE_CHOICE, FILL_IN normalized to FILL_IN_THE_BLANK")
    void evaluate_typeAliases() {
        Map<String, Object> snapshot = createComprehensiveSnapshot();

        PracticeFeedbackResponse resMcq = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_alias_mcq", "D"));
        assertThat(resMcq.getType()).isEqualTo("SINGLE_CHOICE");
        assertThat(resMcq.getVerdict()).isEqualTo(GradingVerdict.CORRECT);

        PracticeFeedbackResponse resFillIn = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_alias_fillin", "oxygen"));
        assertThat(resFillIn.getType()).isEqualTo("FILL_IN_THE_BLANK");
        assertThat(resFillIn.getVerdict()).isEqualTo(GradingVerdict.CORRECT);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Group options, Mirrored lists, Multiple Parts with same questionId
    // ─────────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Grouped snapshot: question inherits group options for MATCHING_HEADINGS")
    void evaluate_groupedQuestion_inheritsGroupOptions() {
        Map<String, Object> q = new LinkedHashMap<>();
        q.put("question_id", "q_gh_1");
        q.put("type", "MATCHING_HEADINGS");
        q.put("correct_answer", "ii");
        // No options at question level

        Map<String, Object> group = new LinkedHashMap<>();
        group.put("group_id", "g_1");
        group.put("options", List.of(
                Map.of("id", "i", "text", "Overview"),
                Map.of("id", "ii", "text", "Methodology")
        ));
        group.put("questions", List.of(q));

        Map<String, Object> part = new LinkedHashMap<>();
        part.put("id", 20);
        part.put("question_groups", List.of(group));

        Map<String, Object> section = new LinkedHashMap<>();
        section.put("name", "READING");
        section.put("parts", List.of(part));

        Map<String, Object> snapshot = Map.of("sections", List.of(section));

        // Evaluate with heading text "Methodology" which should match option "ii"
        PracticeFeedbackResponse res = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(20, "q_gh_1", "Methodology"));
        assertThat(res.getVerdict()).isEqualTo(GradingVerdict.CORRECT);
        assertThat(res.getScore()).isEqualByComparingTo("1");
    }

    @Test
    @DisplayName("Mirrored flat+groups: groups take precedence, mirrored flat question is ignored")
    void evaluate_mirroredFlatAndGroups_precedence() {
        // Group version has correct_answer "A"
        Map<String, Object> qGroup = new LinkedHashMap<>();
        qGroup.put("question_id", "q_mirrored");
        qGroup.put("type", "SINGLE_CHOICE");
        qGroup.put("correct_answer", "A");

        Map<String, Object> group = new LinkedHashMap<>();
        group.put("questions", List.of(qGroup));

        // Mirrored flat version has correct_answer "B"
        Map<String, Object> qFlat = new LinkedHashMap<>();
        qFlat.put("question_id", "q_mirrored");
        qFlat.put("type", "SINGLE_CHOICE");
        qFlat.put("correct_answer", "B");

        Map<String, Object> part = new LinkedHashMap<>();
        part.put("id", 30);
        part.put("question_groups", List.of(group));
        part.put("questions", List.of(qFlat)); // mirrored flat list

        Map<String, Object> section = Map.of("name", "READING", "parts", List.of(part));
        Map<String, Object> snapshot = Map.of("sections", List.of(section));

        // Testing with "A" should be CORRECT because group version takes precedence
        PracticeFeedbackResponse res = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(30, "q_mirrored", "A"));
        assertThat(res.getVerdict()).isEqualTo(GradingVerdict.CORRECT);
        assertThat(res.getCorrectAnswer()).isEqualTo("A");

        // Testing with "B" should be WRONG
        PracticeFeedbackResponse resB = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(30, "q_mirrored", "B"));
        assertThat(resB.getVerdict()).isEqualTo(GradingVerdict.WRONG);
    }

    @Test
    @DisplayName("Multiple Parts with identical questionId: each Part evaluates against its own key")
    void evaluate_multiplePartsSameQuestionId() {
        Map<String, Object> qPart100 = new LinkedHashMap<>();
        qPart100.put("question_id", "q_same_id");
        qPart100.put("type", "SINGLE_CHOICE");
        qPart100.put("correct_answer", "ALPHA");

        Map<String, Object> part100 = new LinkedHashMap<>();
        part100.put("id", 100);
        part100.put("questions", List.of(qPart100));

        Map<String, Object> qPart200 = new LinkedHashMap<>();
        qPart200.put("question_id", "q_same_id");
        qPart200.put("type", "SINGLE_CHOICE");
        qPart200.put("correct_answer", "BETA");

        Map<String, Object> part200 = new LinkedHashMap<>();
        part200.put("id", 200);
        part200.put("questions", List.of(qPart200));

        Map<String, Object> section = Map.of("name", "READING", "parts", List.of(part100, part200));
        Map<String, Object> snapshot = Map.of("sections", List.of(section));

        // Part 100 with ALPHA -> CORRECT
        PracticeFeedbackResponse res100 = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(100, "q_same_id", "ALPHA"));
        assertThat(res100.getPartId()).isEqualTo(100);
        assertThat(res100.getVerdict()).isEqualTo(GradingVerdict.CORRECT);
        assertThat(res100.getCorrectAnswer()).isEqualTo("ALPHA");

        // Part 200 with ALPHA -> WRONG (because Part 200 correct is BETA)
        PracticeFeedbackResponse res200Wrong = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(200, "q_same_id", "ALPHA"));
        assertThat(res200Wrong.getPartId()).isEqualTo(200);
        assertThat(res200Wrong.getVerdict()).isEqualTo(GradingVerdict.WRONG);
        assertThat(res200Wrong.getCorrectAnswer()).isEqualTo("BETA");
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Error cases & boundary validation
    // ─────────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Snapshot immutability: snapshot map is untouched after evaluation")
    void evaluate_doesNotMutateSnapshot() {
        Map<String, Object> snapshot = createComprehensiveSnapshot();
        Map<String, Object> snapshotBeforeEvaluation = deepCopyMap(snapshot);

        evaluator.evaluate(42, snapshot, new ValidatedFeedbackInput(10, "q_sc", "A"));

        assertThat(snapshot).isEqualTo(snapshotBeforeEvaluation);
    }

    @Test
    @DisplayName("Missing explanation in snapshot: response has explanation = null")
    void evaluate_missingExplanation_returnsNullExplanation() {
        Map<String, Object> snapshot = createComprehensiveSnapshot();

        PracticeFeedbackResponse res = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_no_exp", "B"));
        assertThat(res.getVerdict()).isEqualTo(GradingVerdict.CORRECT);
        assertThat(res.getExplanation()).isNull();
    }

    @Test
    @DisplayName("Invalid non-string explanation type: throws GRADING_DATA_ERROR")
    void evaluate_invalidExplanationType_throwsGradingDataError() {
        Map<String, Object> snapshot = createComprehensiveSnapshot();

        assertThatThrownBy(() -> evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_bad_exp", "C")))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode()).isEqualTo(ErrorCode.GRADING_DATA_ERROR));
    }

    @Test
    @DisplayName("Missing grading key in question: throws GRADING_DATA_ERROR")
    void evaluate_missingGradingKey_throwsGradingDataError() {
        Map<String, Object> snapshot = createComprehensiveSnapshot();

        assertThatThrownBy(() -> evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_no_key", "A")))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode()).isEqualTo(ErrorCode.GRADING_DATA_ERROR));
    }

    @Test
    @DisplayName("ESSAY question: throws VALIDATION_FAILED with fixed message")
    void evaluate_essayQuestion_throwsValidationFailed() {
        Map<String, Object> snapshot = createComprehensiveSnapshot();

        assertThatThrownBy(() -> evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_essay", "My essay")))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> {
                    AppException ae = (AppException) ex;
                    assertThat(ae.getErrorCode()).isEqualTo(ErrorCode.VALIDATION_FAILED);
                    assertThat(ae.getMessage()).contains("ESSAY");
                });
    }

    @Test
    @DisplayName("Part not found in snapshot: throws RESOURCE_NOT_FOUND")
    void evaluate_partNotFound_throwsResourceNotFound() {
        Map<String, Object> snapshot = createComprehensiveSnapshot();

        assertThatThrownBy(() -> evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(999, "q_sc", "A")))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND));
    }

    @Test
    @DisplayName("Question not found in Part: throws RESOURCE_NOT_FOUND")
    void evaluate_questionNotFound_throwsResourceNotFound() {
        Map<String, Object> snapshot = createComprehensiveSnapshot();

        assertThatThrownBy(() -> evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_unknown", "A")))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND));
    }

    @Test
    @DisplayName("Duplicate question IDs within same Part: throws GRADING_DATA_ERROR")
    void evaluate_duplicateQuestionIdInPart_throwsGradingDataError() {
        Map<String, Object> q1 = Map.of("question_id", "q_dup", "type", "SINGLE_CHOICE", "correct_answer", "A");
        Map<String, Object> q2 = Map.of("question_id", "q_dup", "type", "SINGLE_CHOICE", "correct_answer", "B");

        Map<String, Object> part = Map.of("id", 50, "questions", List.of(q1, q2));
        Map<String, Object> snapshot = Map.of("sections", List.of(Map.of("name", "READING", "parts", List.of(part))));

        assertThatThrownBy(() -> evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(50, "q_dup", "A")))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode()).isEqualTo(ErrorCode.GRADING_DATA_ERROR));
    }

    @Test
    @DisplayName("Unknown question type: throws GRADING_DATA_ERROR")
    void evaluate_unknownQuestionType_throwsGradingDataError() {
        Map<String, Object> q = Map.of("question_id", "q_unknown_type", "type", "FUTURE_UNKNOWN_TYPE", "correct_answer", "A");
        Map<String, Object> part = Map.of("id", 60, "questions", List.of(q));
        Map<String, Object> snapshot = Map.of("sections", List.of(Map.of("name", "READING", "parts", List.of(part))));

        assertThatThrownBy(() -> evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(60, "q_unknown_type", "A")))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode()).isEqualTo(ErrorCode.GRADING_DATA_ERROR));
    }

    @Test
    @DisplayName("Null or empty snapshot: throws GRADING_DATA_ERROR")
    void evaluate_nullOrEmptySnapshot_throwsGradingDataError() {
        assertThatThrownBy(() -> evaluator.evaluate(
                42, null, new ValidatedFeedbackInput(10, "q_sc", "A")))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode()).isEqualTo(ErrorCode.GRADING_DATA_ERROR));

        assertThatThrownBy(() -> evaluator.evaluate(
                42, Collections.emptyMap(), new ValidatedFeedbackInput(10, "q_sc", "A")))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode()).isEqualTo(ErrorCode.GRADING_DATA_ERROR));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Additional positive coverage (MATCHING_FEATURES, DIAGRAM_LABELING, MAP_LABELING, flat list key)
    // ─────────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("MATCHING_FEATURES: evaluates correct answer and returns string key")
    void evaluate_matchingFeatures() {
        Map<String, Object> snapshot = createComprehensiveSnapshot();
        PracticeFeedbackResponse res = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_features", "B"));
        assertThat(res.getVerdict()).isEqualTo(GradingVerdict.CORRECT);
        assertThat(res.getScore()).isEqualByComparingTo("1");
        assertThat(res.getCorrectAnswer()).isEqualTo("B");
    }

    @Test
    @DisplayName("DIAGRAM_LABELING: evaluates correct answer and returns string key")
    void evaluate_diagramLabeling() {
        Map<String, Object> snapshot = createComprehensiveSnapshot();
        PracticeFeedbackResponse res = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_diagram", "lobe"));
        assertThat(res.getVerdict()).isEqualTo(GradingVerdict.CORRECT);
        assertThat(res.getScore()).isEqualByComparingTo("1");
        assertThat(res.getCorrectAnswer()).isEqualTo("lobe");
    }

    @Test
    @DisplayName("MAP_LABELING: evaluates correct answer and returns string key")
    void evaluate_mapLabeling() {
        Map<String, Object> snapshot = createComprehensiveSnapshot();
        PracticeFeedbackResponse res = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_map", "lake"));
        assertThat(res.getVerdict()).isEqualTo(GradingVerdict.CORRECT);
        assertThat(res.getScore()).isEqualByComparingTo("1");
        assertThat(res.getCorrectAnswer()).isEqualTo("lake");
    }

    @Test
    @DisplayName("SINGLE_CHOICE with historical flat list key: evaluates match and returns unmodifiable list")
    void evaluate_singleChoice_flatListKey() {
        Map<String, Object> q = new LinkedHashMap<>();
        q.put("question_id", "q_sc_list");
        q.put("type", "SINGLE_CHOICE");
        q.put("correct_answer", List.of("A", "B"));

        Map<String, Object> part = Map.of("id", 10, "questions", List.of(q));
        Map<String, Object> snapshot = Map.of("sections", List.of(Map.of("name", "READING", "parts", List.of(part))));

        // Match first acceptable option
        PracticeFeedbackResponse resA = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_sc_list", "A"));
        assertThat(resA.getVerdict()).isEqualTo(GradingVerdict.CORRECT);
        assertThat(resA.getScore()).isEqualByComparingTo("1");
        assertThat(resA.getCorrectAnswer()).isEqualTo(List.of("A", "B"));

        // Match second acceptable option
        PracticeFeedbackResponse resB = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_sc_list", "B"));
        assertThat(resB.getVerdict()).isEqualTo(GradingVerdict.CORRECT);

        // Wrong option
        PracticeFeedbackResponse resC = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_sc_list", "C"));
        assertThat(resC.getVerdict()).isEqualTo(GradingVerdict.WRONG);
    }

    @Test
    @DisplayName("Response correctAnswer immutability: collections returned in correctAnswer are unmodifiable")
    void evaluate_correctAnswer_immutability() {
        Map<String, Object> snapshot = createComprehensiveSnapshot();

        // MATCHING
        PracticeFeedbackResponse resMatching = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_matching", Collections.emptyMap()));
        assertThat(resMatching.getCorrectAnswer()).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> matchingKeyMap = (Map<String, Object>) resMatching.getCorrectAnswer();
        assertThatThrownBy(() -> matchingKeyMap.put("new_key", "val"))
                .isInstanceOf(UnsupportedOperationException.class);

        // MULTIPLE_CHOICE
        PracticeFeedbackResponse resMc = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_mc", Collections.emptyList()));
        assertThat(resMc.getCorrectAnswer()).isInstanceOf(List.class);
        @SuppressWarnings("unchecked")
        List<Object> mcKeyList = (List<Object>) resMc.getCorrectAnswer();
        assertThatThrownBy(() -> mcKeyList.add("NEW_VAL"))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // P1 Finding Regression Tests: validate grading key structure before grading
    // ─────────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("P1: SINGLE_CHOICE with nested object key throws GRADING_DATA_ERROR, does not leak sentinel, engine not called")
    void evaluate_nestedObjectKey_singleChoice_throwsGradingDataError() {
        ObjectiveGradingService mockEngine = mock(ObjectiveGradingService.class);
        PracticeFeedbackEvaluator eval = new PracticeFeedbackEvaluator(mockEngine);

        Map<String, Object> q = new LinkedHashMap<>();
        q.put("question_id", "q_nested_sc");
        q.put("type", "SINGLE_CHOICE");
        q.put("correct_answer", Map.of("private", Map.of("aiPrompt", "SECRET_SENTINEL")));

        Map<String, Object> part = Map.of("id", 10, "questions", List.of(q));
        Map<String, Object> snapshot = Map.of("sections", List.of(Map.of("name", "READING", "parts", List.of(part))));

        assertThatThrownBy(() -> eval.evaluate(42, snapshot, new ValidatedFeedbackInput(10, "q_nested_sc", "A")))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> {
                    AppException ae = (AppException) ex;
                    assertThat(ae.getErrorCode()).isEqualTo(ErrorCode.GRADING_DATA_ERROR);
                    assertThat(ae.getMessage()).doesNotContain("SECRET_SENTINEL");
                    assertThat(ae.getMessage()).doesNotContain("aiPrompt");
                });

        verifyNoInteractions(mockEngine);
    }

    @Test
    @DisplayName("P1: MULTIPLE_CHOICE with nested list element throws GRADING_DATA_ERROR, does not leak sentinel, engine not called")
    void evaluate_nestedListElementKey_multipleChoice_throwsGradingDataError() {
        ObjectiveGradingService mockEngine = mock(ObjectiveGradingService.class);
        PracticeFeedbackEvaluator eval = new PracticeFeedbackEvaluator(mockEngine);

        Map<String, Object> q = new LinkedHashMap<>();
        q.put("question_id", "q_nested_mc");
        q.put("type", "MULTIPLE_CHOICE");
        q.put("correct_answer", List.of("A", Map.of("nested", "SECRET_SENTINEL")));

        Map<String, Object> part = Map.of("id", 10, "questions", List.of(q));
        Map<String, Object> snapshot = Map.of("sections", List.of(Map.of("name", "READING", "parts", List.of(part))));

        assertThatThrownBy(() -> eval.evaluate(42, snapshot, new ValidatedFeedbackInput(10, "q_nested_mc", List.of("A"))))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> {
                    AppException ae = (AppException) ex;
                    assertThat(ae.getErrorCode()).isEqualTo(ErrorCode.GRADING_DATA_ERROR);
                    assertThat(ae.getMessage()).doesNotContain("SECRET_SENTINEL");
                });

        verifyNoInteractions(mockEngine);
    }

    @Test
    @DisplayName("P1: MATCHING with nested map value throws GRADING_DATA_ERROR, does not leak sentinel, engine not called")
    void evaluate_nestedMapValue_matching_throwsGradingDataError() {
        ObjectiveGradingService mockEngine = mock(ObjectiveGradingService.class);
        PracticeFeedbackEvaluator eval = new PracticeFeedbackEvaluator(mockEngine);

        Map<String, Object> q = new LinkedHashMap<>();
        q.put("question_id", "q_nested_matching");
        q.put("type", "MATCHING");
        q.put("correct_answer", Map.of("1", Map.of("subKey", "SECRET_SENTINEL")));

        Map<String, Object> part = Map.of("id", 10, "questions", List.of(q));
        Map<String, Object> snapshot = Map.of("sections", List.of(Map.of("name", "READING", "parts", List.of(part))));

        assertThatThrownBy(() -> eval.evaluate(42, snapshot, new ValidatedFeedbackInput(10, "q_nested_matching", Map.of("1", "A"))))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> {
                    AppException ae = (AppException) ex;
                    assertThat(ae.getErrorCode()).isEqualTo(ErrorCode.GRADING_DATA_ERROR);
                    assertThat(ae.getMessage()).doesNotContain("SECRET_SENTINEL");
                });

        verifyNoInteractions(mockEngine);
    }

    @Test
    @DisplayName("P1: MATCHING with non-Map key throws GRADING_DATA_ERROR and engine not called")
    void evaluate_matchingKeyNotMap_throwsGradingDataError() {
        ObjectiveGradingService mockEngine = mock(ObjectiveGradingService.class);
        PracticeFeedbackEvaluator eval = new PracticeFeedbackEvaluator(mockEngine);

        Map<String, Object> q = new LinkedHashMap<>();
        q.put("question_id", "q_str_matching");
        q.put("type", "MATCHING");
        q.put("correct_answer", "A"); // String instead of Map

        Map<String, Object> part = Map.of("id", 10, "questions", List.of(q));
        Map<String, Object> snapshot = Map.of("sections", List.of(Map.of("name", "READING", "parts", List.of(part))));

        assertThatThrownBy(() -> eval.evaluate(42, snapshot, new ValidatedFeedbackInput(10, "q_str_matching", Map.of("1", "A"))))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode()).isEqualTo(ErrorCode.GRADING_DATA_ERROR));

        verifyNoInteractions(mockEngine);
    }

    @Test
    @DisplayName("P1: Empty server keys ([], {}, '') throw GRADING_DATA_ERROR and engine not called")
    void evaluate_emptyServerKeys_throwGradingDataError() {
        ObjectiveGradingService mockEngine = mock(ObjectiveGradingService.class);
        PracticeFeedbackEvaluator eval = new PracticeFeedbackEvaluator(mockEngine);

        // Empty MULTIPLE_CHOICE list []
        Map<String, Object> qEmptyMc = Map.of("question_id", "q_empty_mc", "type", "MULTIPLE_CHOICE", "correct_answer", Collections.emptyList());
        Map<String, Object> part1 = Map.of("id", 10, "questions", List.of(qEmptyMc));
        Map<String, Object> snapshot1 = Map.of("sections", List.of(Map.of("name", "READING", "parts", List.of(part1))));

        assertThatThrownBy(() -> eval.evaluate(42, snapshot1, new ValidatedFeedbackInput(10, "q_empty_mc", List.of("A"))))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode()).isEqualTo(ErrorCode.GRADING_DATA_ERROR));

        // Empty MATCHING map {}
        Map<String, Object> qEmptyMatching = Map.of("question_id", "q_empty_mat", "type", "MATCHING", "correct_answer", Collections.emptyMap());
        Map<String, Object> part2 = Map.of("id", 10, "questions", List.of(qEmptyMatching));
        Map<String, Object> snapshot2 = Map.of("sections", List.of(Map.of("name", "READING", "parts", List.of(part2))));

        assertThatThrownBy(() -> eval.evaluate(42, snapshot2, new ValidatedFeedbackInput(10, "q_empty_mat", Map.of("1", "A"))))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode()).isEqualTo(ErrorCode.GRADING_DATA_ERROR));

        // Blank SINGLE_CHOICE string ""
        Map<String, Object> qBlankSc = Map.of("question_id", "q_blank_sc", "type", "SINGLE_CHOICE", "correct_answer", "   ");
        Map<String, Object> part3 = Map.of("id", 10, "questions", List.of(qBlankSc));
        Map<String, Object> snapshot3 = Map.of("sections", List.of(Map.of("name", "READING", "parts", List.of(part3))));

        assertThatThrownBy(() -> eval.evaluate(42, snapshot3, new ValidatedFeedbackInput(10, "q_blank_sc", "A")))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode()).isEqualTo(ErrorCode.GRADING_DATA_ERROR));

        verifyNoInteractions(mockEngine);
    }

    @Test
    @DisplayName("P1: MATCHING with leading/trailing whitespace key preserves exact ID and parity with engine")
    void evaluate_matching_preservesWhitespaceKeyId_parityWithEngine() {
        Map<String, Object> q = new LinkedHashMap<>();
        q.put("question_id", "q_match_ws");
        q.put("type", "MATCHING");
        q.put("correct_answer", Map.of(" item_1 ", "A"));

        Map<String, Object> part = Map.of("id", 10, "questions", List.of(q));
        Map<String, Object> snapshot = Map.of("sections", List.of(Map.of("name", "READING", "parts", List.of(part))));
        Map<String, Object> snapshotBefore = deepCopyMap(snapshot);

        PracticeFeedbackResponse res = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_match_ws", Map.of(" item_1 ", "A")));

        assertThat(res.getVerdict()).isEqualTo(GradingVerdict.CORRECT);
        assertThat(res.getScore()).isEqualByComparingTo("1");
        assertThat(res.getCorrectAnswer()).isEqualTo(Map.of(" item_1 ", "A"));
        assertThat(snapshot).isEqualTo(snapshotBefore);
    }

    @Test
    @DisplayName("P1: MATCHING with keys differing only by whitespace preserves both keys, does not collide, achieves parity with engine")
    void evaluate_matching_keysDifferingOnlyByWhitespace_preservesAllEntriesAndParity() {
        Map<String, Object> q = new LinkedHashMap<>();
        q.put("question_id", "q_match_collision");
        q.put("type", "MATCHING");
        Map<String, Object> correctMap = new LinkedHashMap<>();
        correctMap.put("1", "A");
        correctMap.put(" 1 ", "B");
        q.put("correct_answer", correctMap);

        Map<String, Object> part = Map.of("id", 10, "questions", List.of(q));
        Map<String, Object> snapshot = Map.of("sections", List.of(Map.of("name", "READING", "parts", List.of(part))));
        Map<String, Object> snapshotBefore = deepCopyMap(snapshot);

        Map<String, String> userAns = new LinkedHashMap<>();
        userAns.put("1", "A");
        userAns.put(" 1 ", "B");

        PracticeFeedbackResponse res = evaluator.evaluate(
                42, snapshot, new ValidatedFeedbackInput(10, "q_match_collision", userAns));

        assertThat(res.getVerdict()).isEqualTo(GradingVerdict.CORRECT);
        assertThat(res.getScore()).isEqualByComparingTo("2");
        @SuppressWarnings("unchecked")
        Map<String, Object> resCorrect = (Map<String, Object>) res.getCorrectAnswer();
        assertThat(resCorrect).hasSize(2);
        assertThat(resCorrect.get("1")).isEqualTo("A");
        assertThat(snapshot).isEqualTo(snapshotBefore);
    }

    @Test
    @DisplayName("Practice feedback populates listeningDetail when question has explicit listening_detail or transcript")
    void evaluate_populatesListeningDetailWhenPresent() {
        Map<String, Object> q = new LinkedHashMap<>();
        q.put("question_id", "q_p2_1");
        q.put("type", "SINGLE_CHOICE");
        q.put("correct_answer", "B");
        q.put("explanation", "Đáp án B là đúng.");
        q.put("listening_detail", Map.of(
                "questionAudio", "Where is the meeting room?",
                "transcript", "(A) In the morning. (B) Down the hall. (C) Yes, I did."
        ));

        Map<String, Object> part = Map.of("id", 12, "questions", List.of(q));
        Map<String, Object> snapshot = Map.of("sections", List.of(Map.of("name", "LISTENING", "parts", List.of(part))));

        PracticeFeedbackResponse res = evaluator.evaluate(
                55, snapshot, new ValidatedFeedbackInput(12, "q_p2_1", "B"));

        assertThat(res.getVerdict()).isEqualTo(GradingVerdict.CORRECT);
        assertThat(res.getListeningDetail()).isNotNull();
        @SuppressWarnings("unchecked")
        Map<String, Object> detail = (Map<String, Object>) res.getListeningDetail();
        assertThat(detail.get("questionAudio")).isEqualTo("Where is the meeting room?");
        assertThat(detail.get("transcript")).isEqualTo("(A) In the morning. (B) Down the hall. (C) Yes, I did.");
    }

    @Test
    @DisplayName("Practice feedback extracts transcript string into listeningDetail map and never falls back to explanation")
    void evaluate_populatesTranscriptWithoutFallingBackToExplanation() {
        Map<String, Object> qWithTranscript = new LinkedHashMap<>();
        qWithTranscript.put("question_id", "q_p1_1");
        qWithTranscript.put("type", "SINGLE_CHOICE");
        qWithTranscript.put("correct_answer", "A");
        qWithTranscript.put("explanation", "Giải thích chi tiết không phải là transcript");
        qWithTranscript.put("transcript", "A woman is typing on a keyboard.");

        Map<String, Object> qWithoutTranscript = new LinkedHashMap<>();
        qWithoutTranscript.put("question_id", "q_p1_2");
        qWithoutTranscript.put("type", "SINGLE_CHOICE");
        qWithoutTranscript.put("correct_answer", "C");
        qWithoutTranscript.put("explanation", "Giải thích này KHÔNG được biến thành transcript");

        Map<String, Object> part = Map.of("id", 11, "questions", List.of(qWithTranscript, qWithoutTranscript));
        Map<String, Object> snapshot = Map.of("sections", List.of(Map.of("name", "LISTENING", "parts", List.of(part))));

        // 1. With explicit transcript
        PracticeFeedbackResponse res1 = evaluator.evaluate(
                56, snapshot, new ValidatedFeedbackInput(11, "q_p1_1", "A"));
        assertThat(res1.getListeningDetail()).isEqualTo(Map.of("transcript", "A woman is typing on a keyboard."));

        // 2. Without transcript: listeningDetail is null, explanation is kept in explanation field only
        PracticeFeedbackResponse res2 = evaluator.evaluate(
                56, snapshot, new ValidatedFeedbackInput(11, "q_p1_2", "C"));
        assertThat(res2.getListeningDetail()).isNull();
        assertThat(res2.getExplanation()).isEqualTo("Giải thích này KHÔNG được biến thành transcript");
    }
}
