package com.multilingo.backend.modules.testing.ai.grading;

import com.multilingo.backend.common.i18n.LearningLanguageCatalog;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/** Resolves new jobs from snapshot fields only; callers must not pass profile/live-exam values. */
public final class WritingRubricRegistry {
    public static final String ENGLISH_RUBRIC = "WRITING_EN_V1";
    public static final String GENERIC_RUBRIC = "WRITING_GENERIC_V1";
    public static final String ENGLISH_SCORE_UNIT = "BAND_0_9";
    public static final String GENERIC_SCORE_UNIT = "PRACTICE_0_10";
    private static final List<String> CRITERIA = List.of("TR", "CC", "LR", "GRA");

    private final LearningLanguageCatalog languages;

    public WritingRubricRegistry(LearningLanguageCatalog languages) {
        this.languages = Objects.requireNonNull(languages, "languages must not be null");
    }

    public WritingRubricPolicy resolve(String examType, String snapshotLanguage) {
        String sourceLanguage = languages.findNormalized(snapshotLanguage)
                .orElseThrow(() -> new IllegalArgumentException("Writing source language is unavailable"));
        boolean generic = !"en".equalsIgnoreCase(sourceLanguage.split("-", 2)[0])
                || "LANGUAGE_PRACTICE".equals(normalizeExamType(examType));
        return generic
                ? new WritingRubricPolicy("TV3_WRITING_POLICY_V1", GENERIC_RUBRIC, GENERIC_SCORE_UNIT,
                    new BigDecimal("10.0"), new BigDecimal("0.5"), sourceLanguage, CRITERIA,
                    "writing-grading-generic-v1")
                : new WritingRubricPolicy("TV3_WRITING_POLICY_V1", ENGLISH_RUBRIC, ENGLISH_SCORE_UNIT,
                    new BigDecimal("9.0"), new BigDecimal("0.5"), sourceLanguage, CRITERIA,
                    "writing-grading-en-multilingual-feedback-v1");
    }

    private String normalizeExamType(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }
}
