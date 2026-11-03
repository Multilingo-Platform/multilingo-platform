package com.multilingo.backend.modules.testing.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class CertificateExamPolicyTest {
    @Test
    void knownFullExamTypesUseFixedStandardTimesAndScoreUnits() {
        assertEquals(150, CertificateExamPolicy.fullExamDurationMinutes("IELTS_ACADEMIC"));
        assertEquals(150, CertificateExamPolicy.fullExamDurationMinutes("IELTS_GENERAL_TRAINING"));
        assertEquals(120, CertificateExamPolicy.fullExamDurationMinutes("TOEIC_LR"));
        assertEquals("IELTS_BAND", CertificateExamPolicy.scoreUnit("IELTS_ACADEMIC"));
        assertEquals("TOEIC_SCALED", CertificateExamPolicy.scoreUnit("TOEIC_LR"));
    }

    @Test
    void unsupportedTypesKeepConfiguredDurationAndRawScoring() {
        assertNull(CertificateExamPolicy.fullExamDurationMinutes("NLTV"));
        assertEquals("RAW_OBJECTIVE", CertificateExamPolicy.scoreUnit("NLTV"));
    }
}
