package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupV2Request;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DictionaryLookupV2RequestValidatorTest {
    private final DictionaryLookupV2RequestValidator validator =
            new DictionaryLookupV2RequestValidator(new ObjectMapper(), new LearningLanguageCatalog());

    @Test
    void acceptsSingleCjkCharacterAndCanonicalizesOptionalMeaningLanguage() {
        String json = """
                {"requestId":"7b2d4a6a-d1a0-4b22-83c1-18f860288231","partId":1,"documentId":"g1",
                 "selectedText":"水","contextText":"水は必要です。","meaningLanguage":"fra"}
                """;
        assertThat(validator.read(new ByteArrayInputStream(json.getBytes())).meaningLanguage()).isEqualTo("fr");
    }

    @Test
    void enforcesLanguageAwareSelectionLimitsAndStrictBodyShape() {
        DictionaryLookupV2Request sixEnglishWords = new DictionaryLookupV2Request(
                "7b2d4a6a-d1a0-4b22-83c1-18f860288231", 1, "g1", "one two three four five six", "context", "vi");
        assertThatThrownBy(() -> validator.validate(sixEnglishWords, "en")).isInstanceOf(AppException.class);
        DictionaryLookupV2Request cjkPhrase = new DictionaryLookupV2Request(
                "7b2d4a6a-d1a0-4b22-83c1-18f860288231", 1, "g1", "これは一つの語です", "文脈", null);
        assertThat(validator.validate(cjkPhrase, "ja")).isEqualTo(cjkPhrase);
        String extra = """
                {"requestId":"7b2d4a6a-d1a0-4b22-83c1-18f860288231","partId":1,"documentId":"g1",
                 "selectedText":"water","contextText":"water is useful","learningLanguage":"en"}
                """;
        assertThatThrownBy(() -> validator.read(new ByteArrayInputStream(extra.getBytes()))).isInstanceOf(AppException.class);
    }
}
