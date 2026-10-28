package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import com.multilingo.backend.modules.testing.adapter.LearningLanguageAdapter;
import com.multilingo.backend.modules.testing.dto.response.DictionaryLanguageContextResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class DictionaryNativeLanguageResolverTest {

    private final LearningLanguageAdapter userLanguages = mock(LearningLanguageAdapter.class);
    private final LearningLanguageCatalog catalog = new LearningLanguageCatalog();
    private DictionaryNativeLanguageResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new DictionaryNativeLanguageResolver(catalog, userLanguages);
    }

    @Test
    @DisplayName("Resolves canonical base native language for owner")
    void resolvesCanonicalBaseNativeLanguage() {
        when(userLanguages.findNativeLanguage(7)).thenReturn(Optional.of("vi"));

        DictionaryLanguageContextResponse response = resolver.resolve(7, 7);

        assertThat(response.available()).isTrue();
        assertThat(response.nativeLanguage()).isEqualTo("vi");
        assertThat(response.policyVersion()).isEqualTo(DictionaryLanguageContextResponse.CURRENT_POLICY_VERSION);
        assertThat(response.reason()).isNull();
    }

    @Test
    @DisplayName("Resolves native language with region tag preserved")
    void resolvesNativeLanguageWithRegion() {
        when(userLanguages.findNativeLanguage(7)).thenReturn(Optional.of("vi-VN"));

        DictionaryLanguageContextResponse response = resolver.resolve(7, 7);

        assertThat(response.available()).isTrue();
        assertThat(response.nativeLanguage()).isEqualTo("vi-VN");
        assertThat(response.reason()).isNull();
    }

    @Test
    @DisplayName("Resolves native language with script and region tag preserved")
    void resolvesNativeLanguageWithScriptAndRegion() {
        when(userLanguages.findNativeLanguage(7)).thenReturn(Optional.of("zh-Hant-TW"));

        DictionaryLanguageContextResponse response = resolver.resolve(7, 7);

        assertThat(response.available()).isTrue();
        assertThat(response.nativeLanguage()).isEqualTo("zh-Hant-TW");
        assertThat(response.reason()).isNull();
    }

    @Test
    @DisplayName("Resolves supported ISO 639-3 aliases to canonical base code")
    void resolvesSupportedIso3Alias() {
        when(userLanguages.findNativeLanguage(7)).thenReturn(Optional.of("vie"));
        when(userLanguages.findNativeLanguage(8)).thenReturn(Optional.of("eng"));

        DictionaryLanguageContextResponse resVi = resolver.resolve(7, 7);
        DictionaryLanguageContextResponse resEn = resolver.resolve(8, 8);

        assertThat(resVi.available()).isTrue();
        assertThat(resVi.nativeLanguage()).isEqualTo("vi");

        assertThat(resEn.available()).isTrue();
        assertThat(resEn.nativeLanguage()).isEqualTo("en");
    }

    @Test
    @DisplayName("Missing native language reports unavailable without silent fallback")
    void missingNativeLanguageReportsUnavailableWithoutFallback() {
        when(userLanguages.findNativeLanguage(7)).thenReturn(Optional.empty());

        DictionaryLanguageContextResponse response = resolver.resolve(7, 7);

        assertThat(response.available()).isFalse();
        assertThat(response.nativeLanguage()).isNull();
        assertThat(response.reason()).isEqualTo(DictionaryLanguageContextResponse.REASON_REQUIRED);
    }

    @Test
    @DisplayName("Blank native language reports unavailable without fallback")
    void blankNativeLanguageReportsUnavailable() {
        when(userLanguages.findNativeLanguage(7)).thenReturn(Optional.of("   "));

        DictionaryLanguageContextResponse response = resolver.resolve(7, 7);

        assertThat(response.available()).isFalse();
        assertThat(response.nativeLanguage()).isNull();
        assertThat(response.reason()).isEqualTo(DictionaryLanguageContextResponse.REASON_REQUIRED);
    }

    @Test
    @DisplayName("Unsupported native language reports unavailable without fallback to exam language or English")
    void unsupportedNativeLanguageReportsUnavailableWithoutFallback() {
        when(userLanguages.findNativeLanguage(7)).thenReturn(Optional.of("it"));

        DictionaryLanguageContextResponse response = resolver.resolve(7, 7);

        assertThat(response.available()).isFalse();
        assertThat(response.nativeLanguage()).isNull();
        assertThat(response.reason()).isEqualTo(DictionaryLanguageContextResponse.REASON_UNSUPPORTED);
    }

    @Test
    @DisplayName("Malformed language tag reports unavailable")
    void malformedLanguageTagReportsUnavailable() {
        when(userLanguages.findNativeLanguage(7)).thenReturn(Optional.of("invalid_tag*with_underscore"));

        DictionaryLanguageContextResponse response = resolver.resolve(7, 7);

        assertThat(response.available()).isFalse();
        assertThat(response.nativeLanguage()).isNull();
        assertThat(response.reason()).isEqualTo(DictionaryLanguageContextResponse.REASON_UNSUPPORTED);
    }

    @Test
    @DisplayName("Non-owner access does not leak owner native language")
    void nonOwnerAccessDoesNotLeakOwnerNativeLanguage() {
        when(userLanguages.findNativeLanguage(7)).thenReturn(Optional.of("vi"));

        DictionaryLanguageContextResponse response = resolver.resolve(7, 8);

        assertThat(response.available()).isFalse();
        assertThat(response.nativeLanguage()).isNull();
        assertThat(response.reason()).isEqualTo(DictionaryLanguageContextResponse.REASON_NOT_OWNER);
    }

    @Test
    @DisplayName("Null current user reports not owner")
    void nullCurrentUserReportsNotOwner() {
        DictionaryLanguageContextResponse response = resolver.resolve(7, null);

        assertThat(response.available()).isFalse();
        assertThat(response.nativeLanguage()).isNull();
        assertThat(response.reason()).isEqualTo(DictionaryLanguageContextResponse.REASON_NOT_OWNER);
        verifyNoInteractions(userLanguages);
    }

    @Test
    @DisplayName("Null attempt owner reports required")
    void nullAttemptOwnerReportsRequired() {
        DictionaryLanguageContextResponse response = resolver.resolve(null, 7);

        assertThat(response.available()).isFalse();
        assertThat(response.nativeLanguage()).isNull();
        assertThat(response.reason()).isEqualTo(DictionaryLanguageContextResponse.REASON_REQUIRED);
        verifyNoInteractions(userLanguages);
    }

    @Test
    @DisplayName("Single userId overload resolves for self")
    void singleUserIdOverloadResolvesForSelf() {
        when(userLanguages.findNativeLanguage(7)).thenReturn(Optional.of("ja"));

        DictionaryLanguageContextResponse response = resolver.resolve(7);

        assertThat(response.available()).isTrue();
        assertThat(response.nativeLanguage()).isEqualTo("ja");
    }

    @Test
    @DisplayName("requireNativeLanguage returns normalized code when valid and owner matches")
    void requireNativeLanguage_validOwnerAndLanguage_returnsNormalized() {
        when(userLanguages.findNativeLanguage(7)).thenReturn(Optional.of("vie"));

        String language = resolver.requireNativeLanguage(7, 7);

        assertThat(language).isEqualTo("vi");
    }

    @Test
    @DisplayName("requireNativeLanguage throws FORBIDDEN when user does not own attempt")
    void requireNativeLanguage_nonOwner_throwsForbidden() {
        assertThatThrownBy(() -> resolver.requireNativeLanguage(7, 8))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.FORBIDDEN);
    }

    @Test
    @DisplayName("requireNativeLanguage throws DICTIONARY_NATIVE_LANGUAGE_REQUIRED when missing")
    void requireNativeLanguage_missingNativeLanguage_throwsNativeLanguageRequired() {
        when(userLanguages.findNativeLanguage(7)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> resolver.requireNativeLanguage(7, 7))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.DICTIONARY_NATIVE_LANGUAGE_REQUIRED);
    }

    @Test
    @DisplayName("requireNativeLanguage throws DICTIONARY_NATIVE_LANGUAGE_REQUIRED when unsupported")
    void requireNativeLanguage_unsupportedNativeLanguage_throwsNativeLanguageRequired() {
        when(userLanguages.findNativeLanguage(7)).thenReturn(Optional.of("it"));

        assertThatThrownBy(() -> resolver.requireNativeLanguage(7, 7))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.DICTIONARY_NATIVE_LANGUAGE_REQUIRED);
    }
}
