package com.multilingo.backend.modules.testing.grading;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.grading.dto.*;
import com.multilingo.backend.modules.testing.grading.impl.ObjectiveGradingServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.*;

class ObjectiveGradingServiceTest {

    private ObjectiveGradingService service;

    @BeforeEach
    void setUp() {
        // Pure Java — không cần Spring context
        service = new ObjectiveGradingServiceImpl();
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    private AttemptAnswer answerForPart(Integer partId, String questionId, Object answer) {
        AttemptAnswer aa = new AttemptAnswer();
        aa.setPartId(partId);
        aa.setUserAnswers(Map.of(questionId, answer));
        return aa;
    }

    private AttemptAnswer blankAnswerForPart(Integer partId) {
        AttemptAnswer aa = new AttemptAnswer();
        aa.setPartId(partId);
        aa.setUserAnswers(Collections.emptyMap());
        return aa;
    }

    private PartGradingKey partKey(Integer partId, String questionId, String type, Object correct, List<String> alternates) {
        GradingKey key = new GradingKey();
        key.setQuestionId(questionId);
        key.setType(type);
        key.setCorrect(correct);
        key.setAlternates(alternates);
        PartGradingKey pgk = new PartGradingKey();
        pgk.setPartId(partId);
        pgk.setAnswers(Map.of(questionId, key));
        return pgk;
    }

    // ─── TC_GRADE_SC: SINGLE_CHOICE ─────────────────────────────────────────────

    record SingleChoiceCase(String userAnswer, GradingVerdict expected) {}

    static Stream<SingleChoiceCase> singleChoiceCases() {
        return Stream.of(
            new SingleChoiceCase("A",   GradingVerdict.CORRECT),  // TC_GRADE_SC_01: exact match
            new SingleChoiceCase("a",   GradingVerdict.CORRECT),  // TC_GRADE_SC_02: case-insensitive
            new SingleChoiceCase("B",   GradingVerdict.WRONG),    // TC_GRADE_SC_03: wrong answer
            new SingleChoiceCase(null,  GradingVerdict.BLANK),    // TC_GRADE_SC_04: null
            new SingleChoiceCase("",    GradingVerdict.BLANK),    // TC_GRADE_SC_05: empty string
            new SingleChoiceCase("   ", GradingVerdict.BLANK)     // TC_GRADE_SC_06: whitespace only
        );
    }

    @ParameterizedTest
    @MethodSource("singleChoiceCases")
    void singleChoice_parameterized(SingleChoiceCase tc) {
        Map<Integer, PartGradingKey> keys = Map.of(
            1, partKey(1, "q_1", "SINGLE_CHOICE", "A", List.of())
        );
        AttemptAnswer answer = new AttemptAnswer();
        answer.setPartId(1);
        answer.setUserAnswers(tc.userAnswer() == null
            ? Collections.emptyMap()
            : Map.of("q_1", tc.userAnswer()));

        GradingResult result = service.gradeAttempt(List.of(answer), keys);

        QuestionGradingResult qResult = result.getPartResults().get(1).get("q_1");
        assertThat(qResult.getVerdict()).isEqualTo(tc.expected());
        BigDecimal expectedScore = tc.expected() == GradingVerdict.CORRECT
            ? BigDecimal.ONE : BigDecimal.ZERO;
        assertThat(qResult.getScore()).isEqualByComparingTo(expectedScore);
    }

    // ─── TC_GRADE_FI: FILL_IN_THE_BLANK ─────────────────────────────────────────

    record FillInCase(String userAnswer, GradingVerdict expected) {}

    static Stream<FillInCase> fillInCases() {
        return Stream.of(
            new FillInCase("plasticity",        GradingVerdict.CORRECT),  // TC_GRADE_FI_01
            new FillInCase("Plasticity",        GradingVerdict.CORRECT),  // TC_GRADE_FI_02
            new FillInCase("Neuroplasticity",   GradingVerdict.CORRECT),  // TC_GRADE_FI_03
            new FillInCase("  Neural Plasticity  ", GradingVerdict.CORRECT), // TC_GRADE_FI_04
            new FillInCase("synapse",           GradingVerdict.WRONG),    // TC_GRADE_FI_05
            new FillInCase(null,                GradingVerdict.BLANK)     // TC_GRADE_FI_06
        );
    }

    @ParameterizedTest
    @MethodSource("fillInCases")
    void fillIn_parameterized(FillInCase tc) {
        Map<Integer, PartGradingKey> keys = Map.of(
            3, partKey(3, "q_5", "FILL_IN_THE_BLANK", "plasticity",
                List.of("neural plasticity", "neuroplasticity"))
        );
        AttemptAnswer answer = new AttemptAnswer();
        answer.setPartId(3);
        answer.setUserAnswers(tc.userAnswer() == null
            ? Collections.emptyMap()
            : Map.of("q_5", tc.userAnswer()));

        GradingResult result = service.gradeAttempt(List.of(answer), keys);
        assertThat(result.getPartResults().get(3).get("q_5").getVerdict())
            .isEqualTo(tc.expected());
    }

    // ─── TC_GRADE_FI_07: số với alternates ──────────────────────────────────────

    @Test
    void fillIn_number_with_alternate_Nine_matches() {
        Map<Integer, PartGradingKey> keys = Map.of(
            5, partKey(5, "q_7", "FILL_IN_THE_BLANK", "9",
                List.of("9:00", "nine", "09:00"))
        );
        AttemptAnswer answer = new AttemptAnswer();
        answer.setPartId(5);
        answer.setUserAnswers(Map.of("q_7", "Nine"));

        GradingResult result = service.gradeAttempt(List.of(answer), keys);
        assertThat(result.getPartResults().get(5).get("q_7").getVerdict())
            .isEqualTo(GradingVerdict.CORRECT);
    }

    // ─── TC_GRADE_TF: TRUE_FALSE_NOT_GIVEN ──────────────────────────────────────

    record TFNGCase(String userAnswer, String correctKey, GradingVerdict expected) {}

    static Stream<TFNGCase> tfngCases() {
        return Stream.of(
            new TFNGCase("True",      "TRUE",      GradingVerdict.CORRECT),  // TC_GRADE_TF_01
            new TFNGCase("false",     "FALSE",     GradingVerdict.CORRECT),  // TC_GRADE_TF_02
            new TFNGCase("not given", "NOT_GIVEN", GradingVerdict.CORRECT),  // TC_GRADE_TF_03
            new TFNGCase("not given", "TRUE",      GradingVerdict.WRONG),    // TC_GRADE_TF_04
            new TFNGCase("",          "TRUE",      GradingVerdict.BLANK)     // TC_GRADE_TF_05
        );
    }

    @ParameterizedTest
    @MethodSource("tfngCases")
    void tfng_parameterized(TFNGCase tc) {
        Map<Integer, PartGradingKey> keys = Map.of(
            2, partKey(2, "q_3", "TRUE_FALSE_NOT_GIVEN", tc.correctKey(), List.of())
        );
        AttemptAnswer answer = new AttemptAnswer();
        answer.setPartId(2);
        answer.setUserAnswers(tc.userAnswer().isEmpty()
            ? Collections.emptyMap()
            : Map.of("q_3", tc.userAnswer()));

        GradingResult result = service.gradeAttempt(List.of(answer), keys);
        assertThat(result.getPartResults().get(2).get("q_3").getVerdict())
            .isEqualTo(tc.expected());
    }

    // ─── TC_GRADE_MC: MULTIPLE_CHOICE ───────────────────────────────────────────

    @Test
    void multipleChoice_correct_different_order() { // TC_GRADE_MC_01
        Map<Integer, PartGradingKey> keys = Map.of(
            10, partKey(10, "q_mc", "MULTIPLE_CHOICE", List.of("A", "C"), List.of())
        );
        AttemptAnswer answer = answerForPart(10, "q_mc", List.of("C", "A"));
        GradingResult result = service.gradeAttempt(List.of(answer), keys);
        assertThat(result.getPartResults().get(10).get("q_mc").getVerdict())
            .isEqualTo(GradingVerdict.CORRECT);
    }

    @Test
    void multipleChoice_missing_one_is_wrong() { // TC_GRADE_MC_02
        Map<Integer, PartGradingKey> keys = Map.of(
            10, partKey(10, "q_mc", "MULTIPLE_CHOICE", List.of("A", "C"), List.of())
        );
        AttemptAnswer answer = answerForPart(10, "q_mc", List.of("A"));
        GradingResult result = service.gradeAttempt(List.of(answer), keys);
        assertThat(result.getPartResults().get(10).get("q_mc").getVerdict())
            .isEqualTo(GradingVerdict.WRONG);
    }

    @Test
    void multipleChoice_extra_one_is_wrong() { // TC_GRADE_MC_03
        Map<Integer, PartGradingKey> keys = Map.of(
            10, partKey(10, "q_mc", "MULTIPLE_CHOICE", List.of("A", "C"), List.of())
        );
        AttemptAnswer answer = answerForPart(10, "q_mc", List.of("A", "B", "C"));
        GradingResult result = service.gradeAttempt(List.of(answer), keys);
        assertThat(result.getPartResults().get(10).get("q_mc").getVerdict())
            .isEqualTo(GradingVerdict.WRONG);
    }

    // ─── TC_GRADE_MA: MATCHING ───────────────────────────────────────────────────

    @Test
    void matching_both_correct() { // TC_GRADE_MA_01
        GradingKey key = new GradingKey();
        key.setQuestionId("q_match");
        key.setType("MATCHING");
        key.setCorrect(Map.of("q_left1", "B", "q_left2", "A"));
        key.setAlternates(List.of());
        PartGradingKey pgk = new PartGradingKey();
        pgk.setPartId(11);
        pgk.setAnswers(Map.of("q_match", key));

        AttemptAnswer answer = new AttemptAnswer();
        answer.setPartId(11);
        answer.setUserAnswers(Map.of("q_match", Map.of("q_left1", "B", "q_left2", "A")));

        GradingResult result = service.gradeAttempt(List.of(answer), Map.of(11, pgk));
        assertThat(result.getTotalScore()).isEqualByComparingTo("2.0");
        // All pairs correct → verdict CORRECT
        assertThat(result.getPartResults().get(11).get("q_match").getVerdict())
            .isEqualTo(GradingVerdict.CORRECT);
    }

    @Test
    void matching_one_correct_one_wrong() { // TC_GRADE_MA_02
        GradingKey key = new GradingKey();
        key.setQuestionId("q_match");
        key.setType("MATCHING");
        key.setCorrect(Map.of("q_left1", "B", "q_left2", "A"));
        key.setAlternates(List.of());
        PartGradingKey pgk = new PartGradingKey();
        pgk.setPartId(11);
        pgk.setAnswers(Map.of("q_match", key));

        AttemptAnswer answer = new AttemptAnswer();
        answer.setPartId(11);
        answer.setUserAnswers(Map.of("q_match", Map.of("q_left1", "B", "q_left2", "C")));

        GradingResult result = service.gradeAttempt(List.of(answer), Map.of(11, pgk));
        assertThat(result.getTotalScore()).isEqualByComparingTo("1.0");
        // Partial match → verdict WRONG (not CORRECT)
        assertThat(result.getPartResults().get(11).get("q_match").getVerdict())
            .isEqualTo(GradingVerdict.WRONG);
    }

    @Test
    void matching_empty_user_map_is_blank() { // TC_GRADE_MA_03
        GradingKey key = new GradingKey();
        key.setQuestionId("q_match");
        key.setType("MATCHING");
        key.setCorrect(Map.of("q_left1", "B", "q_left2", "A"));
        key.setAlternates(List.of());
        PartGradingKey pgk = new PartGradingKey();
        pgk.setPartId(11);
        pgk.setAnswers(Map.of("q_match", key));

        AttemptAnswer answer = new AttemptAnswer();
        answer.setPartId(11);
        answer.setUserAnswers(Collections.emptyMap());

        GradingResult result = service.gradeAttempt(List.of(answer), Map.of(11, pgk));
        assertThat(result.getPartResults().get(11).get("q_match").getVerdict())
            .isEqualTo(GradingVerdict.BLANK);
        assertThat(result.getPartResults().get(11).get("q_match").getScore())
            .isEqualByComparingTo(BigDecimal.ZERO);
    }

    // ─── TC_GRADE_ES_01: ESSAY bỏ qua ───────────────────────────────────────────

    @Test
    void essay_not_counted_in_totalObjectiveCount() {
        GradingKey essayKey = new GradingKey();
        essayKey.setQuestionId("q_8");
        essayKey.setType("ESSAY");
        essayKey.setCorrect(null); // ESSAY has no correct answer
        essayKey.setAlternates(List.of());
        PartGradingKey pgk = new PartGradingKey();
        pgk.setPartId(6);
        pgk.setAnswers(Map.of("q_8", essayKey));

        AttemptAnswer answer = answerForPart(6, "q_8", "Some essay text");

        // Engine skips ESSAY questions — totalObjectiveCount should be 0
        GradingResult result = service.gradeAttempt(List.of(answer), Map.of(6, pgk));
        assertThat(result.getTotalObjectiveCount()).isZero();
        assertThat(result.getTotalScore()).isEqualByComparingTo(BigDecimal.ZERO);
        // partResults should exist for part 6 but be empty (no objective questions)
        assertThat(result.getPartResults().get(6)).isEmpty();
    }

    // ─── TC_GRADE_ERR: Lỗi fixture ───────────────────────────────────────────────

    @Test
    void unknown_type_throws_grading_data_error() { // TC_GRADE_ERR_01
        Map<Integer, PartGradingKey> keys = Map.of(
            99, partKey(99, "q_bad", "UNKNOWN_TYPE", "X", List.of())
        );
        AttemptAnswer answer = answerForPart(99, "q_bad", "X");

        assertThatThrownBy(() -> service.gradeAttempt(List.of(answer), keys))
            .isInstanceOf(AppException.class)
            .hasMessageContaining("GRADING_DATA_ERROR")
            .satisfies(ex -> assertThat(((AppException) ex).getErrorCode().name())
                .isEqualTo("GRADING_DATA_ERROR"));
    }

    @Test
    void null_correct_throws_grading_data_error() { // TC_GRADE_ERR_02
        Map<Integer, PartGradingKey> keys = Map.of(
            99, partKey(99, "q_null", "SINGLE_CHOICE", null, List.of())
        );
        AttemptAnswer answer = answerForPart(99, "q_null", "A");

        assertThatThrownBy(() -> service.gradeAttempt(List.of(answer), keys))
            .isInstanceOf(AppException.class);
    }

    // ─── TC_GRADE_AGG: Tổng hợp ─────────────────────────────────────────────────

    @Test
    void aggregate_counts_across_parts() { // TC_GRADE_AGG_01
        Map<Integer, PartGradingKey> keys = Map.of(
            1, partKey(1, "q_1", "SINGLE_CHOICE", "A", List.of()),
            2, partKey(2, "q_3", "TRUE_FALSE_NOT_GIVEN", "TRUE", List.of())
        );
        List<AttemptAnswer> answers = List.of(
            answerForPart(1, "q_1", "A"),      // CORRECT
            answerForPart(2, "q_3", "FALSE")   // WRONG
        );
        GradingResult result = service.gradeAttempt(answers, keys);
        assertThat(result.getTotalScore()).isEqualByComparingTo("1.0");
        assertThat(result.getCorrectCount()).isEqualTo(1);
        assertThat(result.getTotalObjectiveCount()).isEqualTo(2);
    }

    @Test
    void no_keys_returns_all_blank() { // TC_GRADE_AGG_02
        AttemptAnswer answer = answerForPart(1, "q_1", "A");
        GradingResult result = service.gradeAttempt(List.of(answer), Collections.emptyMap());
        assertThat(result.getTotalScore()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(result.getTotalObjectiveCount()).isZero();
    }

    // ─── Review Focus: Locale-safe normalize ─────────────────────────────────────

    @Test
    void normalize_does_not_corrupt_vietnamese_characters() {
        // "Đ" (U+0110) phải không bị biến thành ký tự khác khi toLowerCase(Locale.ROOT)
        Map<Integer, PartGradingKey> keys = Map.of(
            20, partKey(20, "q_vn", "FILL_IN_THE_BLANK", "đại học", List.of())
        );
        AttemptAnswer answer = answerForPart(20, "q_vn", "Đại Học");
        GradingResult result = service.gradeAttempt(List.of(answer), keys);
        // "Đại Học".toLowerCase(Locale.ROOT) = "đại học" → CORRECT
        assertThat(result.getPartResults().get(20).get("q_vn").getVerdict())
            .isEqualTo(GradingVerdict.CORRECT);
    }

    // ─── TC_GRADE_SEC: sectionScores accumulation ────────────────────────────────

    @Test
    void sectionScores_accumulated_by_sectionName() {
        // Part 1 (Reading): 1 correct → 1.0
        GradingKey k1 = new GradingKey();
        k1.setQuestionId("q_1"); k1.setType("SINGLE_CHOICE"); k1.setCorrect("A"); k1.setAlternates(List.of());
        PartGradingKey pgk1 = new PartGradingKey();
        pgk1.setPartId(1); pgk1.setSectionName("Reading"); pgk1.setAnswers(Map.of("q_1", k1));

        // Part 2 (Reading): 1 correct → 1.0
        GradingKey k2 = new GradingKey();
        k2.setQuestionId("q_2"); k2.setType("SINGLE_CHOICE"); k2.setCorrect("B"); k2.setAlternates(List.of());
        PartGradingKey pgk2 = new PartGradingKey();
        pgk2.setPartId(2); pgk2.setSectionName("Reading"); pgk2.setAnswers(Map.of("q_2", k2));

        // Part 3 (Listening): 1 wrong → 0.0
        GradingKey k3 = new GradingKey();
        k3.setQuestionId("q_3"); k3.setType("SINGLE_CHOICE"); k3.setCorrect("C"); k3.setAlternates(List.of());
        PartGradingKey pgk3 = new PartGradingKey();
        pgk3.setPartId(3); pgk3.setSectionName("Listening"); pgk3.setAnswers(Map.of("q_3", k3));

        Map<Integer, PartGradingKey> keys = Map.of(1, pgk1, 2, pgk2, 3, pgk3);
        List<AttemptAnswer> answers = List.of(
            answerForPart(1, "q_1", "A"),  // CORRECT
            answerForPart(2, "q_2", "B"),  // CORRECT
            answerForPart(3, "q_3", "X")   // WRONG
        );

        GradingResult result = service.gradeAttempt(answers, keys);

        // Reading = 1.0 + 1.0 = 2.0
        assertThat(result.getSectionScores().get("Reading"))
            .isEqualByComparingTo(new BigDecimal("2.0"));
        // Listening = 0.0
        assertThat(result.getSectionScores().get("Listening"))
            .isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(result.getSectionScores()).hasSize(2);
    }

    @Test
    void sectionScores_empty_when_no_sectionName() {
        // PartGradingKey without sectionName → sectionScores should not contain any entry
        Map<Integer, PartGradingKey> keys = Map.of(
            1, partKey(1, "q_1", "SINGLE_CHOICE", "A", List.of())
        );
        AttemptAnswer answer = answerForPart(1, "q_1", "A");

        GradingResult result = service.gradeAttempt(List.of(answer), keys);
        assertThat(result.getSectionScores()).isEmpty();
    }
}
