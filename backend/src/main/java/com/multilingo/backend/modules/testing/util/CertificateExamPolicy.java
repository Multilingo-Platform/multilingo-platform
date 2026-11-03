package com.multilingo.backend.modules.testing.util;

import com.multilingo.backend.modules.testing.grading.CertificateScoreProjector;

import java.util.Locale;

/** Canonical full-exam duration and result units for supported certificate families. */
public final class CertificateExamPolicy {
    private CertificateExamPolicy() {}

    public static Integer fullExamDurationMinutes(String examType) {
        return switch (normalize(examType)) {
            case "IELTS_ACADEMIC", "IELTS_GENERAL_TRAINING" -> 150;
            case "TOEIC_LR" -> 120;
            default -> null;
        };
    }

    public static String scoreUnit(String examType) {
        return switch (normalize(examType)) {
            case "IELTS_ACADEMIC", "IELTS_GENERAL_TRAINING" -> "IELTS_BAND";
            case "TOEIC_LR" -> "TOEIC_SCALED";
            default -> "RAW_OBJECTIVE";
        };
    }

    public static boolean isFullCertificateScoringType(String examType) {
        return !"RAW_OBJECTIVE".equals(scoreUnit(examType));
    }

    public static boolean isGeneralTraining(String examType) {
        return "IELTS_GENERAL_TRAINING".equals(normalize(examType));
    }

    public static String scorePolicyVersion(String examType) {
        return isFullCertificateScoringType(examType) ? CertificateScoreProjector.POLICY_VERSION : null;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }
}
