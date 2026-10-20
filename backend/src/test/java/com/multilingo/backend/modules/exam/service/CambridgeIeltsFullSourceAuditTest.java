package com.multilingo.backend.modules.exam.service;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.ss.util.CellRangeAddress;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Locks the source workbook used by the Cambridge IELTS 20 Test 1 V2 dataset.
 *
 * <p>This is a source audit, not a parser test. It intentionally reads the workbook directly so a
 * changed checksum, missing row, duplicate pair group, answer outside its options, merged-cell
 * boundary or media change fails before the V2 parser is implemented.</p>
 */
class CambridgeIeltsFullSourceAuditTest {
    private static final String RESOURCE =
            "/datasets/official-source/cambridge-ielts-20-test-1-full.v2.xlsx";
    private static final String APPROVED_SHA256 =
            "d00af9a50c325b85d22cbdcdc2a8205a42da0d2bbe0587985e53575fb4ce549d";
    private static final long APPROVED_SIZE = 43_386L;

    private static final String INFO_SHEET = "Thông Tin Đề Thi";
    private static final String TEMPLATE_SHEET = "Exam Template";
    private static final String INSTRUCTION_SHEET = "Hướng dẫn điền Form";

    private static final int FIRST_QUESTION_ROW = 2;
    private static final int LAST_QUESTION_ROW = 83;
    private static final int PART_COLUMN = 0;
    private static final int GROUP_COLUMN = 2;
    private static final int GROUP_CONTEXT_COLUMN = 5;
    private static final int QUESTION_COLUMN = 6;
    private static final int OPTION_COLUMN = 7;
    private static final int ANSWER_COLUMN = 15;
    private static final int EXPLANATION_COLUMN = 16;
    private static final int AUDIO_COLUMN = 17;
    private static final int GROUP_MEDIA_COLUMN = 18;
    private static final int QUESTION_MEDIA_COLUMN = 19;

    private static final List<String> HEADERS = List.of(
            "Phần (Part)", "Hướng dẫn chung (Phần)", "Nhóm (Group)", "Loại câu hỏi (Type)",
            "Hướng dẫn riêng (Nhóm)", "Nội dung nhóm (Văn bản đọc/nghe)",
            "Câu hỏi (Question Text)", "Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D",
            "Lựa chọn E", "Lựa chọn F", "Lựa chọn G", "Lựa chọn H", "Đáp án đúng",
            "Giải thích", "Audio/File chung (Phần)", "Đính kèm chung (Nhóm)",
            "Đính kèm riêng (Câu hỏi)");
    private static final List<String> AUDIO_URLS = List.of(
            "https://res.cloudinary.com/j5on4xwq/video/upload/v1792136936/fbkdrjpbwxqwitisgf5v.m4a",
            "https://res.cloudinary.com/j5on4xwq/video/upload/v1792137047/jqfiajpxuejrdlreoa82.m4a",
            "https://res.cloudinary.com/j5on4xwq/video/upload/v1792137056/u2hfekgnnnmd6ie8d6sp.m4a",
            "https://res.cloudinary.com/j5on4xwq/video/upload/v1792137116/mrxqow1dufmmh2t2mkq4.m4a");
    private static final List<String> IMAGE_URLS = List.of(
            "https://res.cloudinary.com/j5on4xwq/image/upload/v1792136948/mgadgw3of8p2ewo17yr0.png",
            "https://res.cloudinary.com/j5on4xwq/image/upload/v1792137144/wb1j4dchqkdokxa8ljgc.png",
            "https://res.cloudinary.com/j5on4xwq/image/upload/v1792137358/eswgy2vrwfji29su3q80.png",
            "https://res.cloudinary.com/j5on4xwq/image/upload/v1792140708/wp6bfysbo8ulybsgl8i4.png");

    private static final DataFormatter FORMATTER = new DataFormatter(Locale.ROOT);
    private static final Pattern PART = Pattern.compile("^Part\\s+(\\d+)\\s*:", Pattern.CASE_INSENSITIVE);
    private static final Pattern IMAGE =
            Pattern.compile("(?is)<img\\b[^>]*?src\\s*=\\s*['\"]([^'\"]+)['\"][^>]*>");
    private static final Pattern URL = Pattern.compile("https://[^\\s\"'<>]+");

