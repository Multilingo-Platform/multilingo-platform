package com.multilingo.backend.modules.exam.service;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.ss.util.CellReference;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OfficialExamWorkbookAuditTest {
    private static final String IELTS_RESOURCE = "/datasets/official-source/cambridge-ielts-20-test-1.xlsx";
    private static final String TOEIC_RESOURCE = "/datasets/official-source/ets-2024-test-1-completed.xlsx";
    private static final String IELTS_SHA256 = "1427bd88ff54e59d695bc2b3b02bfbe301e0658a3a76b79bfb3f650461402ee1";
    private static final String TOEIC_SHA256 = "990f8aa1d8190302e469aa021c50ea30e3a65817b4db698c30d47463c08a7fde";
    private static final DataFormatter FORMATTER = new DataFormatter();

    @Test
    void suppliedWorkbooksMatchApprovedChecksumsAndTemplateShapes() throws Exception {
        byte[] ielts = resourceBytes(IELTS_RESOURCE);
        byte[] toeic = resourceBytes(TOEIC_RESOURCE);

        assertThat(sha256(ielts)).isEqualTo(IELTS_SHA256);
        assertThat(sha256(toeic)).isEqualTo(TOEIC_SHA256);

        try (Workbook workbook = WorkbookFactory.create(new java.io.ByteArrayInputStream(ielts))) {
            assertThat(workbook.getSheet("Exam Template").getLastRowNum()).isEqualTo(82);
            assertThat(workbook.getSheet("Exam Template").getRow(0).getLastCellNum()).isEqualTo((short) 20);
        }
        try (Workbook workbook = WorkbookFactory.create(new java.io.ByteArrayInputStream(toeic))) {
            assertThat(workbook.getSheet("Exam Template").getLastRowNum()).isEqualTo(200);
            assertThat(workbook.getSheet("Exam Template").getRow(0).getLastCellNum()).isEqualTo((short) 16);
        }
    }

    @Test
    void ieltsSourceHasEightyTwoAnsweredRowsFiveTwoAnswerPairsAndNoExplanations() throws Exception {
        try (Workbook workbook = workbook(IELTS_RESOURCE)) {
            Sheet sheet = workbook.getSheet("Exam Template");
            assertThat(nonBlankCount(sheet, 1, 82, 6)).isEqualTo(82);
            assertThat(nonBlankCount(sheet, 1, 82, 15)).isEqualTo(80);
            assertThat(nonBlankCount(sheet, 1, 82, 16)).isZero();
            assertThat(java.util.stream.IntStream.rangeClosed(1, 82)
                    .mapToObj(sheet::getRow)
                    .filter(row -> "WRITING_ESSAY".equals(text(row.getCell(3))))
                    .count()).isEqualTo(2);

            List<String> pairAnswerSets = java.util.stream.IntStream.rangeClosed(1, 82)
                    .mapToObj(sheet::getRow)
                    .filter(row -> "MULTIPLE_CHOICE_MULTI".equals(text(row.getCell(3))))
                    .map(row -> text(row.getCell(15)))
                    .toList();
            assertThat(pairAnswerSets).containsExactly(
                    "A,E", "A,E", "C,E", "C,E", "C,E", "C,E", "A,C", "A,C", "A,B", "A,B");

            assertThat(countCellText(sheet, "<img")).isEqualTo(4);
        }
    }

    @Test
    void flagsUnverifiedInsertedTextInTheCambridgeReadingPassage() throws Exception {
        try (Workbook workbook = workbook(IELTS_RESOURCE)) {
            Sheet sheet = workbook.getSheet("Exam Template");
            List<String> locations = java.util.stream.StreamSupport.stream(sheet.spliterator(), false)
                    .flatMap(row -> java.util.stream.StreamSupport.stream(row.spliterator(), false))
                    .filter(cell -> text(cell).contains("dongan.signs"))
                    .map(cell -> CellReference.convertNumToColString(cell.getColumnIndex()) + (cell.getRowIndex() + 1))
                    .toList();
            assertThat(locations).containsExactly("F42", "F46", "F51", "F56", "F69", "F74", "F79");
        }
    }

    @Test
    void toeicSourceHasTwoHundredAnsweredExplainedRowsAndTheKnownGroupEightGap() throws Exception {
        try (Workbook workbook = workbook(TOEIC_RESOURCE)) {
            Sheet sheet = workbook.getSheet("Exam Template");
            assertThat(nonBlankCount(sheet, 1, 200, 6)).isEqualTo(200);
            assertThat(nonBlankCount(sheet, 1, 200, 11)).isEqualTo(200);
            assertThat(nonBlankCount(sheet, 1, 200, 12)).isEqualTo(200);
            assertThat(countCellText(sheet, "ANSWER-KEY-DERIVED CLUES")).isGreaterThan(0);
            assertThat(text(sheet.getRow(164).getCell(2))).isEmpty();
            assertThat(text(sheet.getRow(164).getCell(5))).isEmpty();
        }
    }

    @Test
    void supplementalToeicWorkbookContainsThePassageForQuestions165To167() throws Exception {
        Path source = Path.of("ETS_2024_Test_1 (có giải thích).xlsx");
        assertThat(Files.exists(source)).isTrue();
        byte[] sourceBytes = Files.readAllBytes(source);
        assertThat(sha256(sourceBytes))
                .isEqualTo("b3abb7c09150f4f04022af1a96f3b3e335766d9daa1bdd4a4b217b301a76c3d1");

        try (Workbook workbook = WorkbookFactory.create(new java.io.ByteArrayInputStream(sourceBytes))) {
            Sheet sheet = workbook.getSheet("Exam Template");
            assertThat(text(sheet.getRow(165).getCell(5))).contains("Great Dishwasher");
            assertThat(text(sheet.getRow(165).getCell(2))).isEqualTo("Group 8");
            assertThat(text(sheet.getRow(165).getCell(11))).isNotBlank();
        }
    }

    private Workbook workbook(String resource) throws Exception {
        return WorkbookFactory.create(new java.io.ByteArrayInputStream(resourceBytes(resource)));
    }

    private byte[] resourceBytes(String resource) throws Exception {
        try (InputStream input = getClass().getResourceAsStream(resource)) {
            assertThat(input).as("test workbook resource %s", resource).isNotNull();
            return input.readAllBytes();
        }
    }

    private long nonBlankCount(Sheet sheet, int firstRow, int lastRow, int column) {
        return java.util.stream.IntStream.rangeClosed(firstRow, lastRow)
                .mapToObj(sheet::getRow)
                .map(row -> row == null ? null : row.getCell(column))
                .filter(cell -> !text(cell).isBlank())
                .count();
    }

    private long countCellText(Sheet sheet, String token) {
        return java.util.stream.StreamSupport.stream(sheet.spliterator(), false)
                .flatMap(row -> java.util.stream.StreamSupport.stream(row.spliterator(), false))
                .map(this::text)
                .filter(value -> value.contains(token))
                .count();
    }

    private String text(Cell cell) {
        return cell == null ? "" : FORMATTER.formatCellValue(cell).trim();
    }

    private String sha256(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }
}
