package com.multilingo.backend.modules.testing.ai.grading;

import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WritingRubricRegistryTest {
    private final WritingRubricRegistry registry = new WritingRubricRegistry(new LearningLanguageCatalog());

    @Test
    void selectsGenericPracticeScaleForNonEnglishAndLanguagePractice() {
        assertThat(registry.resolve("IELTS_ACADEMIC", "en").rubricCode()).isEqualTo("WRITING_EN_V1");
        assertThat(registry.resolve("IELTS_ACADEMIC", "en-US").rubricCode()).isEqualTo("WRITING_EN_V1");
        assertThat(registry.resolve("LANGUAGE_PRACTICE", "en").maxScore()).isEqualByComparingTo("10.0");
        assertThat(registry.resolve("NLTV", "vi").scoreUnit()).isEqualTo("PRACTICE_0_10");
        assertThat(registry.resolve("IELTS_ACADEMIC", "ja").rubricCode()).isEqualTo("WRITING_GENERIC_V1");
    }

    @Test
    void preservesTheEnglishLanguagePracticeExceptionAndCanonicalSourceTags() {
        WritingRubricPolicy policy = registry.resolve("LANGUAGE_PRACTICE", "zh-hant-tw");
        assertThat(policy.rubricCode()).isEqualTo("WRITING_GENERIC_V1");
        assertThat(policy.sourceLanguage()).isEqualTo("zh-Hant-TW");
        assertThat(policy.criterionCodes()).containsExactly("TR", "CC", "LR", "GRA");
    }
}