    @Test
    void fixtureIsAnImmutableByteCopyWithApprovedChecksum() throws Exception {
        byte[] bytes = resourceBytes();

        assertThat(bytes.length).isEqualTo(APPROVED_SIZE);
        assertThat(sha256(bytes)).isEqualTo(APPROVED_SHA256);

        byte[] mutated = bytes.clone();
        mutated[mutated.length / 2] ^= 0x01;
        assertThat(sha256(mutated))
                .as("checksum gate must reject a one-byte mutation")
                .isNotEqualTo(APPROVED_SHA256);
    }

    @Test
    void workbookHasApprovedSheetsHeadersAndMetadata() throws Exception {
        try (Workbook workbook = workbook()) {
            assertThat(workbook.getNumberOfSheets()).isEqualTo(3);
            assertThat(workbook.getSheetName(0)).isEqualTo(INFO_SHEET);
            assertThat(workbook.getSheetName(1)).isEqualTo(TEMPLATE_SHEET);
            assertThat(workbook.getSheetName(2)).isEqualTo(INSTRUCTION_SHEET);

            Sheet sheet = workbook.getSheet(TEMPLATE_SHEET);
            assertThat(sheet).isNotNull();
            assertThat(sheet.getLastRowNum()).isEqualTo(82);
            assertThat(sheet.getRow(0).getLastCellNum()).isEqualTo((short) 20);
            assertThat(headers(sheet)).containsExactlyElementsOf(HEADERS);

            Map<String, String> metadata = metadata(workbook.getSheet(INFO_SHEET));
            assertThat(metadata)
                    .containsEntry("Tên đề thi", "Cambridge Ielts 20 Test 1 (Full giải thích)")
                    .containsEntry("Mã loại chứng chỉ", "IELTS_ACADEMIC")
                    .containsEntry("Tổng số phần thi (Parts)", "9")
                    .containsEntry("Tổng số câu hỏi (Questions)", "82");

            assertNoFormulaOrErrorCells(workbook);
        }
    }

    @Test
    void questionRowsAreContiguousAndMatchApprovedCounts() throws Exception {
        try (Workbook workbook = workbook()) {
            Sheet sheet = workbook.getSheet(TEMPLATE_SHEET);
            List<QuestionRow> rows = questionRows(sheet);

            assertThat(rows).hasSize(82);
            assertThat(rows).extracting(QuestionRow::rowNumber)
                    .containsExactlyElementsOf(IntStream.rangeClosed(2, 83).boxed().toList());
            assertThat(rows).allSatisfy(row -> {
                assertThat(row.sourcePart()).as("part at row %d", row.rowNumber()).isBetween(1, 9);
                assertThat(row.group()).as("group at row %d", row.rowNumber()).matches("Group \\d+");
                assertThat(row.type()).as("type at row %d", row.rowNumber()).isNotBlank();
                assertThat(row.prompt()).as("prompt at row %d", row.rowNumber()).isNotBlank();
            });

            assertThat(rows).filteredOn(row -> "WRITING_ESSAY".equals(row.type())).hasSize(2);
            assertThat(rows).filteredOn(row -> !"WRITING_ESSAY".equals(row.type())).hasSize(80);
            assertThat(rows).filteredOn(row -> !row.explanation().isBlank()).hasSize(82);
            assertThat(rows).filteredOn(row -> !row.answer().isBlank()).hasSize(80);
            assertThat(rows).filteredOn(row -> "WRITING_ESSAY".equals(row.type()))
                    .allSatisfy(row -> assertThat(row.answer()).isBlank());

            Map<String, Long> typeCounts = rows.stream()
                    .collect(Collectors.groupingBy(QuestionRow::type, Collectors.counting()));
            assertThat(typeCounts).containsExactlyInAnyOrderEntriesOf(Map.of(
                    "FILL_IN_THE_BLANK", 30L,
                    "MULTIPLE_CHOICE", 14L,
                    "MULTIPLE_CHOICE_MULTI", 10L,
                    "MATCHING_FEATURES", 10L,
                    "TRUE_FALSE_NOT_GIVEN", 6L,
                    "MATCHING_INFORMATION", 5L,
                    "YES_NO_NOT_GIVEN", 5L,
                    "WRITING_ESSAY", 2L));

            assertThat(scopes(sheet, PART_COLUMN)).extracting(Scope::firstRow)
                    .containsExactly(2, 12, 22, 32, 42, 55, 68, 82, 83);
            assertThat(scopes(sheet, GROUP_COLUMN)).extracting(Scope::firstRow)
                    .containsExactly(2, 12, 18, 20, 22, 24, 26, 28, 32, 42, 48, 55, 60, 65, 68, 72, 77, 82, 83);
        }
    }

