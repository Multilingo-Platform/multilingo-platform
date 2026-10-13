package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.common.exception.GlobalExceptionHandler;
import com.multilingo.backend.modules.testing.dto.request.WritingHintsRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.ResponseEntity;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WritingHintsRequestValidatorTest {

    private WritingHintsRequestValidator validator;

    @BeforeEach
    void setUp() {
        validator = new WritingHintsRequestValidator();
    }

    // --- Path ID Parsing Tests ---

    @Test
    @DisplayName("parseAttemptId nhận các số nguyên dương decimal hợp lệ trong dải int")
    void parseAttemptIdValidValues() {
        assertThat(validator.parseAttemptId("1")).isEqualTo(1);
        assertThat(validator.parseAttemptId("30")).isEqualTo(30);
        assertThat(validator.parseAttemptId("2147483647")).isEqualTo(Integer.MAX_VALUE);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "0", "01", "007", // leading zero hoặc zero
            "-1", "-30", // số âm
            "1e5", "2E3", // scientific exponent
            "1.0", "3.14", // số thập phân
            "1L", "1a", "xyz", // suffix hoặc ký tự chữ
            " 1", "1 ", " 1 ", // whitespace
            "2147483648", "9999999999", "1000000000000", // overflow integer 32-bit
            "", "   " // blank
    })
    @DisplayName("parseAttemptId từ chối các định dạng số không hợp lệ với VALIDATION_FAILED")
    void parseAttemptIdRejectsInvalidValues(String raw) {
        assertThatThrownBy(() -> validator.parseAttemptId(raw))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    @Test
    @DisplayName("parseAttemptId từ chối null với VALIDATION_FAILED")
    void parseAttemptIdRejectsNull() {
        assertThatThrownBy(() -> validator.parseAttemptId(null))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    // --- Body Parsing & Validation Tests ---

    @Test
    @DisplayName("read phân tích thành công payload hợp lệ với đầy đủ các trường")
    void readValidPayloadSuccessfully() {
        String json = """
                {
                  "partId": 30,
                  "questionId": "writing-task-1",
                  "requestId": "C5430FF2-6F41-4EB4-B287-E1E1FDAB47AA",
                  "learningLanguage": "en",
                  "hintLanguage": "fr"
                }
                """;

        WritingHintsRequest request = validator.read(toStream(json));

        assertThat(request.partId()).isEqualTo(30);
        assertThat(request.questionId()).isEqualTo("writing-task-1");
        assertThat(request.requestId()).isEqualTo("c5430ff2-6f41-4eb4-b287-e1e1fdab47aa");
        assertThat(request.learningLanguage()).isEqualTo("en");
        assertThat(request.hintLanguage()).isEqualTo("fr");
    }

    @Test
    @DisplayName("read phân tích thành công payload tối thiểu (learningLanguage và hintLanguage null/omitted)")
    void readMinimalPayloadSuccessfully() {
        String json = """
                {
                  "partId": 1,
                  "questionId": "task-essay",
                  "requestId": "11111111-2222-3333-4444-555555555555"
                }
                """;

        WritingHintsRequest request = validator.read(toStream(json));

        assertThat(request.partId()).isEqualTo(1);
        assertThat(request.questionId()).isEqualTo("task-essay");
        assertThat(request.requestId()).isEqualTo("11111111-2222-3333-4444-555555555555");
        assertThat(request.learningLanguage()).isNull();
        assertThat(request.hintLanguage()).isNull();
    }

    @Test
    @DisplayName("read chấp nhận payload có kích thước đúng bằng 16 KiB (16384 bytes)")
    void readAcceptsExact16KiBPayload() {
        // Tạo JSON có padding whitespace hoặc comment cho vừa đúng 16384 bytes
        String prefix = "{\"partId\":1,\"questionId\":\"";
        String suffix = "\",\"requestId\":\"00000000-0000-0000-0000-000000000000\"}";
        int fixedLen = prefix.length() + suffix.length();
        int paddingLen = 16384 - fixedLen;
        String paddedQId = "q" + "a".repeat(Math.min(paddingLen - 1, 100)); // questionId <= 128 ký tự
        String baseJson = prefix + paddedQId + suffix;

        // Thêm spaces ở cuối JSON cho đủ 16384 bytes
        int spacesNeeded = 16384 - baseJson.getBytes(StandardCharsets.UTF_8).length;
        String fullJson = baseJson + " ".repeat(spacesNeeded);
        byte[] bytes = fullJson.getBytes(StandardCharsets.UTF_8);
        assertThat(bytes.length).isEqualTo(16384);

        WritingHintsRequest request = validator.read(new ByteArrayInputStream(bytes));
        assertThat(request).isNotNull();
    }

    @Test
    @DisplayName("read từ chối payload vượt quá 16 KiB (16385 bytes) với WRITING_HINTS_REQUEST_TOO_LARGE")
    void readRejects16KiBPlusOneByte() {
        byte[] bytes = new byte[16385];
        java.util.Arrays.fill(bytes, (byte) ' ');

        assertThatThrownBy(() -> validator.read(new ByteArrayInputStream(bytes)))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_REQUEST_TOO_LARGE);
    }

    @Test
    @DisplayName("read từ chối body rỗng (0 bytes) với VALIDATION_FAILED")
    void readRejectsEmptyBody() {
        assertThatThrownBy(() -> validator.read(new ByteArrayInputStream(new byte[0])))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    @Test
    @DisplayName("read từ chối thuộc tính không xác định (unknown fields) với VALIDATION_FAILED, message cố định không echo tên field (P1-01)")
    void readRejectsUnknownFields() {
        String sentinelField = "SECRET_FIELD_SENTINEL\\nFORGED_LOG_LINE";
        String json = String.format("""
                {
                  "partId": 30,
                  "questionId": "task-1",
                  "requestId": "c5430ff2-6f41-4eb4-b287-e1e1fdab47aa",
                  "%s": "malicious"
                }
                """, sentinelField);

        assertThatThrownBy(() -> validator.read(toStream(json)))
                .isInstanceOf(AppException.class)
                .satisfies(e -> {
                    AppException ex = (AppException) e;
                    assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.VALIDATION_FAILED);
                    assertThat(ex.getMessage()).isEqualTo("Unknown property in request body");
                    assertThat(ex.getMessage()).doesNotContain("SECRET_FIELD_SENTINEL");
                    assertThat(ex.getMessage()).doesNotContain("FORGED_LOG_LINE");
                    assertThat(ex.toString()).doesNotContain("SECRET_FIELD_SENTINEL");
                    assertThat(ex.getCause()).isNull();

                    // Kiểm chứng khi đi qua GlobalExceptionHandler
                    GlobalExceptionHandler handler = new GlobalExceptionHandler();
                    ResponseEntity<ApiResponse<Void>> response = handler.handleAppException(ex);
                    assertThat(response.getBody()).isNotNull();
                    assertThat(response.getBody().getMessage()).isEqualTo("Unknown property in request body");
                    assertThat(response.getBody().getMessage()).doesNotContain("SECRET_FIELD_SENTINEL");
                    assertThat(response.getBody().getMessage()).doesNotContain("FORGED_LOG_LINE");
                });
    }

    @Test
    @DisplayName("read từ chối duplicate JSON key với VALIDATION_FAILED")
    void readRejectsDuplicateKeys() {
        String json = """
                {
                  "partId": 30,
                  "partId": 40,
                  "questionId": "task-1",
                  "requestId": "c5430ff2-6f41-4eb4-b287-e1e1fdab47aa"
                }
                """;

        assertThatThrownBy(() -> validator.read(toStream(json)))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    @Test
    @DisplayName("read từ chối trailing JSON content với VALIDATION_FAILED")
    void readRejectsTrailingJson() {
        String json = """
                {"partId": 30, "questionId": "task-1", "requestId": "c5430ff2-6f41-4eb4-b287-e1e1fdab47aa"} {"extra": 1}
                """;

        assertThatThrownBy(() -> validator.read(toStream(json)))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"partId\": 0, \"questionId\": \"q1\", \"requestId\": \"c5430ff2-6f41-4eb4-b287-e1e1fdab47aa\"}", // partId = 0
            "{\"partId\": -5, \"questionId\": \"q1\", \"requestId\": \"c5430ff2-6f41-4eb4-b287-e1e1fdab47aa\"}", // partId âm
            "{\"partId\": 1.5, \"questionId\": \"q1\", \"requestId\": \"c5430ff2-6f41-4eb4-b287-e1e1fdab47aa\"}", // partId số thập phân
            "{\"partId\": \"30\", \"questionId\": \"q1\", \"requestId\": \"c5430ff2-6f41-4eb4-b287-e1e1fdab47aa\"}", // partId là chuỗi
            "{\"questionId\": \"q1\", \"requestId\": \"c5430ff2-6f41-4eb4-b287-e1e1fdab47aa\"}", // thiếu partId
            "{\"partId\": 30, \"questionId\": \"\", \"requestId\": \"c5430ff2-6f41-4eb4-b287-e1e1fdab47aa\"}", // questionId rỗng
            "{\"partId\": 30, \"questionId\": \"  \", \"requestId\": \"c5430ff2-6f41-4eb4-b287-e1e1fdab47aa\"}", // questionId blank
            "{\"partId\": 30, \"questionId\": \" task1\", \"requestId\": \"c5430ff2-6f41-4eb4-b287-e1e1fdab47aa\"}", // questionId khoảng trắng đầu
            "{\"partId\": 30, \"questionId\": \"task1 \", \"requestId\": \"c5430ff2-6f41-4eb4-b287-e1e1fdab47aa\"}", // questionId khoảng trắng cuối
            "{\"partId\": 30, \"requestId\": \"c5430ff2-6f41-4eb4-b287-e1e1fdab47aa\"}", // thiếu questionId
            "{\"partId\": 30, \"questionId\": \"q1\", \"requestId\": \"not-a-uuid\"}", // requestId không phải UUID
            "{\"partId\": 30, \"questionId\": \"q1\"}" // thiếu requestId
    })
    @DisplayName("read từ chối các vi phạm ngữ nghĩa và kiểu dữ liệu với VALIDATION_FAILED")
    void readRejectsSemanticAndTypeViolations(String json) {
        assertThatThrownBy(() -> validator.read(toStream(json)))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    @Test
    @DisplayName("read từ chối questionId vượt quá 128 ký tự với VALIDATION_FAILED")
    void readRejectsQuestionIdOver128Chars() {
        String longQId = "q".repeat(129);
        String json = String.format("{\"partId\": 30, \"questionId\": \"%s\", \"requestId\": \"c5430ff2-6f41-4eb4-b287-e1e1fdab47aa\"}", longQId);

        assertThatThrownBy(() -> validator.read(toStream(json)))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "\u2003task1", // em space đầu
            "task1\u2003", // em space cuối
            "\u3000task1", // ideographic space đầu
            "task1\u3000", // ideographic space cuối
            "\u00A0task1", // no-break space đầu
            "task1\u00A0", // no-break space cuối
            "\u2002task1", // en space đầu
            "task1\u2009"  // thin space cuối
    })
    @DisplayName("read từ chối questionId chứa Unicode whitespace ở đầu hoặc cuối với VALIDATION_FAILED (P1-02)")
    void readRejectsQuestionIdWithUnicodeWhitespaceAtBoundaries(String unicodeQId) {
        String json = String.format("{\"partId\": 30, \"questionId\": \"%s\", \"requestId\": \"c5430ff2-6f41-4eb4-b287-e1e1fdab47aa\"}", unicodeQId);

        assertThatThrownBy(() -> validator.read(toStream(json)))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "task-1",
            "writing_task_2",
            "q",
            "Q123",
            "question.1",
            "task:essay"
    })
    @DisplayName("read chấp nhận các questionId hợp lệ không có whitespace ở đầu/cuối")
    void readAcceptsValidQuestionIds(String validQId) {
        String json = String.format("{\"partId\": 30, \"questionId\": \"%s\", \"requestId\": \"c5430ff2-6f41-4eb4-b287-e1e1fdab47aa\"}", validQId);

        WritingHintsRequest request = validator.read(toStream(json));
        assertThat(request.questionId()).isEqualTo(validQId);
    }

    private InputStream toStream(String content) {
        return new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8));
    }
}
