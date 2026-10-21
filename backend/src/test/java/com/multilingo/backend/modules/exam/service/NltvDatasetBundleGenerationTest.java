package com.multilingo.backend.modules.exam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.dto.response.ExamDatasetBundle;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class NltvDatasetBundleGenerationTest {
    private static final String SOURCE = "/datasets/official-source/nltv-sample-test-1-audio.v1.xlsx";
    private static final String APPROVAL = "OWNER_REQUESTED_PUBLICATION_CHAT_2026-10-21";
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void buildsDeterministicRegisteredNltvBundleAndMatchesRuntimeResource() throws Exception {
        byte[] source;
        try (InputStream input = getClass().getResourceAsStream(SOURCE)) {
            assertThat(input).as("revised NLTV source").isNotNull();
            source = input.readAllBytes();
        }
        var request = new ExamParserService(mapper).parseExamFile(new MockMultipartFile("file",
                "Đề_thi_Đánh_giá_Năng_lực_Tiếng_Việt_(NLTV)_Mẫu (1).xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", source));

        ExamDatasetBundle bundle = ExamDatasetBundle.exportOfficial(request,
                "nltv-sample-test-1", APPROVAL);
        bundle.validate();
        assertThat(bundle.schemaVersion()).isEqualTo(2);
        assertThat(bundle.datasetKey()).isEqualTo("nltv-sample-test-1");
        assertThat(bundle.version()).isEqualTo(1);
        assertThat(bundle.examCode()).isEqualTo("NLTV-SAMPLE-T1-V1");
        assertThat(bundle.request().isPublished()).isFalse();
        assertThat(bundle.request().getSections()).extracting(section -> section.getDurationMinutes())
                .containsExactly(60, 60, 60);
        assertThat(bundle.checksum()).isEqualTo(ExamDatasetBundle.digest(request));

        int objective = 0;
        int essays = 0;
        for (var section : bundle.request().getSections()) for (var part : section.getParts()) {
            List<?> groups = (List<?>) part.getContentData().get("question_groups");
            for (Object rawGroup : groups) {
                Map<?, ?> group = (Map<?, ?>) rawGroup;
                for (Object rawQuestion : (List<?>) group.get("questions")) {
                    Map<?, ?> question = (Map<?, ?>) rawQuestion;
                    if ("ESSAY".equals(question.get("type"))) essays++;
                    else objective++;
                }
            }
        }
        assertThat(objective).isEqualTo(105);
        assertThat(essays).isEqualTo(2);

        Path output = Path.of("target", "generated-official-datasets", "nltv-sample-test-1.v2.json");
        Files.createDirectories(output.getParent());
        mapper.writerWithDefaultPrettyPrinter().writeValue(output.toFile(), bundle);
        ExamDatasetBundle generated = mapper.readValue(output.toFile(), ExamDatasetBundle.class);
        generated.validate();
        assertThat(generated.checksum()).isEqualTo(bundle.checksum());

        try (InputStream runtime = getClass().getResourceAsStream(
                "/datasets/exams/nltv-sample-test-1.v2.json")) {
            assertThat(runtime).as("runtime NLTV bundle").isNotNull();
            ExamDatasetBundle runtimeBundle = mapper.readValue(runtime, ExamDatasetBundle.class);
            runtimeBundle.validate();
            assertThat(runtimeBundle.checksum()).isEqualTo(bundle.checksum());
        }
    }
}