    @Test
    void canonicalIdsFollowTheNewReadingOrder() throws Exception {
        try (Workbook workbook = workbook()) {
            Sheet sheet = workbook.getSheet(TEMPLATE_SHEET);
            List<QuestionRow> rows = questionRows(sheet);

            List<String> expected = new ArrayList<>();
            IntStream.rangeClosed(1, 40).forEach(i -> expected.add("l_%03d".formatted(i)));
            IntStream.rangeClosed(1, 40).forEach(i -> expected.add("r_%03d".formatted(i)));
            IntStream.rangeClosed(1, 2).forEach(i -> expected.add("w_%03d".formatted(i)));

            assertThat(rows).extracting(QuestionRow::canonicalId)
                    .containsExactlyElementsOf(expected)
                    .doesNotHaveDuplicates();

            assertThat(byId(rows, "r_001").rowNumber()).isEqualTo(42);
            assertThat(byId(rows, "r_013").rowNumber()).isEqualTo(54);
            assertThat(byId(rows, "r_014").rowNumber()).isEqualTo(55);
            assertThat(byId(rows, "r_026").rowNumber()).isEqualTo(67);
            assertThat(byId(rows, "r_027").rowNumber()).isEqualTo(68);
            assertThat(byId(rows, "r_040").rowNumber()).isEqualTo(81);

            assertThat(partLabel(sheet, 42)).isEqualTo("Part 5: Reading Passage 1");
            assertThat(partLabel(sheet, 55)).isEqualTo("Part 6: Reading Passage 2");
            assertThat(partLabel(sheet, 68)).isEqualTo("Part 7: Reading Passage 3");

            assertThat(byId(rows, "r_001").groupContext())
                    .contains("The kākāpō")
                    .doesNotContain("Bring elms to Britain", "How stress affects our judgement");
            assertThat(byId(rows, "r_014").groupContext())
                    .contains("Bring elms to Britain")
                    .doesNotContain("The kākāpō", "How stress affects our judgement");
            assertThat(byId(rows, "r_027").groupContext())
                    .contains("How stress affects our judgement")
                    .doesNotContain("The kākāpō", "Bring elms to Britain");
        }
    }

    @Test
    void fiveAnswerGroupsAreDistinctAndConsistent() throws Exception {
        try (Workbook workbook = workbook()) {
            List<QuestionRow> rows = questionRows(workbook.getSheet(TEMPLATE_SHEET));
            List<QuestionRow> pairs = rows.stream()
                    .filter(row -> "MULTIPLE_CHOICE_MULTI".equals(row.type()))
                    .toList();
            Map<String, List<QuestionRow>> groups = pairs.stream()
                    .collect(Collectors.groupingBy(
                            row -> row.sourcePart() + ":" + row.group(),
                            LinkedHashMap::new, Collectors.toList()));

            assertThat(pairs).hasSize(10);
            assertThat(groups).hasSize(5);
            assertThat(groups.keySet()).containsExactly(
                    "2:Group 2", "2:Group 3", "3:Group 1", "3:Group 2", "3:Group 3");
            assertThat(groups.values()).allSatisfy(group -> {
                assertThat(group).hasSize(2);
                assertThat(group.get(1).rowNumber()).isEqualTo(group.get(0).rowNumber() + 1);
                assertThat(group.get(1).answer()).isEqualTo(group.get(0).answer());
                assertThat(answerTokens(group.get(0).answer())).hasSize(2).doesNotHaveDuplicates();
            });

            assertThat(groups.values().stream().flatMap(List::stream).map(QuestionRow::canonicalId).toList())
                    .containsExactly("l_017", "l_018", "l_019", "l_020", "l_021",
                            "l_022", "l_023", "l_024", "l_025", "l_026");
            assertThat(groups.values().stream().map(group -> group.get(0).answer()).toList())
                    .containsExactly("A,E", "C,E", "C,E", "A,C", "A,B");
        }
    }

