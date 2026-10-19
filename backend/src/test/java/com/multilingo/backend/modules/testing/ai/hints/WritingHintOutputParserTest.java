package com.multilingo.backend.modules.testing.ai.hints;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.common.exception.GlobalExceptionHandler;
import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import com.multilingo.backend.modules.testing.dto.response.WritingHintsResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WritingHintOutputParserTest {

    private WritingHintOutputParser parser;
    private GlobalExceptionHandler exceptionHandler;

    @BeforeEach
    void setUp() {
        LearningLanguageCatalog catalog = new LearningLanguageCatalog();
        parser = new WritingHintOutputParser(catalog);
        exceptionHandler = new GlobalExceptionHandler();
    }

    private String createValidJson(int vocabCount, int outlineSections, int pointsPerSection, boolean withLimitations) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\n");
        sb.append("  \"hintLanguage\": \"en\",\n");
        sb.append("  \"outline\": [\n");
        for (int i = 1; i <= outlineSections; i++) {
            sb.append("    {\"title\": \"Section ").append(i).append("\", \"points\": [");
            for (int p = 1; p <= pointsPerSection; p++) {
                sb.append("\"Point ").append(p).append("\"");
                if (p < pointsPerSection) sb.append(", ");
            }
            sb.append("]}");
            if (i < outlineSections) sb.append(",\n");
        }
        sb.append("\n  ],\n");
        sb.append("  \"vocabulary\": [\n");
        for (int i = 1; i <= vocabCount; i++) {
            sb.append(String.format("    {\"term\": \"term%d\", \"definition\": \"def%d\", \"explanation\": \"exp%d\", \"example\": \"ex%d\"}", i, i, i, i));
            if (i < vocabCount) sb.append(",\n");
        }
        sb.append("\n  ],\n");
        sb.append("  \"limitations\": [");
        if (withLimitations) {
            sb.append("\"Note about data and charts\"");
        }
        sb.append("]\n");
        sb.append("}");
        return sb.toString();
    }

    @Test
    @DisplayName("Parse thành công output JSON hợp lệ với 5 từ vựng, 2 sections, hintLanguage trùng khớp")
    void parsesValidOutputSuccessfully() {
        String json = createValidJson(5, 2, 2, false);

        WritingHintsResponse.Content content = parser.parse(json, "en", false);

        assertThat(content.outline()).hasSize(2);
        assertThat(content.vocabulary()).hasSize(5);
        assertThat(content.limitations()).isEmpty();
    }

    @Test
    @DisplayName("Biên từ vựng: 5 items hợp lệ, 10 items hợp lệ")
    void acceptsBoundaryVocabulary5And10() {
        WritingHintsResponse.Content content5 = parser.parse(createValidJson(5, 2, 1, false), "en", false);
        assertThat(content5.vocabulary()).hasSize(5);

        WritingHintsResponse.Content content10 = parser.parse(createValidJson(10, 2, 1, false), "en", false);
        assertThat(content10.vocabulary()).hasSize(10);
    }

    @Test
    @DisplayName("Biên từ vựng: 4 items (dưới tối thiểu) bị từ chối với WRITING_HINTS_INVALID_RESPONSE")
    void rejects4VocabularyItems() {
        String json = createValidJson(4, 2, 1, false);

        assertThatThrownBy(() -> parser.parse(json, "en", false))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_INVALID_RESPONSE);
    }

    @Test
    @DisplayName("Biên từ vựng: 11 items (vượt tối đa) bị từ chối với WRITING_HINTS_INVALID_RESPONSE")
    void rejects11VocabularyItems() {
        String json = createValidJson(11, 2, 1, false);

        assertThatThrownBy(() -> parser.parse(json, "en", false))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_INVALID_RESPONSE);
    }

    @Test
    @DisplayName("Từ chối khi vocabulary chứa các terms trùng lặp sau khi trim và case-fold")
    void rejectsDuplicateVocabularyTerms() {
        String json = """
                {
                  "hintLanguage": "en",
                  "outline": [
                    {"title": "Intro", "points": ["P1"]},
                    {"title": "Body", "points": ["P2"]}
                  ],
                  "vocabulary": [
                    {"term": "Crucial", "definition": "Important", "explanation": "Use for key points", "example": "It is crucial."},
                    {"term": " crucial ", "definition": "Important", "explanation": "Use for key points", "example": "It is crucial."},
                    {"term": "term3", "definition": "def3", "explanation": "exp3", "example": "ex3"},
                    {"term": "term4", "definition": "def4", "explanation": "exp4", "example": "ex4"},
                    {"term": "term5", "definition": "def5", "explanation": "exp5", "example": "ex5"}
                  ],
                  "limitations": []
                }
                """;

        assertThatThrownBy(() -> parser.parse(json, "en", false))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_INVALID_RESPONSE);
    }

    @Test
    @DisplayName("Biên outline: 1 section (dưới tối thiểu) hoặc 9 sections (vượt tối đa) bị từ chối")
    void rejectsInvalidOutlineSectionCount() {
        // 1 section
        assertThatThrownBy(() -> parser.parse(createValidJson(5, 1, 1, false), "en", false))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_INVALID_RESPONSE);

        // 9 sections
        assertThatThrownBy(() -> parser.parse(createValidJson(5, 9, 1, false), "en", false))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_INVALID_RESPONSE);
    }

    @Test
    @DisplayName("Biên points: 0 points hoặc 7 points mỗi section bị từ chối")
    void rejectsInvalidPointsCount() {
        // 0 points
        assertThatThrownBy(() -> parser.parse(createValidJson(5, 2, 0, false), "en", false))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_INVALID_RESPONSE);

        // 7 points
        assertThatThrownBy(() -> parser.parse(createValidJson(5, 2, 7, false), "en", false))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_INVALID_RESPONSE);
    }

    @Test
    @DisplayName("visualContext = true yêu cầu ít nhất 1 limitation; nếu rỗng ném WRITING_HINTS_INVALID_RESPONSE")
    void visualContextRequiresAtLeastOneLimitation() {
        String jsonNoLimitations = createValidJson(5, 2, 1, false);

        assertThatThrownBy(() -> parser.parse(jsonNoLimitations, "en", true))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_INVALID_RESPONSE);

        String jsonWithLimitation = createValidJson(5, 2, 1, true);
        WritingHintsResponse.Content content = parser.parse(jsonWithLimitation, "en", true);
        assertThat(content.limitations()).hasSize(1);
    }

    @Test
    @DisplayName("Từ chối khi output được bao bọc trong markdown code fence (```json ... ```)")
    void rejectsMarkdownCodeFence() {
        String json = "```json\n" + createValidJson(5, 2, 1, false) + "\n```";

        assertThatThrownBy(() -> parser.parse(json, "en", false))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_INVALID_RESPONSE);
    }

    @Test
    @DisplayName("Từ chối khi có trailing JSON content")
    void rejectsTrailingJson() {
        String json = createValidJson(5, 2, 1, false) + " {\"extra\": 1}";

        assertThatThrownBy(() -> parser.parse(json, "en", false))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_INVALID_RESPONSE);
    }

    @Test
    @DisplayName("Chấp nhận khi output đạt đúng ngưỡng biên 32 KiB (32768 bytes)")
    void acceptsOutputAtExact32KiBCap() {
        String json = createValidJson(5, 2, 1, false);
        int currentBytes = json.getBytes(StandardCharsets.UTF_8).length;
        assertThat(currentBytes).isLessThan(32768);
        String padded = json + " ".repeat(32768 - currentBytes);
        assertThat(padded.getBytes(StandardCharsets.UTF_8).length).isEqualTo(32768);

        WritingHintsResponse.Content content = parser.parse(padded, "en", false);
        assertThat(content.vocabulary()).hasSize(5);
    }

    @Test
    @DisplayName("Từ chối khi output vượt quá 32 KiB đúng 1 byte (32769 bytes)")
    void rejectsOutputAt32KiBPlusOneByte() {
        String json = createValidJson(5, 2, 1, false);
        int currentBytes = json.getBytes(StandardCharsets.UTF_8).length;
        String padded = json + " ".repeat(32769 - currentBytes);
        assertThat(padded.getBytes(StandardCharsets.UTF_8).length).isEqualTo(32769);

        assertThatThrownBy(() -> parser.parse(padded, "en", false))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> {
                    AppException appEx = (AppException) ex;
                    assertThat(appEx.getErrorCode()).isEqualTo(ErrorCode.WRITING_HINTS_INVALID_RESPONSE);
                    assertThat(appEx.getMessage()).isEqualTo("AI output exceeds 32 KiB limit");
                });
    }

    @Test
    @DisplayName("Từ chối payload multibyte vượt quá 32 KiB theo byte count dù character count < 32768")
    void rejectsMultibyteOutputExceeding32KiBByByteCountNotCharCount() {
        // Tạo chuỗi multibyte 3-byte characters (\u3042 là 'あ', 3 bytes UTF-8)
        String multiByteText = "\u3042".repeat(11000); // 11,000 ký tự nhưng là 33,000 bytes
        assertThat(multiByteText.length()).isLessThan(32768);
        assertThat(multiByteText.getBytes(StandardCharsets.UTF_8).length).isGreaterThan(32768);

        String json = """
                {
                  "hintLanguage": "en",
                  "outline": [
                    {"title": "Intro", "points": ["P1"]},
                    {"title": "Body", "points": ["P2"]}
                  ],
                  "vocabulary": [
                    {"term": "term1", "definition": "%s", "explanation": "exp1", "example": "ex1"},
                    {"term": "term2", "definition": "def2", "explanation": "exp2", "example": "ex2"},
                    {"term": "term3", "definition": "def3", "explanation": "exp3", "example": "ex3"},
                    {"term": "term4", "definition": "def4", "explanation": "exp4", "example": "ex4"},
                    {"term": "term5", "definition": "def5", "explanation": "exp5", "example": "ex5"}
                  ],
                  "limitations": []
                }
                """.formatted(multiByteText);

        assertThatThrownBy(() -> parser.parse(json, "en", false))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> {
                    AppException appEx = (AppException) ex;
                    assertThat(appEx.getErrorCode()).isEqualTo(ErrorCode.WRITING_HINTS_INVALID_RESPONSE);
                    assertThat(appEx.getMessage()).isEqualTo("AI output exceeds 32 KiB limit");
                });
    }

    @Test
    @DisplayName("Từ chối khi hintLanguage trong AI response không khớp expected hintLanguage")
    void rejectsMismatchHintLanguage() {
        String json = createValidJson(5, 2, 1, false); // hintLanguage is "en"

        assertThatThrownBy(() -> parser.parse(json, "fr", false)) // expected is "fr"
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_INVALID_RESPONSE);
    }

    @Test
    @DisplayName("Từ chối khi chứa các trường lạ ngoài schema với thông báo cố định an toàn, không echo sentinel hay log injection")
    void rejectsUnknownFieldsWithSafeConstantMessageAndZeroEcho() {
        String sentinelField = "SECRET_PROVIDER_FIELD_SENTINEL\\nFORGED_LOG_LINE";
        String json = """
                {
                  "hintLanguage": "en",
                  "outline": [
                    {"title": "Intro", "points": ["P1"]},
                    {"title": "Body", "points": ["P2"]}
                  ],
                  "vocabulary": [
                    {"term": "term1", "definition": "def1", "explanation": "exp1", "example": "ex1"},
                    {"term": "term2", "definition": "def2", "explanation": "exp2", "example": "ex2"},
                    {"term": "term3", "definition": "def3", "explanation": "exp3", "example": "ex3"},
                    {"term": "term4", "definition": "def4", "explanation": "exp4", "example": "ex4"},
                    {"term": "term5", "definition": "def5", "explanation": "exp5", "example": "ex5"}
                  ],
                  "limitations": [],
                  "%s": "malicious_payload"
                }
                """.formatted(sentinelField);

        assertThatThrownBy(() -> parser.parse(json, "en", false))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> {
                    AppException appEx = (AppException) ex;
                    assertThat(appEx.getErrorCode()).isEqualTo(ErrorCode.WRITING_HINTS_INVALID_RESPONSE);
                    assertThat(appEx.getMessage()).isEqualTo(WritingHintOutputParser.UNKNOWN_PROPERTY_MESSAGE);
                    assertThat(appEx.getCause()).isNull();
                    assertThat(appEx.getMessage()).doesNotContain("SECRET_PROVIDER_FIELD_SENTINEL", "\n");
                    assertThat(appEx.toString()).doesNotContain("SECRET_PROVIDER_FIELD_SENTINEL", "\n");

                    ResponseEntity<ApiResponse<Void>> response = exceptionHandler.handleAppException(appEx);
                    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
                    assertThat(response.getBody()).isNotNull();
                    assertThat(response.getBody().getCode()).isEqualTo(1603);
                    assertThat(response.getBody().getMessage()).isEqualTo(WritingHintOutputParser.UNKNOWN_PROPERTY_MESSAGE);
                    assertThat(response.getBody().getMessage()).doesNotContain("SECRET_PROVIDER_FIELD_SENTINEL");
                });
    }

    @Test
    @DisplayName("Từ chối duplicate vocabulary term với thông báo cố định an toàn, không echo term payload")
    void rejectsDuplicateVocabularyTermsWithSafeConstantMessageAndZeroEcho() {
        String duplicateSentinel = "SECRET_DUPLICATE_TERM_SENTINEL";
        String json = """
                {
                  "hintLanguage": "en",
                  "outline": [
                    {"title": "Intro", "points": ["P1"]},
                    {"title": "Body", "points": ["P2"]}
                  ],
                  "vocabulary": [
                    {"term": "%s", "definition": "Important", "explanation": "Use for key points", "example": "It is crucial."},
                    {"term": " %s ", "definition": "Important", "explanation": "Use for key points", "example": "It is crucial."},
                    {"term": "term3", "definition": "def3", "explanation": "exp3", "example": "ex3"},
                    {"term": "term4", "definition": "def4", "explanation": "exp4", "example": "ex4"},
                    {"term": "term5", "definition": "def5", "explanation": "exp5", "example": "ex5"}
                  ],
                  "limitations": []
                }
                """.formatted(duplicateSentinel, duplicateSentinel);

        assertThatThrownBy(() -> parser.parse(json, "en", false))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> {
                    AppException appEx = (AppException) ex;
                    assertThat(appEx.getErrorCode()).isEqualTo(ErrorCode.WRITING_HINTS_INVALID_RESPONSE);
                    assertThat(appEx.getMessage()).isEqualTo(WritingHintOutputParser.DUPLICATE_VOCABULARY_TERM_MESSAGE);
                    assertThat(appEx.getCause()).isNull();
                    assertThat(appEx.getMessage()).doesNotContain(duplicateSentinel);
                    assertThat(appEx.toString()).doesNotContain(duplicateSentinel);

                    ResponseEntity<ApiResponse<Void>> response = exceptionHandler.handleAppException(appEx);
                    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
                    assertThat(response.getBody()).isNotNull();
                    assertThat(response.getBody().getCode()).isEqualTo(1603);
                    assertThat(response.getBody().getMessage()).isEqualTo(WritingHintOutputParser.DUPLICATE_VOCABULARY_TERM_MESSAGE);
                    assertThat(response.getBody().getMessage()).doesNotContain(duplicateSentinel);
                });
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "", "   ", "not-a-json", "{broken json"
    })
    @DisplayName("Từ chối payload rỗng, blank hoặc cú pháp JSON sai với WRITING_HINTS_INVALID_RESPONSE")
    void rejectsMalformedOrBlankJson(String invalidJson) {
        assertThatThrownBy(() -> parser.parse(invalidJson, "en", false))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_INVALID_RESPONSE);
    }
}
