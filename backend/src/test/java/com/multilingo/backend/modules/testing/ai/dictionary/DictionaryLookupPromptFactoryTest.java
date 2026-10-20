package com.multilingo.backend.modules.testing.ai.dictionary;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DictionaryLookupPromptFactoryTest {
    @Test
    void sendsOnlySelectedTermAndVerifiedContextAsJsonUserData() {
        var request = new DictionaryLookupPromptFactory().build("elms", "The elms grow in Britain.");
        assertThat(request.userText()).contains("elms", "The elms grow in Britain.");
        assertThat(request.userText()).doesNotContain("answer", "grading", "explanation");
        assertThat(request.systemInstruction()).containsIgnoringCase("untrusted").containsIgnoringCase("instructions");
        assertThat(request.outputFormat()).isEqualTo(com.multilingo.backend.modules.testing.ai.gemini.GeminiGenerationRequest.OutputFormat.JSON);
        assertThat(request.maxOutputTokens()).isEqualTo(2048);
    }
}
