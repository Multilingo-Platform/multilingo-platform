package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import com.multilingo.backend.modules.testing.adapter.LearningLanguageAdapter;
import com.multilingo.backend.modules.testing.config.TestingLanguageProperties;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AttemptLanguageResolverTest {
    private final LearningLanguageAdapter userLanguages = mock(LearningLanguageAdapter.class);
    private final TestingLanguageProperties properties = new TestingLanguageProperties();
    private final AttemptLanguageResolver resolver = new AttemptLanguageResolver(
            new LearningLanguageCatalog(properties.getSupported()), userLanguages, properties);

    @Test
    void resolvesCanonicalSnapshotLanguageAndNativeExplanationLanguage() {
        when(userLanguages.findNativeLanguage(7)).thenReturn(Optional.of("zh-Hant-TW"));

        var resolved = resolver.resolve(Map.of("examLanguage", "eng"), 7);

        assertThat(resolved.examLanguage()).isEqualTo("en");
        assertThat(resolved.defaultExplanationLanguage()).isEqualTo("zh-Hant-TW");
        assertThat(resolved.supportedExplanationLanguages()).containsExactlyElementsOf(properties.getSupported());
    }

    @Test
    void fallsBackToExamLanguageWhenNativeLanguageIsUnsupported() {
        when(userLanguages.findNativeLanguage(7)).thenReturn(Optional.of("it"));

        var resolved = resolver.resolve(Map.of("exam_language", "ja-JP"), 7);

        assertThat(resolved.examLanguage()).isEqualTo("ja-JP");
        assertThat(resolved.defaultExplanationLanguage()).isEqualTo("ja-JP");
    }

    @Test
    void leavesLegacyMissingLanguageUnavailableWithoutGuessingEnglish() {
        when(userLanguages.findNativeLanguage(7)).thenReturn(Optional.of("it"));

        var resolved = resolver.resolve(Map.of("title", "English test"), 7);

        assertThat(resolved.examLanguage()).isNull();
        assertThat(resolved.defaultExplanationLanguage()).isNull();
    }

    @Test
    void conflictingSnapshotAliasesAreRejectedWithoutChoosingOne() {
        when(userLanguages.findNativeLanguage(7)).thenReturn(Optional.of("vi"));

        var resolved = resolver.resolve(Map.of("examLanguage", "en", "exam_language", "ja"), 7);

        assertThat(resolved.examLanguage()).isNull();
        assertThat(resolved.defaultExplanationLanguage()).isNull();
    }
}
