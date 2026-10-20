package com.multilingo.backend.modules.testing.ai.dictionary;

import com.multilingo.backend.common.exception.AppException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DictionaryLookupOutputParserTest {
    private final DictionaryLookupOutputParser parser = new DictionaryLookupOutputParser();

    @Test
    void parsesDefinitionAndAllowsOptionalNullFields() {
        var result = parser.parse("""
                {"meaningVi":"cây du","phonetic":null,"partOfSpeech":"noun",
                 "exampleEn":"Elms grow here.","exampleVi":"Cây du mọc ở đây."}
                """);
        assertThat(result.meaningVi()).isEqualTo("cây du");
        assertThat(result.phonetic()).isNull();
        assertThat(result.partOfSpeech()).isEqualTo("noun");
    }

    @Test
    void rejectsMalformedMissingMeaningUnknownFieldsAndCodeFences() {
        for (String invalid : new String[]{"{", "{}", "{\"meaningVi\":\"\",\"exampleEn\":\"x\",\"exampleVi\":\"y\"}",
                "{\"meaningVi\":\"x\",\"exampleEn\":\"y\",\"exampleVi\":\"z\",\"answerKey\":\"leak\"}",
                "```json\\n{}\\n```"}) {
            assertThatThrownBy(() -> parser.parse(invalid)).isInstanceOf(AppException.class);
        }
    }

    @Test
    void rejectsOverLimitAndDuplicateProperties() {
        String oversized = "{\"meaningVi\":\"" + "x".repeat(1001)
                + "\",\"exampleEn\":\"x\",\"exampleVi\":\"y\"}";
        assertThatThrownBy(() -> parser.parse(oversized)).isInstanceOf(AppException.class);
        assertThatThrownBy(() -> parser.parse("{\"meaningVi\":\"x\",\"meaningVi\":\"y\",\"exampleEn\":\"x\",\"exampleVi\":\"y\"}"))
                .isInstanceOf(AppException.class);
    }
}
