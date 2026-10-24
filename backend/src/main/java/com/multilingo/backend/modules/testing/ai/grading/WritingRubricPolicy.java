package com.multilingo.backend.modules.testing.ai.grading;

import java.math.BigDecimal;
import java.util.List;

/** Immutable server-owned discriminator for a new Writing grading job. */
public record WritingRubricPolicy(
        String policyVersion,
        String rubricCode,
        String scoreUnit,
        BigDecimal maxScore,
        BigDecimal criterionStep,
        String sourceLanguage,
        List<String> criterionCodes,
        String promptVersion
) {
    public WritingRubricPolicy {
        criterionCodes = List.copyOf(criterionCodes);
    }
}
