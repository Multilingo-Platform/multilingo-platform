package com.multilingo.backend.modules.testing.grading;

import java.text.Normalizer;
import java.util.Locale;

/** Normalizes a comparison copy of a learner answer; persisted source text is never mutated. */
public final class AnswerTextNormalizer {
    private AnswerTextNormalizer() { }

    public static String normalize(String value, boolean nfc) {
        if (value == null) return null;
        String comparison = nfc ? Normalizer.normalize(value, Normalizer.Form.NFC) : value;
        String normalized = comparison.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        return normalized.isEmpty() ? null : normalized;
    }
}
