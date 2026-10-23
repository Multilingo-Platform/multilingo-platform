package com.multilingo.backend.modules.testing.util;

import java.util.Locale;

/** Counts writing length without changing the submitted text. */
public final class WritingLengthCounter {
    public enum Unit { WORDS, CHARACTERS }

    public record WritingLengthMetric(int value, Unit unit, String policyVersion) { }

    public WritingLengthMetric count(String text, String languageTag) {
        String source = text == null ? "" : text;
        String baseLanguage = languageTag == null || languageTag.isBlank()
                ? "" : languageTag.trim().replace('_', '-').split("-", 2)[0].toLowerCase(Locale.ROOT);
        if ("zh".equals(baseLanguage) || "ja".equals(baseLanguage)) {
            int count = (int) source.codePoints().filter(WritingLengthCounter::isLetterOrNumber).count();
            return new WritingLengthMetric(count, Unit.CHARACTERS, "TV3_LENGTH_V1");
        }

        int count = 0;
        boolean inToken = false;
        for (int offset = 0; offset < source.length();) {
            int codePoint = source.codePointAt(offset);
            boolean whitespace = Character.isWhitespace(codePoint) || Character.isSpaceChar(codePoint);
            if (!whitespace && !inToken) count++;
            inToken = !whitespace;
            offset += Character.charCount(codePoint);
        }
        return new WritingLengthMetric(count, Unit.WORDS, "TV3_LENGTH_V1");
    }

    private static boolean isLetterOrNumber(int codePoint) {
        if (Character.isLetter(codePoint)) return true;
        int type = Character.getType(codePoint);
        return type == Character.DECIMAL_DIGIT_NUMBER
                || type == Character.LETTER_NUMBER
                || type == Character.OTHER_NUMBER;
    }
}
