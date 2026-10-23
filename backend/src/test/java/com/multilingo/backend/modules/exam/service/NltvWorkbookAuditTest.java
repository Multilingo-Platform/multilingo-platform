package com.multilingo.backend.modules.exam.service;

import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class NltvWorkbookAuditTest {
    private static final String RESOURCE = "/datasets/official-source/nltv-sample-test-1.xlsx";
    private static final String SOURCE_SHA256 =
            "b93b2d2cf13d8139faeabc133c271deec555f12368125e059fb54e9ce167f224";

    @Test
    void suppliedWorkbookHasExpectedStructureAndNoAudioAssets() throws Exception {
        try (InputStream input = getClass().getResourceAsStream(RESOURCE)) {
            assertThat(input).as("copied source workbook").isNotNull();
            byte[] bytes = input.readAllBytes();
            assertThat(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)))
                    .isEqualTo(SOURCE_SHA256);

            try (Workbook workbook = WorkbookFactory.create(new java.io.ByteArrayInputStream(bytes))) {
                assertThat(workbook.getNumberOfSheets()).isEqualTo(3);
                Sheet info = workbook.getSheet("Thông Tin Đề Thi");
                Sheet questions = workbook.getSheet("Exam Template");
                assertThat(info).isNotNull();
                assertThat(questions).isNotNull();
                assertThat(questions.getLastRowNum()).isEqualTo(107);

                DataFormatter formatter = new DataFormatter();
                List<Row> questionRows = questions.rowIterator().hasNext()
                        ? java.util.stream.StreamSupport.stream(questions.spliterator(), false)
                            .filter(row -> row.getRowNum() > 0 && !formatter.formatCellValue(row.getCell(6)).isBlank())
                            .toList()
                        : List.of();
                assertThat(questionRows).hasSize(107);
                assertThat(questionRows.stream().filter(row -> {
                    var cell = row.getCell(16);
                    return cell != null && cell.getCellType() == CellType.BLANK;
                })).hasSize(0); // explanation cells are populated in the source.
                assertThat(questionRows.stream().allMatch(row -> {
                    var audio = row.getCell(17);
                    return audio == null || formatter.formatCellValue(audio).isBlank();
                })).isTrue();
                assertThat(questionRows.stream().filter(row -> {
                    var group = row.getCell(2);
                    return group != null && !formatter.formatCellValue(group).isBlank();
                })).hasSize(27);
            }
        }
    }

    @Test
    void revisedWorkbookHasExactlyFourPartAudioAssetsAndRegisteredChecksum() throws Exception {
        String revised = "/datasets/official-source/nltv-sample-test-1-audio.v1.xlsx";
        try (InputStream input = getClass().getResourceAsStream(revised)) {
            assertThat(input).as("revised source workbook").isNotNull();
            byte[] bytes = input.readAllBytes();
            assertThat(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)))
                    .isEqualTo(NltvExamSourceProfile.AUDIO_SAMPLE_SHA256);
            try (Workbook workbook = WorkbookFactory.create(new java.io.ByteArrayInputStream(bytes))) {
                Sheet template = workbook.getSheet("Exam Template");
                DataFormatter formatter = new DataFormatter();
                assertThat(List.of(2, 17, 31, 45)).allSatisfy(rowNumber ->
                        assertThat(formatter.formatCellValue(template.getRow(rowNumber - 1).getCell(17)))
                                .startsWith("https://"));
                assertThat(formatter.formatCellValue(template.getRow(96).getCell(17))).isBlank();
                assertThat(template.getLastRowNum()).isEqualTo(107);
            }
        }
    }
}