    @Test
    void everyObjectiveAnswerIsWithinDeclaredOptions() throws Exception {
        try (Workbook workbook = workbook()) {
            List<QuestionRow> rows = questionRows(workbook.getSheet(TEMPLATE_SHEET));

            for (QuestionRow row : rows) {
                if ("WRITING_ESSAY".equals(row.type())) {
                    assertThat(row.answer()).as("essay answer at row %d", row.rowNumber()).isBlank();
                    assertThat(row.options()).as("essay options at row %d", row.rowNumber()).isEmpty();
                    continue;
                }
                assertThat(row.answer()).as("objective answer at row %d", row.rowNumber()).isNotBlank();
                if ("FILL_IN_THE_BLANK".equals(row.type())) {
                    assertThat(row.options()).as("options at row %d", row.rowNumber()).isEmpty();
                    continue;
                }

                assertThat(row.options()).as("options at row %d", row.rowNumber()).isNotEmpty();
                List<String> answers = answerTokens(row.answer());
                assertThat(answers).as("answer count at row %d", row.rowNumber()).isNotEmpty();
                Set<String> optionIds = row.options().keySet();
                Set<String> optionTexts = new HashSet<>(row.options().values());
                for (String answer : answers) {
                    assertThat(optionIds.contains(answer) || optionTexts.contains(answer))
                            .as("answer %s at row %d must appear in options %s",
                                    answer, row.rowNumber(), row.options())
                            .isTrue();
                }
                if ("MULTIPLE_CHOICE_MULTI".equals(row.type())) {
                    assertThat(answers).allSatisfy(answer -> assertThat(optionIds).contains(answer));
                    assertThat(answers).as("pair member count at row %d", row.rowNumber()).hasSize(2);
                } else {
                    assertThat(answers).as("single answer at row %d", row.rowNumber()).hasSize(1);
                }
            }
        }
    }

    @Test
    void mergedRegionsStayInsidePartAndGroupBoundaries() throws Exception {
        try (Workbook workbook = workbook()) {
            Sheet sheet = workbook.getSheet(TEMPLATE_SHEET);
            List<Scope> partScopes = scopes(sheet, PART_COLUMN);
            List<Scope> groupScopes = scopes(sheet, GROUP_COLUMN);
            List<CellRangeAddress> regions = sheet.getMergedRegions();

            assertThat(partScopes).hasSize(9);
            assertThat(groupScopes).hasSize(19);
            assertThat(regions).hasSize(89);
            assertThat(regions).allSatisfy(region ->
                    assertThat(region.getFirstColumn()).isEqualTo(region.getLastColumn()));

            Map<Integer, Long> mergeCounts = regions.stream().collect(
                    Collectors.groupingBy(CellRangeAddress::getFirstColumn, Collectors.counting()));
            assertThat(mergeCounts)
                    .containsEntry(0, 7L)
                    .containsEntry(1, 7L)
                    .containsEntry(2, 17L)
                    .containsEntry(4, 17L)
                    .containsEntry(5, 17L)
                    .containsEntry(17, 7L)
                    .containsEntry(18, 17L);

            for (CellRangeAddress region : regions) {
                int firstRow = region.getFirstRow() + 1;
                int lastRow = region.getLastRow() + 1;
                int column = region.getFirstColumn();
                boolean partScoped = column == PART_COLUMN || column == 1 || column == AUDIO_COLUMN;
                List<Scope> candidateScopes = partScoped ? partScopes : groupScopes;
                if (!partScoped) {
                    assertThat(column).isIn(GROUP_COLUMN, 4, GROUP_CONTEXT_COLUMN, GROUP_MEDIA_COLUMN);
                }

                Scope expected = scopeAt(candidateScopes, firstRow);
                assertThat(expected).as("scope for merged region %s", region.formatAsString()).isNotNull();
                assertThat(firstRow).as("merge start %s", region.formatAsString())
                        .isEqualTo(expected.firstRow());
                assertThat(lastRow).as("merge end %s", region.formatAsString())
                        .isEqualTo(expected.lastRow());
            }
        }
    }

    @Test
    void unicodeMediaAndSourceContentAreUnchanged() throws Exception {
        try (Workbook workbook = workbook()) {
            Sheet sheet = workbook.getSheet(TEMPLATE_SHEET);
            List<QuestionRow> rows = questionRows(sheet);
            String allText = allText(workbook);

            assertThat(allText)
                    .doesNotContain("\uFFFD", "dongan.signs", "nhận chấm 35k")
                    .contains("Kākāpō", "kākāpō", "Full giải thích", "Người nói", "Tây Ban Nha");

            List<String> urls = urls(allText);
            assertThat(urls).containsExactlyInAnyOrderElementsOf(
                    java.util.stream.Stream.concat(AUDIO_URLS.stream(), IMAGE_URLS.stream()).toList());
            assertThat(urls).doesNotHaveDuplicates();
            assertThat(urls).allMatch(url -> url.startsWith("https://res.cloudinary.com/j5on4xwq/"));

            assertThat(rows.stream().map(QuestionRow::audioUrl)
                            .filter(url -> !url.isBlank()).distinct().toList())
                    .containsExactlyElementsOf(AUDIO_URLS);
            assertThat(rows.stream().map(QuestionRow::groupContext)
                            .flatMap(context -> imageUrls(context).stream()).distinct().toList())
                    .containsExactlyElementsOf(IMAGE_URLS);
            assertThat(rows.stream().map(QuestionRow::groupMediaUrl).filter(url -> !url.isBlank()).toList()).isEmpty();
            assertThat(rows.stream().map(QuestionRow::questionMediaUrl).filter(url -> !url.isBlank()).toList()).isEmpty();
        }
    }

