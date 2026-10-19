package com.multilingo.backend.modules.exam.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OfficialExamDatasetRegistryTest {
    @Test
    void registersOnlyTheTwoReviewedDatasetKeysAndExposesV2AsTheCurrentCambridgeVersion() {
        var ieltsV1 = OfficialExamDatasetRegistry.require("cambridge-ielts-20-test-1", 1);
        var ieltsV2 = OfficialExamDatasetRegistry.require("cambridge-ielts-20-test-1", 2);
        var current = OfficialExamDatasetRegistry.find("cambridge-ielts-20-test-1").orElseThrow();
        var toeic = OfficialExamDatasetRegistry.require("ets-2024-test-1", 2);

        assertThat(current).isEqualTo(ieltsV2);
        assertThat(ieltsV1.examCode()).isEqualTo("IELTS-CAMBRIDGE-20-T1-V1");
        assertThat(ieltsV1.explanationStatus()).isEqualTo("PARTIAL");
        assertThat(ieltsV1.sources()).extracting(OfficialExamDatasetRegistry.SourceDefinition::sha256)
                .containsExactly(OfficialExamSourceProfile.CAMBRIDGE_IELTS_20_SHA256);

        assertThat(ieltsV1.sources().getFirst().approvalReference()).isNull();

        assertThat(ieltsV2.examCode()).isEqualTo("IELTS-CAMBRIDGE-20-T1-V2");
        assertThat(ieltsV2.type()).isEqualTo("IELTS_ACADEMIC");
        assertThat(ieltsV2.language()).isEqualTo("en");
        assertThat(ieltsV2.title()).isEqualTo("Cambridge Ielts 20 Test 1");
        assertThat(ieltsV2.explanationStatus()).isEqualTo("COMPLETE");
        assertThat(ieltsV2.sources()).containsExactly(new OfficialExamDatasetRegistry.SourceDefinition(
                "Cambridge_Ielts_20_Test_1_(Full_giải_thích).xlsx",
                OfficialExamSourceProfile.CAMBRIDGE_IELTS_20_V2_SHA256, false,
                "OWNER_RIGHTS_CONFIRMED_CHAT_2026-10-19"));
        assertThat(ieltsV2.questionCountsByPart()).containsExactly(10, 10, 10, 10, 13, 13, 14, 1, 1);
        assertThat(ieltsV2.sections()).extracting(OfficialExamDatasetRegistry.SectionDefinition::skill)
                .containsExactly("LISTENING", "READING", "WRITING");
        assertThat(ieltsV2.sections()).extracting(OfficialExamDatasetRegistry.SectionDefinition::durationMinutes)
                .containsExactly(30, 60, 60);
        assertThat(ieltsV2.groupCount()).isEqualTo(19);
        assertThat(ieltsV2.objectiveQuestionCount()).isEqualTo(80);
        assertThat(ieltsV2.essayQuestionCount()).isEqualTo(2);

        assertThat(OfficialExamDatasetRegistry.findByExamCode("IELTS-CAMBRIDGE-20-T1-V1")).contains(ieltsV1);
        assertThat(OfficialExamDatasetRegistry.findByExamCode("IELTS-CAMBRIDGE-20-T1-V2")).contains(ieltsV2);

        assertThat(toeic.examCode()).isEqualTo("TOEIC-ETS-2024-T1-V2");
        assertThat(toeic.type()).isEqualTo("TOEIC_LR");
        assertThat(toeic.explanationStatus()).isEqualTo("COMPLETE");
        assertThat(toeic.sources()).extracting(OfficialExamDatasetRegistry.SourceDefinition::sha256)
                .containsExactly(OfficialExamSourceProfile.ETS_2024_COMPLETED_SHA256,
                        OfficialExamSourceProfile.ETS_2024_SUPPLEMENT_SHA256);
        assertThat(toeic.sources()).extracting(OfficialExamDatasetRegistry.SourceDefinition::approvalReference)
                .containsOnly("OWNER_RIGHTS_CONFIRMED_CHAT_2026-10-17");
    }

    @Test
    void rejectsUnknownDatasetAndUnregisteredVersion() {
        assertThat(OfficialExamDatasetRegistry.find("untrusted-dataset")).isEmpty();
        assertThat(OfficialExamDatasetRegistry.findByExamCode("IELTS-CAMBRIDGE-20-T1-V3")).isEmpty();
        assertThatThrownBy(() -> OfficialExamDatasetRegistry.require("untrusted-dataset", 1))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> OfficialExamDatasetRegistry.require("cambridge-ielts-20-test-1", 3))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> OfficialExamDatasetRegistry.require("ets-2024-test-1", 1))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
