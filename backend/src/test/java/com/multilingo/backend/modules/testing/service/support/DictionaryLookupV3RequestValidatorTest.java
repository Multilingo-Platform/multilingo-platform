package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupV3Request;
import com.multilingo.backend.modules.testing.dto.request.WorkspaceTextSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DictionaryLookupV3RequestValidatorTest {

    private DictionaryLookupV3RequestValidator validator;

    @BeforeEach
    void setUp() {
        validator = new DictionaryLookupV3RequestValidator(new LearningLanguageCatalog());
    }

    @Test
    @DisplayName("Reads and normalizes valid V3 JSON payload")
    void readsValidPayload() {
        String uuid = UUID.randomUUID().toString().toUpperCase();
        String json = """
                {
                  "requestId": "%s",
                  "partId": 7,
                  "source": {
                    "kind": "OPTION_TEXT",
                    "questionId": "q1",
                    "optionId": "A"
                  },
                  "selectedText": "sample phrase",
                  "contextText": "sentence containing the sample phrase"
                }
                """.formatted(uuid);

        DictionaryLookupV3Request request = validator.read(new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8)));

        assertThat(request.requestId()).isEqualTo(uuid.toLowerCase());
        assertThat(request.partId()).isEqualTo(7);
        assertThat(request.source().kind()).isEqualTo(WorkspaceTextSource.Kind.OPTION_TEXT);
        assertThat(request.source().questionId()).isEqualTo("q1");
        assertThat(request.source().optionId()).isEqualTo("A");
        assertThat(request.selectedText()).isEqualTo("sample phrase");
        assertThat(request.contextText()).isEqualTo("sentence containing the sample phrase");
    }

    @Test
    @DisplayName("Rejects request body exceeding 16 KiB with DICTIONARY_LOOKUP_REQUEST_TOO_LARGE")
    void rejectsBodyExceeding16KiB() {
        byte[] largeBody = new byte[16 * 1024 + 1];
        java.util.Arrays.fill(largeBody, (byte) ' ');

        assertThatThrownBy(() -> validator.read(new ByteArrayInputStream(largeBody)))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.DICTIONARY_LOOKUP_REQUEST_TOO_LARGE);
    }

    @Test
    @DisplayName("Rejects unknown root fields such as meaningLanguage or userId")
    void rejectsUnknownRootFields() {
        String jsonWithMeaningLanguage = """
                {
                  "requestId": "%s",
                  "partId": 7,
                  "source": { "kind": "PART_TITLE" },
                  "selectedText": "title",
                  "contextText": "context title",
                  "meaningLanguage": "vi"
                }
                """.formatted(UUID.randomUUID());

        assertThatThrownBy(() -> validator.read(new ByteArrayInputStream(jsonWithMeaningLanguage.getBytes(StandardCharsets.UTF_8))))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.VALIDATION_FAILED);

        String jsonWithUserId = """
                {
                  "requestId": "%s",
                  "partId": 7,
                  "source": { "kind": "PART_TITLE" },
                  "selectedText": "title",
                  "contextText": "context title",
                  "userId": 999
                }
                """.formatted(UUID.randomUUID());

        assertThatThrownBy(() -> validator.read(new ByteArrayInputStream(jsonWithUserId.getBytes(StandardCharsets.UTF_8))))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.VALIDATION_FAILED);
    }

    @Test
    @DisplayName("Rejects malformed UUID in requestId")
    void rejectsInvalidUuid() {
        String json = """
                {
                  "requestId": "invalid-uuid-format",
                  "partId": 7,
                  "source": { "kind": "PART_TITLE" },
                  "selectedText": "sample",
                  "contextText": "sample context"
                }
                """;

        assertThatThrownBy(() -> validator.read(new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8))))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.VALIDATION_FAILED);
    }

    @Test
    @DisplayName("Rejects invalid partId (negative, zero, or non-integral)")
    void rejectsInvalidPartId() {
        String jsonZero = """
                {
                  "requestId": "%s",
                  "partId": 0,
                  "source": { "kind": "PART_TITLE" },
                  "selectedText": "sample",
                  "contextText": "sample context"
                }
                """.formatted(UUID.randomUUID());

        assertThatThrownBy(() -> validator.read(new ByteArrayInputStream(jsonZero.getBytes(StandardCharsets.UTF_8))))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.VALIDATION_FAILED);
    }

    @Test
    @DisplayName("Rejects unknown fields or invalid structure inside source")
    void rejectsInvalidSourceFields() {
        String jsonWithPrivateAnswer = """
                {
                  "requestId": "%s",
                  "partId": 7,
                  "source": {
                    "kind": "OPTION_TEXT",
                    "questionId": "q1",
                    "optionId": "A",
                    "answer": "secret_answer"
                  },
                  "selectedText": "sample",
                  "contextText": "sample context"
                }
                """.formatted(UUID.randomUUID());

        assertThatThrownBy(() -> validator.read(new ByteArrayInputStream(jsonWithPrivateAnswer.getBytes(StandardCharsets.UTF_8))))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.VALIDATION_FAILED);
    }

    @Test
    @DisplayName("Rejects selectedText exceeding 80 code points")
    void rejectsSelectedTextOver80CodePoints() {
        String longText = "a".repeat(81);
        var request = new DictionaryLookupV3Request(
                UUID.randomUUID().toString(), 1, new WorkspaceTextSource(WorkspaceTextSource.Kind.PART_TITLE, null, null, null),
                longText, "context"
        );

        assertThatThrownBy(() -> validator.validate(request, "en"))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.VALIDATION_FAILED);
    }

    @Test
    @DisplayName("Rejects selectedText exceeding 5 words for English")
    void rejectsSelectedTextOver5WordsForEnglish() {
        var request = new DictionaryLookupV3Request(
                UUID.randomUUID().toString(), 1, new WorkspaceTextSource(WorkspaceTextSource.Kind.PART_TITLE, null, null, null),
                "one two three four five six", "context one two three four five six"
        );

        assertThatThrownBy(() -> validator.validate(request, "en"))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.VALIDATION_FAILED);
    }

    @Test
    @DisplayName("Accepts selectedText with more than 5 characters without spaces for Chinese and Japanese")
    void acceptsSelectedTextForCJK() {
        var requestJa = new DictionaryLookupV3Request(
                UUID.randomUUID().toString(), 1, new WorkspaceTextSource(WorkspaceTextSource.Kind.PART_TITLE, null, null, null),
                "日本語読解練習", "日本語読解練習です"
        );

        DictionaryLookupV3Request validatedJa = validator.validate(requestJa, "ja-JP");
        assertThat(validatedJa.selectedText()).isEqualTo("日本語読解練習");
    }

    @Test
    @DisplayName("Rejects control characters in selectedText or contextText")
    void rejectsControlCharacters() {
        var requestCtrl = new DictionaryLookupV3Request(
                UUID.randomUUID().toString(), 1, new WorkspaceTextSource(WorkspaceTextSource.Kind.PART_TITLE, null, null, null),
                "hello\u0000world", "hello context"
        );

        assertThatThrownBy(() -> validator.validate(requestCtrl, "en"))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.VALIDATION_FAILED);
    }

    @Test
    @DisplayName("parseAttemptId validates positive integers")
    void parseAttemptIdValidatesPositiveIntegers() {
        assertThat(validator.parseAttemptId("42")).isEqualTo(42);
        assertThatThrownBy(() -> validator.parseAttemptId("0"))
                .isInstanceOf(AppException.class);
        assertThatThrownBy(() -> validator.parseAttemptId("-5"))
                .isInstanceOf(AppException.class);
        assertThatThrownBy(() -> validator.parseAttemptId("abc"))
                .isInstanceOf(AppException.class);
    }
}
