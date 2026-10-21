package com.multilingo.backend.modules.testing.ai.dictionary;

import com.multilingo.backend.common.exception.AppException;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DictionaryLookupV2OutputParserTest {
    private final DictionaryLookupV2OutputParser parser = new DictionaryLookupV2OutputParser();

    @Test void acceptsNeutralSchemaAndNullablePhonetic() {
        var result = parser.parse("{\"meaning\":\"水\",\"phonetic\":null,\"partOfSpeech\":\"名詞\",\"example\":\"水を飲む\",\"exampleTranslation\":\"Drink water\"}");
        assertThat(result.meaning()).isEqualTo("水");
        assertThat(result.phonetic()).isNull();
    }

    @Test void rejectsLegacyLanguageNamedFieldsAndUnknownProperties() {
        assertThatThrownBy(() -> parser.parse("{\"meaningVi\":\"x\"}")).isInstanceOf(AppException.class);
        assertThatThrownBy(() -> parser.parse("{\"meaning\":\"x\",\"example\":\"a\",\"exampleTranslation\":\"b\",\"extra\":\"x\"}")).isInstanceOf(AppException.class);
    }

    @Test void rejectsTrailingTokensAfterJsonObject() {
        assertThatThrownBy(() -> parser.parse("{\"meaning\":\"水\",\"example\":\"水を飲む\",\"exampleTranslation\":\"Drink water\"} trailing_text"))
                .isInstanceOf(AppException.class);
    }
}
