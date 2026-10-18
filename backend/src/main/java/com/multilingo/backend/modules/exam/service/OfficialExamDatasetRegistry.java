package com.multilingo.backend.modules.exam.service;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Code-owned allowlist for portable official exam datasets; no manifest-provided paths are loaded. */
public final class OfficialExamDatasetRegistry {
    public static final String CAMBRIDGE_IELTS_KEY = "cambridge-ielts-20-test-1";
    public static final String ETS_TOEIC_KEY = "ets-2024-test-1";

    public record SourceDefinition(String fileName, String sha256, boolean supplementary) {}
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

    private static final Map<String, DatasetDefinition> DATASETS = Map.of(
            CAMBRIDGE_IELTS_KEY, new DatasetDefinition(CAMBRIDGE_IELTS_KEY, 1,
                    "IELTS-CAMBRIDGE-20-T1-V1", "Cambridge Ielts 20 Test 1", "IELTS_ACADEMIC", "en", "PARTIAL",
                    List.of(new SourceDefinition("Cambridge_Ielts_20_Test_1_(Chưa_giải_thích).xlsx",
                            OfficialExamSourceProfile.CAMBRIDGE_IELTS_20_SHA256, false)),
                    List.of(10, 10, 10, 10, 13, 13, 14, 1, 1),
                    List.of(new SectionDefinition("LISTENING", 30, List.of(1, 2, 3, 4)),
                            new SectionDefinition("READING", 60, List.of(5, 6, 7)),
                            new SectionDefinition("WRITING", 60, List.of(8, 9))),
                    19, 80, 2),
            ETS_TOEIC_KEY, new DatasetDefinition(ETS_TOEIC_KEY, 2,
                    "TOEIC-ETS-2024-T1-V2", "ETS 2024 Test 1", "TOEIC_LR", "en", "COMPLETE",
                    List.of(new SourceDefinition("ETS_2024_Test_1_completed.xlsx",
                                    OfficialExamSourceProfile.ETS_2024_COMPLETED_SHA256, false),
                            new SourceDefinition("ETS_2024_Test_1 (có giải thích).xlsx",
                                    OfficialExamSourceProfile.ETS_2024_SUPPLEMENT_SHA256, true)),
                    List.of(6, 25, 39, 30, 30, 16, 54),
                    List.of(new SectionDefinition("LISTENING", 45, List.of(1, 2, 3, 4)),
                            new SectionDefinition("READING", 75, List.of(5, 6, 7))),
                    50, 200, 0));

    private OfficialExamDatasetRegistry() {}

    public static DatasetDefinition require(String datasetKey, int version) {
        DatasetDefinition definition = DATASETS.get(datasetKey);
        if (definition == null || definition.version() != version)
            throw new IllegalArgumentException("Unknown official exam dataset version.");
        return definition;
    }

    public static Optional<DatasetDefinition> findByExamCode(String examCode) {
        return DATASETS.values().stream().filter(definition -> definition.examCode().equals(examCode)).findFirst();
    }

    public static Optional<DatasetDefinition> find(String datasetKey) {
        return Optional.ofNullable(DATASETS.get(datasetKey));
    }
}
