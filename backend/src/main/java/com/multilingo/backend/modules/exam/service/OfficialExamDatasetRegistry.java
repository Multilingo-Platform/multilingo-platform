package com.multilingo.backend.modules.exam.service;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Code-owned allowlist for portable official exam datasets; no manifest-provided paths are loaded. */
public final class OfficialExamDatasetRegistry {
    public static final String CAMBRIDGE_IELTS_KEY = "cambridge-ielts-20-test-1";
    public static final String ETS_TOEIC_KEY = "ets-2024-test-1";
    public static final String NLTV_SAMPLE_KEY = "nltv-sample-test-1";

    public record SourceDefinition(String fileName, String sha256, boolean supplementary, String approvalReference) {
        public SourceDefinition(String fileName, String sha256, boolean supplementary) {
            this(fileName, sha256, supplementary, null);
        }
    }
    public record SectionDefinition(String skill, int durationMinutes, List<Integer> partNumbers) {
        public SectionDefinition { partNumbers = List.copyOf(partNumbers); }
    }
    public record DatasetDefinition(String datasetKey, int version, String examCode, String title,
            String type, String language, String explanationStatus, List<SourceDefinition> sources,
            List<Integer> questionCountsByPart, List<SectionDefinition> sections, int groupCount,
            int objectiveQuestionCount, int essayQuestionCount) {
        public DatasetDefinition {
            sources = List.copyOf(sources);
            questionCountsByPart = List.copyOf(questionCountsByPart);
            sections = List.copyOf(sections);
        }
    }

    private static final DatasetDefinition CAMBRIDGE_IELTS_V1 = new DatasetDefinition(CAMBRIDGE_IELTS_KEY, 1,
            "IELTS-CAMBRIDGE-20-T1-V1", "Cambridge Ielts 20 Test 1", "IELTS_ACADEMIC", "en", "PARTIAL",
            List.of(new SourceDefinition("Cambridge_Ielts_20_Test_1_(Chưa_giải_thích).xlsx",
                    OfficialExamSourceProfile.CAMBRIDGE_IELTS_20_SHA256, false, null)),
            List.of(10, 10, 10, 10, 13, 13, 14, 1, 1),
            List.of(new SectionDefinition("LISTENING", 30, List.of(1, 2, 3, 4)),
                    new SectionDefinition("READING", 60, List.of(5, 6, 7)),
                    new SectionDefinition("WRITING", 60, List.of(8, 9))),
            19, 80, 2);

    private static final DatasetDefinition CAMBRIDGE_IELTS_V2 = new DatasetDefinition(CAMBRIDGE_IELTS_KEY, 2,
            "IELTS-CAMBRIDGE-20-T1-V2", "Cambridge Ielts 20 Test 1", "IELTS_ACADEMIC", "en", "COMPLETE",
            List.of(new SourceDefinition("Cambridge_Ielts_20_Test_1_(Full_giải_thích).xlsx",
                    OfficialExamSourceProfile.CAMBRIDGE_IELTS_20_V2_SHA256, false,
                    "OWNER_RIGHTS_CONFIRMED_CHAT_2026-10-19")),
            List.of(10, 10, 10, 10, 13, 13, 14, 1, 1),
            List.of(new SectionDefinition("LISTENING", 30, List.of(1, 2, 3, 4)),
                    new SectionDefinition("READING", 60, List.of(5, 6, 7)),
                    new SectionDefinition("WRITING", 60, List.of(8, 9))),
            19, 80, 2);

    private static final DatasetDefinition ETS_TOEIC = new DatasetDefinition(ETS_TOEIC_KEY, 2,
            "TOEIC-ETS-2024-T1-V2", "ETS 2024 Test 1", "TOEIC_LR", "en", "COMPLETE",
            List.of(new SourceDefinition("ETS_2024_Test_1_completed.xlsx",
                            OfficialExamSourceProfile.ETS_2024_COMPLETED_SHA256, false,
                            "OWNER_RIGHTS_CONFIRMED_CHAT_2026-10-17"),
                    new SourceDefinition("ETS_2024_Test_1 (có giải thích).xlsx",
                            OfficialExamSourceProfile.ETS_2024_SUPPLEMENT_SHA256, true,
                            "OWNER_RIGHTS_CONFIRMED_CHAT_2026-10-17")),
            List.of(6, 25, 39, 30, 30, 16, 54),
            List.of(new SectionDefinition("LISTENING", 45, List.of(1, 2, 3, 4)),
                    new SectionDefinition("READING", 75, List.of(5, 6, 7))),
            50, 200, 0);

    private static final DatasetDefinition NLTV_SAMPLE_V1 = new DatasetDefinition(NLTV_SAMPLE_KEY, 1,
            "NLTV-SAMPLE-T1-V1", "Đề thi Đánh giá Năng lực Tiếng Việt (NLTV) Mẫu", "NLTV", "vi", "COMPLETE",
            List.of(new SourceDefinition("Đề_thi_Đánh_giá_Năng_lực_Tiếng_Việt_(NLTV)_Mẫu (1).xlsx",
                    NltvExamSourceProfile.AUDIO_SAMPLE_SHA256, false,
                    "OWNER_REQUESTED_PUBLICATION_CHAT_2026-10-21")),
            List.of(15, 14, 14, 12, 16, 24, 10, 1, 1),
            List.of(new SectionDefinition("LISTENING", 60, List.of(1, 2, 3, 4)),
                    new SectionDefinition("READING", 60, List.of(5, 6)),
                    new SectionDefinition("WRITING", 60, List.of(7, 8, 9))),
            27, 105, 2);

    private static final Map<String, List<DatasetDefinition>> DATASETS = Map.of(
            CAMBRIDGE_IELTS_KEY, List.of(CAMBRIDGE_IELTS_V1, CAMBRIDGE_IELTS_V2),
            ETS_TOEIC_KEY, List.of(ETS_TOEIC),
            NLTV_SAMPLE_KEY, List.of(NLTV_SAMPLE_V1));

    private OfficialExamDatasetRegistry() {}

    public static DatasetDefinition require(String datasetKey, int version) {
        return DATASETS.getOrDefault(datasetKey, List.of()).stream()
                .filter(definition -> definition.version() == version)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown official exam dataset version."));
    }

    public static Optional<DatasetDefinition> findByExamCode(String examCode) {
        return DATASETS.values().stream().flatMap(List::stream)
                .filter(definition -> definition.examCode().equals(examCode))
                .findFirst();
    }

    public static Optional<DatasetDefinition> find(String datasetKey) {
        return DATASETS.getOrDefault(datasetKey, List.of()).stream()
                .max(Comparator.comparingInt(DatasetDefinition::version));
    }
}