    @Test
    void writingExplanationsAreGuidanceNotModelAnswers() throws Exception {
        try (Workbook workbook = workbook()) {
            List<QuestionRow> essays = questionRows(workbook.getSheet(TEMPLATE_SHEET)).stream()
                    .filter(row -> "WRITING_ESSAY".equals(row.type()))
                    .toList();

            assertThat(essays).extracting(QuestionRow::canonicalId).containsExactly("w_001", "w_002");
            assertThat(essays).allSatisfy(row -> {
                assertThat(row.answer()).isBlank();
                assertThat(row.explanation()).contains("[EN]").contains("[VI]");
                assertThat(row.explanation()).doesNotContainIgnoringCase("model answer");
            });
            assertThat(essays.get(0).prompt()).contains("The first table below shows changes");
            assertThat(essays.get(0).explanation()).contains("high-scoring Task 1 response must");
            assertThat(essays.get(1).prompt()).contains("Access to clean water is a basic human right");
            assertThat(essays.get(1).explanation()).contains("band 8+ Task 2 essay should");
        }
    }

    private Workbook workbook() throws Exception {
        return WorkbookFactory.create(new ByteArrayInputStream(resourceBytes()));
    }

    private byte[] resourceBytes() throws Exception {
        try (InputStream input = getClass().getResourceAsStream(RESOURCE)) {
            assertThat(input).as("test workbook resource %s", RESOURCE).isNotNull();
            return input.readAllBytes();
        }
    }

    private List<String> headers(Sheet sheet) {
        List<String> headers = new ArrayList<>();
        for (Cell cell : sheet.getRow(0)) headers.add(text(cell));
        return headers;
    }

    private Map<String, String> metadata(Sheet sheet) {
        Map<String, String> metadata = new LinkedHashMap<>();
        for (Row row : sheet) {
            String key = text(row.getCell(0));
            if (!key.isBlank()) metadata.put(key, text(row.getCell(1)));
        }
        return metadata;
    }

    private void assertNoFormulaOrErrorCells(Workbook workbook) {
        for (Sheet sheet : workbook) {
            for (Row row : sheet) {
                for (Cell cell : row) {
                    assertThat(cell.getCellType())
                            .as("cell %s!%s", sheet.getSheetName(), cell.getAddress())
                            .isNotIn(CellType.FORMULA, CellType.ERROR);
                }
            }
        }
    }

    private List<QuestionRow> questionRows(Sheet sheet) {
        List<QuestionRow> rows = new ArrayList<>();
        int sourcePart = 0;
        String group = "";
        int listeningOrdinal = 0;
        int readingOrdinal = 0;
        int writingOrdinal = 0;

        for (int rowNumber = FIRST_QUESTION_ROW; rowNumber <= LAST_QUESTION_ROW; rowNumber++) {
            Row row = sheet.getRow(rowNumber - 1);
            if (row == null) throw new AssertionError("Missing workbook row " + rowNumber);

            String partMarker = text(row.getCell(PART_COLUMN));
            if (!partMarker.isBlank()) sourcePart = partNumber(partMarker);
            String groupMarker = text(row.getCell(GROUP_COLUMN));
            if (!groupMarker.isBlank()) group = groupMarker;
            if (sourcePart == 0) throw new AssertionError("Question row before part marker: " + rowNumber);

            String canonicalId;
            if (sourcePart <= 4) {
                canonicalId = "l_%03d".formatted(++listeningOrdinal);
            } else if (sourcePart <= 7) {
                canonicalId = "r_%03d".formatted(++readingOrdinal);
            } else {
                canonicalId = "w_%03d".formatted(++writingOrdinal);
            }

            rows.add(new QuestionRow(
                    rowNumber,
                    sourcePart,
                    group,
                    text(row.getCell(3)),
                    text(row.getCell(QUESTION_COLUMN)),
                    options(row),
                    mergedText(sheet, rowNumber, ANSWER_COLUMN),
                    mergedText(sheet, rowNumber, EXPLANATION_COLUMN),
                    mergedText(sheet, rowNumber, AUDIO_COLUMN),
                    mergedText(sheet, rowNumber, GROUP_CONTEXT_COLUMN),
                    mergedText(sheet, rowNumber, GROUP_MEDIA_COLUMN),
                    mergedText(sheet, rowNumber, QUESTION_MEDIA_COLUMN),
                    canonicalId));
        }
        return rows;
    }

