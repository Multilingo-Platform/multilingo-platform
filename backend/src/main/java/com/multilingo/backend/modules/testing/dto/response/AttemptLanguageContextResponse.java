package com.multilingo.backend.modules.testing.dto.response;

import java.util.List;

public record AttemptLanguageContextResponse(
        String policyVersion,
        String examLanguage,
        String defaultExplanationLanguage,
        List<String> supportedExplanationLanguages) {
    public static final String CURRENT_POLICY_VERSION = "TV3_LANG_V1";

    public AttemptLanguageContextResponse {
        supportedExplanationLanguages = supportedExplanationLanguages == null
                ? List.of()
                : List.copyOf(supportedExplanationLanguages);
    }
}
