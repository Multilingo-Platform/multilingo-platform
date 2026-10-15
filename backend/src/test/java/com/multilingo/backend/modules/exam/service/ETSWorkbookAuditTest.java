package com.multilingo.backend.modules.exam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.mock.web.MockMultipartFile;
import java.nio.file.*;
import static org.assertj.core.api.Assertions.*;

/** Read-only opt-in audit; the copyrighted workbook is not committed as a fixture. */
@EnabledIfSystemProperty(named = "ets.source", matches = ".+")
class ETSWorkbookAuditTest {
    @Test void realSourceHas200Questions50GroupsAndCannotPublish() throws Exception {
        byte[] bytes = Files.readAllBytes(Path.of(System.getProperty("ets.source")));
        var file = new MockMultipartFile("file", "ETS.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes);
        var preview = new ExamParserService(new ObjectMapper()).previewExamFile(file);
        assertThat(preview.counts()).isEqualTo(new com.multilingo.backend.modules.exam.dto.response.ExamImportPreviewResponse.Counts(7,50,200));
        assertThat(preview.sourceSha256()).isEqualTo("5d0a4415c3c1d49dc55d8150e6454e7144eda843d1a7c3aacb20efbc095699ce");
        assertThat(preview.canPublish()).isFalse();
        assertThat(preview.issues().stream().filter(issue -> "ANSWER_INVALID".equals(issue.code()) && "Exam Template".equals(issue.sheet())).count()).isEqualTo(66);
        assertThat(preview.request().isPublished()).isFalse();
        assertThat(preview.request().getTitle()).isEqualTo("ETS 2024 Test 1");
        assertThat(preview.request().getSections().getFirst().getParts().getFirst().getContentData())
            .containsEntry("import_profile", "ETS_2024_TEMPLATE_44");
        assertThat(preview.issues()).anySatisfy(issue -> {
            assertThat(issue.code()).isEqualTo("EXPLANATION_REQUIRED");
            assertThat(issue.cell()).isEqualTo("M2");
        });
        assertThat(preview.request().getSections().get(1).getParts().getFirst().getContentData()).doesNotContainKey("shared_audio");
    }
}