    private Map<String, String> options(Row row) {
        Map<String, String> options = new LinkedHashMap<>();
        for (int index = 0; index < 8; index++) {
            String value = text(row.getCell(OPTION_COLUMN + index));
            if (!value.isBlank()) options.put(String.valueOf((char) ('A' + index)), value);
        }
        return options;
    }

    private String partLabel(Sheet sheet, int rowNumber) {
        return text(sheet.getRow(rowNumber - 1).getCell(PART_COLUMN));
    }

    private int partNumber(String label) {
        Matcher matcher = PART.matcher(label.trim());
        if (!matcher.find()) throw new AssertionError("Invalid part label: " + label);
        return Integer.parseInt(matcher.group(1));
    }

    private List<Scope> scopes(Sheet sheet, int column) {
        List<Scope> scopes = new ArrayList<>();
        int firstRow = -1;
        for (int rowNumber = FIRST_QUESTION_ROW; rowNumber <= LAST_QUESTION_ROW; rowNumber++) {
            Row row = sheet.getRow(rowNumber - 1);
            String value = row == null ? "" : text(row.getCell(column));
            if (!value.isBlank()) {
                if (firstRow > 0) scopes.add(new Scope(firstRow, rowNumber - 1));
                firstRow = rowNumber;
            }
        }
        if (firstRow > 0) scopes.add(new Scope(firstRow, LAST_QUESTION_ROW));
        return scopes;
    }

    private Scope scopeAt(List<Scope> scopes, int rowNumber) {
        return scopes.stream()
                .filter(scope -> scope.firstRow() <= rowNumber && rowNumber <= scope.lastRow())
                .findFirst()
                .orElse(null);
    }

    private QuestionRow byId(List<QuestionRow> rows, String canonicalId) {
        return rows.stream()
                .filter(row -> canonicalId.equals(row.canonicalId()))
                .findFirst()
                .orElseThrow();
    }

    private List<String> answerTokens(String rawAnswer) {
        if (rawAnswer == null || rawAnswer.isBlank()) return List.of();
        return Arrays.stream(rawAnswer.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .toList();
    }

    private List<String> imageUrls(String html) {
        List<String> urls = new ArrayList<>();
        Matcher matcher = IMAGE.matcher(html);
        while (matcher.find()) urls.add(matcher.group(1));
        return urls;
    }

    private List<String> urls(String text) {
        List<String> urls = new ArrayList<>();
        Matcher matcher = URL.matcher(text);
        while (matcher.find()) urls.add(matcher.group());
        return urls;
    }

    private String allText(Workbook workbook) {
        StringBuilder text = new StringBuilder();
        for (Sheet sheet : workbook) {
            for (Row row : sheet) {
                for (Cell cell : row) text.append(text(cell)).append('\n');
            }
        }
        return text.toString();
    }

    private String mergedText(Sheet sheet, int rowNumber, int column) {
        int rowIndex = rowNumber - 1;
        int columnIndex = column;
        for (CellRangeAddress region : sheet.getMergedRegions()) {
            if (region.isInRange(rowIndex, columnIndex)) {
                rowIndex = region.getFirstRow();
                columnIndex = region.getFirstColumn();
                break;
            }
        }
        Row row = sheet.getRow(rowIndex);
        return row == null ? "" : text(row.getCell(columnIndex));
    }

    private String text(Cell cell) {
        return cell == null ? "" : FORMATTER.formatCellValue(cell).trim();
    }

    private String sha256(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    private record Scope(int firstRow, int lastRow) {
    }

    private record QuestionRow(
            int rowNumber,
            int sourcePart,
            String group,
            String type,
            String prompt,
            Map<String, String> options,
            String answer,
            String explanation,
            String audioUrl,
            String groupContext,
            String groupMediaUrl,
            String questionMediaUrl,
            String canonicalId) {
    }
}
