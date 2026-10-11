package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.dto.request.PracticeFeedbackRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PracticeFeedbackRequestValidatorTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private PracticeFeedbackRequestValidator validator;

    @BeforeEach
    void setUp() {
        validator = new PracticeFeedbackRequestValidator();
    }

    private PracticeFeedbackRequest parseRequest(String json) throws Exception {
        return objectMapper.readValue(json, PracticeFeedbackRequest.class);
    }

    @Test
    @DisplayName("Valid request with string answer parses correctly")
    void validate_validStringAnswer_success() throws Exception {
        String json = """
            {
                "partId": 10,
                "questionId": "q_1",
                "answer": "A"
            }
            """;
        PracticeFeedbackRequest request = parseRequest(json);
        PracticeFeedbackRequestValidator.ValidatedFeedbackInput input = validator.validate(request);

        assertThat(input.partId()).isEqualTo(10);
        assertThat(input.questionId()).isEqualTo("q_1");
        assertThat(input.answer()).isEqualTo("A");
    }

    @Test
    @DisplayName("Valid request with Unicode and un-trimmed questionId preserved")
    void validate_unicodeAndSpaceInQuestionId_preserved() throws Exception {
        String json = """
            {
                "partId": 1,
                "questionId": "q Tiếng Việt 1",
                "answer": "Đáp án A"
            }
            """;
        PracticeFeedbackRequest request = parseRequest(json);
        PracticeFeedbackRequestValidator.ValidatedFeedbackInput input = validator.validate(request);

        assertThat(input.partId()).isEqualTo(1);
        assertThat(input.questionId()).isEqualTo("q Tiếng Việt 1");
        assertThat(input.answer()).isEqualTo("Đáp án A");
    }

    @Test
    @DisplayName("Explicit JSON null for answer is preserved as null")
    void validate_explicitNullAnswer_returnsNull() throws Exception {
        String json = """
            {
                "partId": 10,
                "questionId": "q_1",
                "answer": null
            }
            """;
        PracticeFeedbackRequest request = parseRequest(json);
        PracticeFeedbackRequestValidator.ValidatedFeedbackInput input = validator.validate(request);

        assertThat(input.partId()).isEqualTo(10);
        assertThat(input.questionId()).isEqualTo("q_1");
        assertThat(input.answer()).isNull();
    }

    @Test
    @DisplayName("Missing answer field throws AppException VALIDATION_FAILED")
    void validate_missingAnswerField_throwsException() throws Exception {
        String json = """
            {
                "partId": 10,
                "questionId": "q_1"
            }
            """;
        PracticeFeedbackRequest request = parseRequest(json);

        assertThatThrownBy(() -> validator.validate(request))
                .isInstanceOf(AppException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    @Test
    @DisplayName("Valid array answer parsed into unmodifiable List<String>")
    void validate_validArrayAnswer_success() throws Exception {
        String json = """
            {
                "partId": 10,
                "questionId": "q_mcq",
                "answer": ["A", "C"]
            }
            """;
        PracticeFeedbackRequest request = parseRequest(json);
        PracticeFeedbackRequestValidator.ValidatedFeedbackInput input = validator.validate(request);

        assertThat(input.answer()).isEqualTo(List.of("A", "C"));
    }

    @Test
    @DisplayName("Valid object answer parsed into unmodifiable Map<String, String>")
    void validate_validMapAnswer_success() throws Exception {
        String json = """
            {
                "partId": 10,
                "questionId": "q_matching",
                "answer": {
                    "item_1": "target_A",
                    "item_2": "target_B"
                }
            }
            """;
        PracticeFeedbackRequest request = parseRequest(json);
        PracticeFeedbackRequestValidator.ValidatedFeedbackInput input = validator.validate(request);

        assertThat(input.answer()).isEqualTo(Map.of("item_1", "target_A", "item_2", "target_B"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "{\"partId\": 0, \"questionId\": \"q1\", \"answer\": \"A\"}",
        "{\"partId\": -1, \"questionId\": \"q1\", \"answer\": \"A\"}",
        "{\"partId\": 2147483648, \"questionId\": \"q1\", \"answer\": \"A\"}",
        "{\"partId\": 10.5, \"questionId\": \"q1\", \"answer\": \"A\"}",
        "{\"partId\": \"10\", \"questionId\": \"q1\", \"answer\": \"A\"}",
        "{\"partId\": true, \"questionId\": \"q1\", \"answer\": \"A\"}",
        "{\"partId\": null, \"questionId\": \"q1\", \"answer\": \"A\"}",
        "{\"questionId\": \"q1\", \"answer\": \"A\"}"
    })
    @DisplayName("Invalid partId formats and bounds are rejected")
    void validate_invalidPartId_throwsException(String json) throws Exception {
        PracticeFeedbackRequest request = parseRequest(json);

        assertThatThrownBy(() -> validator.validate(request))
                .isInstanceOf(AppException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "{\"partId\": 10, \"questionId\": \"\", \"answer\": \"A\"}",
        "{\"partId\": 10, \"questionId\": \"   \", \"answer\": \"A\"}",
        "{\"partId\": 10, \"questionId\": 123, \"answer\": \"A\"}",
        "{\"partId\": 10, \"questionId\": true, \"answer\": \"A\"}",
        "{\"partId\": 10, \"questionId\": {}, \"answer\": \"A\"}",
        "{\"partId\": 10, \"questionId\": null, \"answer\": \"A\"}",
        "{\"partId\": 10, \"answer\": \"A\"}"
    })
    @DisplayName("Invalid questionId formats and blank values are rejected")
    void validate_invalidQuestionId_throwsException(String json) throws Exception {
        PracticeFeedbackRequest request = parseRequest(json);

        assertThatThrownBy(() -> validator.validate(request))
                .isInstanceOf(AppException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "{\"partId\": 10, \"questionId\": \"q1\", \"answer\": 123}",
        "{\"partId\": 10, \"questionId\": \"q1\", \"answer\": true}",
        "{\"partId\": 10, \"questionId\": \"q1\", \"answer\": [\"A\", 123]}",
        "{\"partId\": 10, \"questionId\": \"q1\", \"answer\": [\"A\", {}]}",
        "{\"partId\": 10, \"questionId\": \"q1\", \"answer\": [\"A\", null]}",
        "{\"partId\": 10, \"questionId\": \"q1\", \"answer\": {\"k\": 123}}",
        "{\"partId\": 10, \"questionId\": \"q1\", \"answer\": {\"k\": null}}",
        "{\"partId\": 10, \"questionId\": \"q1\", \"answer\": {\"k\": {}}}"
    })
    @DisplayName("Malformed answer shapes with non-string elements are rejected")
    void validate_malformedAnswerShape_throwsException(String json) throws Exception {
        PracticeFeedbackRequest request = parseRequest(json);

        assertThatThrownBy(() -> validator.validate(request))
                .isInstanceOf(AppException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    @Test
    @DisplayName("validateAnswerForType accepts valid string or null for SINGLE_CHOICE and aliases")
    void validateAnswerForType_singleChoice_valid() {
        validator.validateAnswerForType("SINGLE_CHOICE", "A");
        validator.validateAnswerForType("MCQ", "A");
        validator.validateAnswerForType("TFNG", "TRUE");
        validator.validateAnswerForType("YNNG", "YES");
        validator.validateAnswerForType("FILL_IN_THE_BLANK", "water");
        validator.validateAnswerForType("FILL_IN", "water");
        validator.validateAnswerForType("MATCHING_FEATURES", "A");
        validator.validateAnswerForType("MATCHING_HEADINGS", "i");
        validator.validateAnswerForType("DIAGRAM_LABELING", "valve");
        validator.validateAnswerForType("MAP_LABELING", "bridge");

        validator.validateAnswerForType("SINGLE_CHOICE", null);
        validator.validateAnswerForType("FILL_IN_THE_BLANK", null);
    }

    @Test
    @DisplayName("validateAnswerForType rejects non-string answer for SINGLE_CHOICE")
    void validateAnswerForType_singleChoice_invalidType() {
        assertThatThrownBy(() -> validator.validateAnswerForType("SINGLE_CHOICE", List.of("A")))
                .isInstanceOf(AppException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.VALIDATION_FAILED);

        assertThatThrownBy(() -> validator.validateAnswerForType("SINGLE_CHOICE", Map.of("a", "b")))
                .isInstanceOf(AppException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    @Test
    @DisplayName("validateAnswerForType accepts list or null for MULTIPLE_CHOICE")
    void validateAnswerForType_multipleChoice() {
        validator.validateAnswerForType("MULTIPLE_CHOICE", List.of("A", "B"));
        validator.validateAnswerForType("MULTIPLE_CHOICE", null);

        assertThatThrownBy(() -> validator.validateAnswerForType("MULTIPLE_CHOICE", "A"))
                .isInstanceOf(AppException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.VALIDATION_FAILED);

        assertThatThrownBy(() -> validator.validateAnswerForType("MULTIPLE_CHOICE", Map.of("a", "b")))
                .isInstanceOf(AppException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    @Test
    @DisplayName("validateAnswerForType accepts map or null for MATCHING")
    void validateAnswerForType_matching() {
        validator.validateAnswerForType("MATCHING", Map.of("1", "A", "2", "B"));
        validator.validateAnswerForType("MATCHING", null);

        assertThatThrownBy(() -> validator.validateAnswerForType("MATCHING", "A"))
                .isInstanceOf(AppException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.VALIDATION_FAILED);

        assertThatThrownBy(() -> validator.validateAnswerForType("MATCHING", List.of("A")))
                .isInstanceOf(AppException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    @Test
    @DisplayName("validateAnswerForType rejects ESSAY with 422 VALIDATION_FAILED")
    void validateAnswerForType_essay_rejected() {
        assertThatThrownBy(() -> validator.validateAnswerForType("ESSAY", "An essay text"))
                .isInstanceOf(AppException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.VALIDATION_FAILED);

        assertThatThrownBy(() -> validator.validateAnswerForType("ESSAY", null))
                .isInstanceOf(AppException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    @Test
    @DisplayName("validateAnswerForType rejects unknown question types")
    void validateAnswerForType_unknownType_rejected() {
        assertThatThrownBy(() -> validator.validateAnswerForType("UNKNOWN_TYPE", "A"))
                .isInstanceOf(AppException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }
}
