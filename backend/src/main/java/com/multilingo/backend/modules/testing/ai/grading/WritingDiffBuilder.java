package com.multilingo.backend.modules.testing.ai.grading;

import java.util.ArrayList;
import java.util.List;

/**
 * Server-side diff generator and reconstructor for original and corrected essays.
 * Invariants:
 * <pre>
 *   joinWithoutInsert(diff).equals(originalEssay)
 *   joinWithoutDelete(diff).equals(correctedEssay)
 * </pre>
 */
public final class WritingDiffBuilder {

    private WritingDiffBuilder() {
    }

    /**
     * Builds a list of {@link WritingGrade.DiffSegment} by comparing original text with validated non-overlapping corrections.
     */
    public static List<WritingGrade.DiffSegment> build(String originalEssay, List<WritingGrade.Correction> corrections) {
        String essay = (originalEssay == null) ? "" : originalEssay;
        List<WritingGrade.Correction> list = (corrections == null) ? List.of() : corrections;

        if (essay.isEmpty() && list.isEmpty()) {
            return List.of();
        }

        validateCorrections(essay, list);

        List<WritingGrade.DiffSegment> segments = new ArrayList<>();
        int cursor = 0;

        for (WritingGrade.Correction c : list) {
            if (c.start() > cursor) {
                segments.add(new WritingGrade.DiffSegment(
                        WritingGrade.DiffType.EQUAL,
                        essay.substring(cursor, c.start())
                ));
            }

            if (c.end() > c.start()) {
                segments.add(new WritingGrade.DiffSegment(
                        WritingGrade.DiffType.DELETE,
                        essay.substring(c.start(), c.end())
                ));
            }

            if (c.replacement() != null && !c.replacement().isEmpty()) {
                segments.add(new WritingGrade.DiffSegment(
                        WritingGrade.DiffType.INSERT,
                        c.replacement()
                ));
            }

            cursor = c.end();
        }

        if (cursor < essay.length()) {
            segments.add(new WritingGrade.DiffSegment(
                    WritingGrade.DiffType.EQUAL,
                    essay.substring(cursor)
            ));
        }

        return List.copyOf(segments);
    }

    /**
     * Reconstructs the corrected essay by applying corrections in sequence to the original essay.
     */
    public static String applyCorrections(String originalEssay, List<WritingGrade.Correction> corrections) {
        String essay = (originalEssay == null) ? "" : originalEssay;
        List<WritingGrade.Correction> list = (corrections == null) ? List.of() : corrections;

        if (list.isEmpty()) {
            return essay;
        }

        validateCorrections(essay, list);

        StringBuilder sb = new StringBuilder();
        int cursor = 0;

        for (WritingGrade.Correction c : list) {
            sb.append(essay, cursor, c.start());
            if (c.replacement() != null) {
                sb.append(c.replacement());
            }
            cursor = c.end();
        }

        if (cursor < essay.length()) {
            sb.append(essay, cursor, essay.length());
        }

        return sb.toString();
    }

    /**
     * Reconstructs the original text from diff segments (skipping INSERT segments).
     */
    public static String joinWithoutInsert(List<WritingGrade.DiffSegment> diff) {
        if (diff == null || diff.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (WritingGrade.DiffSegment segment : diff) {
            if (segment.type() != WritingGrade.DiffType.INSERT) {
                sb.append(segment.text());
            }
        }
        return sb.toString();
    }

    /**
     * Reconstructs the corrected text from diff segments (skipping DELETE segments).
     */
    public static String joinWithoutDelete(List<WritingGrade.DiffSegment> diff) {
        if (diff == null || diff.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (WritingGrade.DiffSegment segment : diff) {
            if (segment.type() != WritingGrade.DiffType.DELETE) {
                sb.append(segment.text());
            }
        }
        return sb.toString();
    }

    private static void validateCorrections(String essay, List<WritingGrade.Correction> corrections) {
        int lastEnd = 0;
        int essayLen = essay.length();

        for (WritingGrade.Correction c : corrections) {
            if (c == null) {
                throw new IllegalArgumentException("Correction must not be null");
            }
            if (c.start() < 0 || c.end() > essayLen) {
                throw new IndexOutOfBoundsException("Correction offsets [" + c.start() + ", " + c.end() + "] out of bounds for essay length " + essayLen);
            }
            if (c.start() > c.end()) {
                throw new IllegalArgumentException("Correction start (" + c.start() + ") must be <= end (" + c.end() + ")");
            }
            if (c.start() < lastEnd) {
                throw new IllegalArgumentException("Corrections must be sorted and non-overlapping. Found overlap/disorder at start " + c.start() + " after previous end " + lastEnd);
            }

            // Surrogate pair safety: offset must not fall between high surrogate and low surrogate
            if (c.start() > 0 && c.start() < essayLen
                    && Character.isLowSurrogate(essay.charAt(c.start()))
                    && Character.isHighSurrogate(essay.charAt(c.start() - 1))) {
                throw new IllegalArgumentException("Correction start offset " + c.start() + " cuts a surrogate pair");
            }
            if (c.end() > 0 && c.end() < essayLen
                    && Character.isLowSurrogate(essay.charAt(c.end()))
                    && Character.isHighSurrogate(essay.charAt(c.end() - 1))) {
                throw new IllegalArgumentException("Correction end offset " + c.end() + " cuts a surrogate pair");
            }

            lastEnd = c.end();
        }
    }
}
