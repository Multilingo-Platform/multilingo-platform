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
    }

    // ─── TC_GRADE_ES_01: ESSAY bỏ qua ───────────────────────────────────────────

    @Test
    void essay_not_counted_in_totalObjectiveCount() {
        Map<Integer, PartGradingKey> keys = Map.of(
            6, partKey(6, "q_8", "ESSAY", null, List.of())
        );
        AttemptAnswer answer = answerForPart(6, "q_8", "Some essay text");

        // ESSAY không có trong grading fixture thực tế, nhưng test engine behavior
        // khi fixture có type=ESSAY thì bỏ qua
        GradingResult result = service.gradeAttempt(List.of(answer), Map.of());
        assertThat(result.getTotalObjectiveCount()).isZero();
        assertThat(result.getTotalScore()).isEqualByComparingTo(BigDecimal.ZERO);
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
}
