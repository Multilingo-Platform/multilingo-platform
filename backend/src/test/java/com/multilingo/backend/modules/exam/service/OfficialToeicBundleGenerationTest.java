package com.multilingo.backend.modules.exam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import com.multilingo.backend.modules.exam.dto.response.ExamDatasetBundle;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class OfficialToeicBundleGenerationTest {
    private static final String SOURCE = "/datasets/official-source/ets-2024-test-1-completed.xlsx";
    private static final String RIGHTS_APPROVAL = "OWNER_RIGHTS_CONFIRMED_CHAT_2026-10-17";
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void exportsValidatedToeicBundleFromChecksumAuditedWorkbook() throws Exception {
        ExamBuilderRequest request;
        try (InputStream input = getClass().getResourceAsStream(SOURCE)) {
            assertThat(input).as("checksum-audited TOEIC source workbook").isNotNull();
            request = new ExamParserService(objectMapper).parseExamFile(new MockMultipartFile("file",
                    "ETS_2024_Test_1_completed.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", input.readAllBytes()));
        }

        ExamDatasetBundle bundle = ExamDatasetBundle.exportOfficial(request,
                OfficialExamDatasetRegistry.ETS_TOEIC_KEY, RIGHTS_APPROVAL);
        bundle.validate();
        assertThat(bundle.examCode()).isEqualTo("TOEIC-ETS-2024-T1-V2");
        assertThat(bundle.request().isPublished()).isFalse();
        assertThat(bundle.source().approvalReference()).isEqualTo(RIGHTS_APPROVAL);

        Path output = Path.of("target", "generated-official-datasets", "ets-2024-test-1.v2.json");
        Files.createDirectories(output.getParent());
        objectMapper.writerWithDefaultPrettyPrinter().writeValue(output.toFile(), bundle);

        ExamDatasetBundle roundTrip = objectMapper.readValue(output.toFile(), ExamDatasetBundle.class);
        roundTrip.validate();
        assertThat(roundTrip.checksum()).isEqualTo(bundle.checksum());

        try (InputStream runtimeInput = getClass().getResourceAsStream(
                "/datasets/exams/ets-2024-test-1.v2.json")) {
            assertThat(runtimeInput).as("published TOEIC runtime bundle").isNotNull();
            ExamDatasetBundle runtimeBundle = objectMapper.readValue(runtimeInput, ExamDatasetBundle.class);
            runtimeBundle.validate();
            assertThat(runtimeBundle.datasetKey()).isEqualTo(OfficialExamDatasetRegistry.ETS_TOEIC_KEY);
            assertThat(runtimeBundle.checksum()).isEqualTo(bundle.checksum());
        }
    }
}
