package com.multilingo.backend.modules.testing.ai.grading;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WritingGradingOutputParserTest {

    private final WritingGradingOutputParser parser = new WritingGradingOutputParser();

    private static final String ORIGINAL_ESSAY = "Learning language is good for career and opens many chance.";
    // Valid corrections that apply to ORIGINAL_ESSAY:
    // 1. "Learning " (0..9) -> "Learning a "
    // 2. "career" (30..36) -> "one's career"
    // 3. "chance." (52..59) -> "opportunities."
    // Corrected: "Learning a language is good for one's career and opens many opportunities."
    private static final String CORRECTED_ESSAY = "Learning a language is good for one's career and opens many opportunities.";

    private static String validTextOnlyJsonResponse(double tr, double cc, double lr, double gra) {
        return """
                {
                  "feedbackLanguage": "vi",
                  "criteria": [
                    {"code": "TR", "score": %s, "feedback": "Nhận xét tiêu chí Task Response chi tiết."},
                    {"code": "CC", "score": %s, "feedback": "Nhận xét tiêu chí Coherence and Cohesion chi tiết."},
                    {"code": "LR", "score": %s, "feedback": "Nhận xét tiêu chí Lexical Resource chi tiết."},
                    {"code": "GRA", "score": %s, "feedback": "Nhận xét tiêu chí Grammatical Range chi tiết."}
                  ],
                  "overallFeedback": "Đánh giá tổng quan bài viết của học viên rất tốt.",
                  "correctedEssay": "Learning a language is good for one's career and opens many opportunities.",
                  "corrections": [
                    {"start": 0, "end": 9, "replacement": "Learning a ", "explanation": "Thêm mạo từ a trước danh từ đếm được."},
                    {"start": 30, "end": 36, "replacement": "one's career", "explanation": "Dùng tính từ sở hữu để văn phong tự nhiên hơn."},
                    {"start": 52, "end": 59, "replacement": "opportunities.", "explanation": "Dùng từ chính xác và trang trọng hơn."}
                  ]
                }
                """.formatted(tr, cc, lr, gra);
    }

    private static String validVisualJsonResponse(double tr, double cc, double lr, double gra, String visualObs) {
        return """
                {
                  "feedbackLanguage": "vi",
                  "visualObservations": "%s",
                  "criteria": [
                    {"code": "TR", "score": %s, "feedback": "Nhận xét tiêu chí Task Response chi tiết."},
                    {"code": "CC", "score": %s, "feedback": "Nhận xét tiêu chí Coherence and Cohesion chi tiết."},
                    {"code": "LR", "score": %s, "feedback": "Nhận xét tiêu chí Lexical Resource chi tiết."},
                    {"code": "GRA", "score": %s, "feedback": "Nhận xét tiêu chí Grammatical Range chi tiết."}
                  ],
                  "overallFeedback": "Đánh giá tổng quan bài viết của học viên rất tốt.",
                  "correctedEssay": "Learning a language is good for one's career and opens many opportunities.",
                  "corrections": [
                    {"start": 0, "end": 9, "replacement": "Learning a ", "explanation": "Thêm mạo từ a trước danh từ đếm được."},
                    {"start": 30, "end": 36, "replacement": "one's career", "explanation": "Dùng tính từ sở hữu để văn phong tự nhiên hơn."},
                    {"start": 52, "end": 59, "replacement": "opportunities.", "explanation": "Dùng từ chính xác và trang trọng hơn."}
                  ]
                }
                """.formatted(visualObs, tr, cc, lr, gra);
    }

    @Test
    @DisplayName("Should successfully parse valid text-only JSON output and calculate overall score correctly")
    void parse_validJsonOutput_returnsWritingGradeWithCorrectCalculations() {
        String json = validTextOnlyJsonResponse(6.0, 6.5, 7.0, 6.5); // sum = 26.0 / 4 = 6.5

        WritingGrade grade = parser.parse(json, ORIGINAL_ESSAY, false);

        assertThat(grade).isNotNull();
        assertThat(grade.rubricCode()).isEqualTo("WRITING_EN_V1");
        assertThat(grade.feedbackLanguage()).isEqualTo("vi");
        assertThat(grade.overallScore()).isEqualByComparingTo(new BigDecimal("6.5"));
        assertThat(grade.criteria()).hasSize(4);
        assertThat(grade.criteria()).extracting(WritingGrade.CriterionGrade::code)
                .containsExactly("TR", "CC", "LR", "GRA");
        assertThat(grade.overallFeedback()).contains("Đánh giá tổng quan");
        assertThat(grade.correctedEssay()).isEqualTo(CORRECTED_ESSAY);
        assertThat(grade.corrections()).hasSize(3);
        assertThat(grade.visualObservations()).isNull();

        // Verify diff invariants
        assertThat(WritingDiffBuilder.joinWithoutInsert(grade.diff())).isEqualTo(ORIGINAL_ESSAY);
        assertThat(WritingDiffBuilder.joinWithoutDelete(grade.diff())).isEqualTo(CORRECTED_ESSAY);
    }

    @Test
    void genericRubricAcceptsTenAndUsesFrozenFeedbackLanguageButEnglishRejectsTen() {
        WritingRubricRegistry registry = new WritingRubricRegistry(new com.multilingo.backend.common.i18n.LearningLanguageCatalog());
        WritingRubricPolicy generic = registry.resolve("NLTV", "vi");
        String tenPoint = validTextOnlyJsonResponse(10, 10, 10, 10).replace("\"feedbackLanguage\": \"vi\"", "\"feedbackLanguage\": \"fr\"");
        WritingGrade grade = parser.parse(tenPoint, ORIGINAL_ESSAY, false, generic, "fr");
        assertThat(grade.rubricCode()).isEqualTo("WRITING_GENERIC_V1");
        assertThat(grade.feedbackLanguage()).isEqualTo("fr");
        assertThat(grade.overallScore()).isEqualByComparingTo("10.0");
        assertThatThrownBy(() -> parser.parse(tenPoint, ORIGINAL_ESSAY, false,
                registry.resolve("IELTS_ACADEMIC", "en"), "fr"))
                .isInstanceOf(WritingGradingException.class);
    }

    @Test
    @DisplayName("F4: Should successfully parse valid multimodal JSON output with visualObservations")
    void parse_validVisualJsonOutput_returnsGradeWithVisualObservations() {
        String visualObs = "Biểu đồ cột thể hiện mức tiêu thụ năng lượng từ 2010 đến 2020.";
        String json = validVisualJsonResponse(6.0, 6.5, 7.0, 6.5, visualObs);

        WritingGrade grade = parser.parse(json, ORIGINAL_ESSAY, true);

        assertThat(grade).isNotNull();
        assertThat(grade.rubricCode()).isEqualTo("WRITING_EN_V1");
        assertThat(grade.visualObservations()).isEqualTo(visualObs);
        assertThat(grade.overallScore()).isEqualByComparingTo(new BigDecimal("6.5"));
    }

    @Test
    @DisplayName("F4: Should reject visual context response when visualObservations is missing")
    void parse_visualContext_missingVisualObservations_throwsMalformed() {
        String json = validTextOnlyJsonResponse(6.0, 6.5, 7.0, 6.5); // missing visualObservations
        assertThatThrownBy(() -> parser.parse(json, ORIGINAL_ESSAY, true))
                .isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> {
                    WritingGradingFailure failure = ((WritingGradingException) ex).getFailure();
                    assertThat(failure.errorCode()).isEqualTo("MALFORMED_OUTPUT");
                    assertThat(failure.isTerminal()).isTrue();
                });
    }

    @Test
    @DisplayName("F4: Should reject visual context response when visualObservations is blank")
    void parse_visualContext_blankVisualObservations_throwsMalformed() {
        String json = validVisualJsonResponse(6.0, 6.5, 7.0, 6.5, "   ");
        assertThatThrownBy(() -> parser.parse(json, ORIGINAL_ESSAY, true))
                .isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> {
                    WritingGradingFailure failure = ((WritingGradingException) ex).getFailure();
                    assertThat(failure.errorCode()).isEqualTo("MALFORMED_OUTPUT");
                });
    }

    @Test
    @DisplayName("F4: Should reject visual context response when visualObservations exceeds 1000 code points")
    void parse_visualContext_over1000CodePoints_throwsMalformed() {
        String hugeObs = "Đ".repeat(1001);
        String json = validVisualJsonResponse(6.0, 6.5, 7.0, 6.5, hugeObs);
        assertThatThrownBy(() -> parser.parse(json, ORIGINAL_ESSAY, true))
                .isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> {
                    WritingGradingFailure failure = ((WritingGradingException) ex).getFailure();
                    assertThat(failure.errorCode()).isEqualTo("MALFORMED_OUTPUT");
                });
    }

    @Test
    @DisplayName("F4: Should reject text-only response when visualObservations is provided (forbidden for text-only)")
    void parse_textOnly_withVisualObservations_throwsMalformed() {
        String json = validVisualJsonResponse(6.0, 6.5, 7.0, 6.5, "Mô tả biểu đồ");
        assertThatThrownBy(() -> parser.parse(json, ORIGINAL_ESSAY, false))
                .isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> {
                    WritingGradingFailure failure = ((WritingGradingException) ex).getFailure();
                    assertThat(failure.errorCode()).isEqualTo("MALFORMED_OUTPUT");
                });
    }

    @Test
    @DisplayName("F1: Parser should never leak sentinel tokens from unknown root, criterion, or correction keys")
    void parse_unknownKeyWithSentinel_doesNotLeakInSafeMessageOrException() {
        String sentinel = "PRIVATE_URL?signature=SECRET_TOKEN_XYZ";

        // Unknown key at root
        String rootUnknown = validTextOnlyJsonResponse(6.0, 6.5, 7.0, 6.5)
                .replace("\"feedbackLanguage\": \"vi\",", "\"feedbackLanguage\": \"vi\", \"" + sentinel + "\": \"val\",");
        assertThatThrownBy(() -> parser.parse(rootUnknown, ORIGINAL_ESSAY, false))
                .isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> {
                    WritingGradingException we = (WritingGradingException) ex;
                    assertThat(we.getMessage()).doesNotContain("SECRET_TOKEN_XYZ", "PRIVATE_URL");
                    assertThat(we.getFailure().safeMessage()).doesNotContain("SECRET_TOKEN_XYZ", "PRIVATE_URL");
                    assertThat(we.toString()).doesNotContain("SECRET_TOKEN_XYZ", "PRIVATE_URL");
                });

        // Unknown key in criterion
        String critUnknown = validTextOnlyJsonResponse(6.0, 6.5, 7.0, 6.5)
                .replace("\"code\": \"TR\",", "\"code\": \"TR\", \"" + sentinel + "\": \"val\",");
        assertThatThrownBy(() -> parser.parse(critUnknown, ORIGINAL_ESSAY, false))
                .isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> {
                    WritingGradingException we = (WritingGradingException) ex;
                    assertThat(we.getMessage()).doesNotContain("SECRET_TOKEN_XYZ", "PRIVATE_URL");
                    assertThat(we.getFailure().safeMessage()).doesNotContain("SECRET_TOKEN_XYZ", "PRIVATE_URL");
                    assertThat(we.toString()).doesNotContain("SECRET_TOKEN_XYZ", "PRIVATE_URL");
                });

        // Unknown key in correction
        String corrUnknown = validTextOnlyJsonResponse(6.0, 6.5, 7.0, 6.5)
                .replace("\"start\": 0,", "\"start\": 0, \"" + sentinel + "\": \"val\",");
        assertThatThrownBy(() -> parser.parse(corrUnknown, ORIGINAL_ESSAY, false))
                .isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> {
                    WritingGradingException we = (WritingGradingException) ex;
                    assertThat(we.getMessage()).doesNotContain("SECRET_TOKEN_XYZ", "PRIVATE_URL");
                    assertThat(we.getFailure().safeMessage()).doesNotContain("SECRET_TOKEN_XYZ", "PRIVATE_URL");
                    assertThat(we.toString()).doesNotContain("SECRET_TOKEN_XYZ", "PRIVATE_URL");
                });
    }

    @Test
    @DisplayName("F1: Malformed JSON with private sentinel should not leak sentinel through Jackson parser message")
    void parse_malformedJsonWithSentinel_doesNotLeakInException() {
        String malformedJson = "{ \"secret\": \"PRIVATE_RESPONSE_SENTINEL_ABC\", invalid_syntax ";
        assertThatThrownBy(() -> parser.parse(malformedJson, ORIGINAL_ESSAY, false))
                .isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> {
                    WritingGradingException we = (WritingGradingException) ex;
                    assertThat(we.getMessage()).doesNotContain("PRIVATE_RESPONSE_SENTINEL_ABC");
                    assertThat(we.getFailure().safeMessage()).doesNotContain("PRIVATE_RESPONSE_SENTINEL_ABC");
                    assertThat(we.toString()).doesNotContain("PRIVATE_RESPONSE_SENTINEL_ABC");
                });
    }

    @Test
    @DisplayName("F2: Duplicate keys at root level should be rejected with terminal MALFORMED_OUTPUT")
    void parse_duplicateKeysAtRoot_throwsMalformedOutput() {
        // Duplicate key with same value
        String dupSame = validTextOnlyJsonResponse(6.0, 6.5, 7.0, 6.5)
                .replace("\"feedbackLanguage\": \"vi\",", "\"feedbackLanguage\": \"vi\", \"feedbackLanguage\": \"vi\",");
        assertThatThrownBy(() -> parser.parse(dupSame, ORIGINAL_ESSAY, false))
                .isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> assertThat(((WritingGradingException) ex).getFailure().errorCode()).isEqualTo("MALFORMED_OUTPUT"));

        // Duplicate key with different value
        String dupDiff = validTextOnlyJsonResponse(6.0, 6.5, 7.0, 6.5)
                .replace("\"feedbackLanguage\": \"vi\",", "\"feedbackLanguage\": \"en\", \"feedbackLanguage\": \"vi\",");
        assertThatThrownBy(() -> parser.parse(dupDiff, ORIGINAL_ESSAY, false))
                .isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> assertThat(((WritingGradingException) ex).getFailure().errorCode()).isEqualTo("MALFORMED_OUTPUT"));
    }

    @Test
    @DisplayName("F2: Duplicate keys in criterion or correction should be rejected with terminal MALFORMED_OUTPUT")
    void parse_duplicateKeysInNestedObjects_throwsMalformedOutput() {
        // Duplicate key in criterion
        String dupCrit = validTextOnlyJsonResponse(6.0, 6.5, 7.0, 6.5)
                .replace("\"score\": 6.0,", "\"score\": 0.0, \"score\": 6.0,");
        assertThatThrownBy(() -> parser.parse(dupCrit, ORIGINAL_ESSAY, false))
                .isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> assertThat(((WritingGradingException) ex).getFailure().errorCode()).isEqualTo("MALFORMED_OUTPUT"));

        // Duplicate key in correction
        String dupCorr = validTextOnlyJsonResponse(6.0, 6.5, 7.0, 6.5)
                .replace("\"start\": 0,", "\"start\": 1, \"start\": 0,");
        assertThatThrownBy(() -> parser.parse(dupCorr, ORIGINAL_ESSAY, false))
                .isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> assertThat(((WritingGradingException) ex).getFailure().errorCode()).isEqualTo("MALFORMED_OUTPUT"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"6.25", "-0.01", "9.01", "1e100", "-0.5", "9.5", "NaN"})
    @DisplayName("F3: Non-half-step scores, out-of-bounds, and exponential formats must throw classified terminal MALFORMED_OUTPUT without unhandled ArithmeticException")
    void parse_invalidScoreValues_throwsClassifiedTerminalMalformed(String invalidScore) {
        String json = validTextOnlyJsonResponse(6.0, 6.5, 7.0, 6.5)
                .replace("\"score\": 6.0,", "\"score\": " + invalidScore + ",");

        assertThatThrownBy(() -> parser.parse(json, ORIGINAL_ESSAY, false))
                .isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> {
                    WritingGradingFailure failure = ((WritingGradingException) ex).getFailure();
                    assertThat(failure.errorCode()).isEqualTo("MALFORMED_OUTPUT");
                    assertThat(failure.isTerminal()).isTrue();
                    assertThat(failure.isRetryable()).isFalse();
                });
    }

    @ParameterizedTest(name = "Scores ({0}, {1}, {2}, {3}) should produce overall {4}")
    @CsvSource({
            "6.0, 6.5, 7.0, 6.5, 6.5", // avg 6.50 -> 6.5
            "6.0, 6.0, 6.5, 6.5, 6.5", // avg 6.25 -> 6.5 (HALF_UP)
            "6.0, 6.0, 6.0, 6.5, 6.0", // avg 6.125 -> 6.0
            "6.0, 6.5, 6.5, 6.5, 6.5", // avg 6.375 -> 6.5 (HALF_UP)
            "6.5, 7.0, 6.5, 7.0, 7.0", // avg 6.75 -> 7.0 (HALF_UP)
            "0.0, 0.0, 0.0, 0.0, 0.0", // avg 0.0 -> 0.0
            "9.0, 9.0, 9.0, 9.0, 9.0"  // avg 9.0 -> 9.0
    })
    @DisplayName("Should round overall score to nearest 0.5 step using HALF_UP")
    void parse_overallScore_roundsToNearestHalfStepHalfUp(double tr, double cc, double lr, double gra, String expectedOverall) {
        String json = validTextOnlyJsonResponse(tr, cc, lr, gra);
        WritingGrade grade = parser.parse(json, ORIGINAL_ESSAY, false);
        assertThat(grade.overallScore()).isEqualByComparingTo(new BigDecimal(expectedOverall));
    }

    @Test
    @DisplayName("Should reject non-Vietnamese feedbackLanguage")
    void parse_invalidLanguage_throwsMalformedOutput() {
        String json = validTextOnlyJsonResponse(6.0, 6.5, 7.0, 6.5).replace("\"feedbackLanguage\": \"vi\"", "\"feedbackLanguage\": \"en\"");
        assertThatThrownBy(() -> parser.parse(json, ORIGINAL_ESSAY, false))
                .isInstanceOf(WritingGradingException.class)
                .hasMessageContaining("feedbackLanguage");
    }

    @Test
    @DisplayName("Should reject criteria with missing or duplicate codes")
    void parse_missingOrDuplicateCriteria_throwsMalformedOutput() {
        String json = """
                {
                  "feedbackLanguage": "vi",
                  "criteria": [
                    {"code": "TR", "score": 6.0, "feedback": "f1"},
                    {"code": "TR", "score": 6.5, "feedback": "f2"},
                    {"code": "LR", "score": 7.0, "feedback": "f3"},
                    {"code": "GRA", "score": 6.5, "feedback": "f4"}
                  ],
                  "overallFeedback": "overall",
                  "correctedEssay": "%s",
                  "corrections": []
                }
                """.formatted(ORIGINAL_ESSAY);

        assertThatThrownBy(() -> parser.parse(json, ORIGINAL_ESSAY, false))
                .isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> assertThat(((WritingGradingException) ex).getFailure().errorCode()).isEqualTo("MALFORMED_OUTPUT"));
    }

    @Test
    @DisplayName("Should reject markdown code fences")
    void parse_codeFences_throwsMalformedOutput() {
        String json = "```json\n" + validTextOnlyJsonResponse(6.0, 6.5, 7.0, 6.5) + "\n```";
        assertThatThrownBy(() -> parser.parse(json, ORIGINAL_ESSAY, false))
                .isInstanceOf(WritingGradingException.class)
                .hasMessageContaining("fence");
    }

    @Test
    @DisplayName("Should reject trailing content after JSON")
    void parse_trailingContent_throwsMalformedOutput() {
        String json = validTextOnlyJsonResponse(6.0, 6.5, 7.0, 6.5) + "\nExtra trailing notes.";
        assertThatThrownBy(() -> parser.parse(json, ORIGINAL_ESSAY, false))
                .isInstanceOf(WritingGradingException.class);
    }

    @Test
    @DisplayName("Should reject output when reconstructed essay does not match correctedEssay")
    void parse_reconstructedEssayMismatch_throwsMalformedOutput() {
        String json = validTextOnlyJsonResponse(6.0, 6.5, 7.0, 6.5).replace("Learning a language is good", "Completely different text");
        assertThatThrownBy(() -> parser.parse(json, ORIGINAL_ESSAY, false))
                .isInstanceOf(WritingGradingException.class)
                .hasMessageContaining("Reconstructed");
    }

    @Test
    @DisplayName("Should reject output exceeding 64 KiB")
    void parse_outputExceeding64KiB_throwsMalformedOutput() {
        String hugeString = "A".repeat(65537);
        assertThatThrownBy(() -> parser.parse(hugeString, ORIGINAL_ESSAY, false))
                .isInstanceOf(WritingGradingException.class);
    }

    @Test
    @DisplayName("Should reject criterion feedback exceeding 1000 code points")
    void parse_criterionFeedbackExceedingLimit_throwsMalformedOutput() {
        String longFeedback = "X".repeat(1001);
        String json = validTextOnlyJsonResponse(6.0, 6.5, 7.0, 6.5).replace("Nhận xét tiêu chí Task Response chi tiết.", longFeedback);
        assertThatThrownBy(() -> parser.parse(json, ORIGINAL_ESSAY, false))
                .isInstanceOf(WritingGradingException.class);
    }

    @Test
    @DisplayName("Should reject overall feedback exceeding 2000 code points")
    void parse_overallFeedbackExceedingLimit_throwsMalformedOutput() {
        String longFeedback = "Y".repeat(2001);
        String json = validTextOnlyJsonResponse(6.0, 6.5, 7.0, 6.5).replace("Đánh giá tổng quan bài viết của học viên rất tốt.", longFeedback);
        assertThatThrownBy(() -> parser.parse(json, ORIGINAL_ESSAY, false))
                .isInstanceOf(WritingGradingException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"6.5000000000000001", "9.0000000000000001"})
    void parse_exactDecimalNotHalfStep_rejectsBeforeRounding(String token) {
        String json = validTextOnlyJsonResponse(6.0, 6.5, 7.0, 6.5)
                .replace("\"score\": 6.0,", "\"score\": " + token + ",");
        assertThatThrownBy(() -> parser.parse(json, ORIGINAL_ESSAY))
                .isInstanceOf(WritingGradingException.class).hasCause(null)
                .satisfies(e -> assertThat(((WritingGradingException)e).getFailure().errorCode()).isEqualTo("MALFORMED_OUTPUT"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"6.5", "6.50", "6.5e0", "65e-1"})
    void parse_equivalentExactDecimals_preservesHalfStepAndHalfUp(String token) {
        String json = validTextOnlyJsonResponse(6.0, 6.0, 6.5, 6.5)
                .replace("\"score\": 6.5,", "\"score\": " + token + ",");
        WritingGrade grade = parser.parse(json, ORIGINAL_ESSAY);
        assertThat(grade.overallScore()).isEqualByComparingTo("6.5");
        assertThat(grade.rubricCode()).isEqualTo("WRITING_EN_V1");
    }
}
