package com.multilingo.backend.modules.exam.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OfficialExamDatasetRegistryTest {
    @Test
    void registersOnlyTheTwoReviewedDatasetKeysAndTheirCurrentVersions() {
        var ielts = OfficialExamDatasetRegistry.require("cambridge-ielts-20-test-1", 1);
        var toeic = OfficialExamDatasetRegistry.require("ets-2024-test-1", 2);

        assertThat(ielts.examCode()).isEqualTo("IELTS-CAMBRIDGE-20-T1-V1");
        assertThat(ielts.type()).isEqualTo("IELTS_ACADEMIC");
        assertThat(ielts.explanationStatus()).isEqualTo("PARTIAL");
        assertThat(ielts.sources()).hasSize(1);
        assertThat(toeic.examCode()).isEqualTo("TOEIC-ETS-2024-T1-V2");
        assertThat(toeic.type()).isEqualTo("TOEIC_LR");
        assertThat(toeic.explanationStatus()).isEqualTo("COMPLETE");
        assertThat(toeic.sources()).extracting(OfficialExamDatasetRegistry.SourceDefinition::sha256)
                .containsExactly(OfficialExamSourceProfile.ETS_2024_COMPLETED_SHA256,
                        OfficialExamSourceProfile.ETS_2024_SUPPLEMENT_SHA256);
    }

    @Test
    void rejectsUnknownDatasetAndUnregisteredVersion() {
        assertThatThrownBy(() -> OfficialExamDatasetRegistry.require("untrusted-dataset", 1))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> OfficialExamDatasetRegistry.require("ets-2024-test-1", 1))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
