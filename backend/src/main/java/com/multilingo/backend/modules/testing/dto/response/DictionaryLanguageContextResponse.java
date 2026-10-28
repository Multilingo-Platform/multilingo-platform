package com.multilingo.backend.modules.testing.dto.response;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record DictionaryLanguageContextResponse(
        @JsonProperty("policyVersion")
        @JsonAlias({"policy_version"})
        String policyVersion,

        @JsonProperty("nativeLanguage")
        @JsonAlias({"native_language"})
        String nativeLanguage,

        @JsonProperty("available")
        boolean available,

        @JsonProperty("reason")
        String reason
) {
    public static final String CURRENT_POLICY_VERSION = "NATIVE_PROFILE_V1";

    public static final String REASON_REQUIRED = "NATIVE_LANGUAGE_REQUIRED";
    public static final String REASON_UNSUPPORTED = "NATIVE_LANGUAGE_UNSUPPORTED";
    public static final String REASON_NOT_OWNER = "NOT_OWNER";

    public static DictionaryLanguageContextResponse available(String nativeLanguage) {
        return new DictionaryLanguageContextResponse(CURRENT_POLICY_VERSION, nativeLanguage, true, null);
    }

    public static DictionaryLanguageContextResponse unavailable(String reason) {
        return new DictionaryLanguageContextResponse(CURRENT_POLICY_VERSION, null, false, reason);
    }
}
