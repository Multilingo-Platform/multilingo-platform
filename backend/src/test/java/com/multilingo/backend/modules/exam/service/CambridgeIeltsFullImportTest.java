package com.multilingo.backend.modules.exam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import com.multilingo.backend.modules.exam.dto.request.PartBuilderRequest;
import com.multilingo.backend.modules.exam.dto.response.ExamImportPreviewResponse;
import com.multilingo.backend.modules.exam.dto.response.ExamImportPreviewResponse.Issue;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.FormulaError;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.ss.util.CellRangeAddress;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Imports the reviewed full Cambridge IELTS 20 Test 1 V2 workbook through the public parser path.
 *
 * <p>The fixture is the same byte-copy locked by CIP-01. These tests prove the parser uses the
 * declared Reading passage labels, canonical part IDs, merged media scopes and the V2 profile,
 * while keeping the legacy source correction bound to the legacy hash.</p>
 */
class CambridgeIeltsFullImportTest {
    private static final String RESOURCE =
            "/datasets/official-source/cambridge-ielts-20-test-1-full.v2.xlsx";
    private static final String TEMPLATE_SHEET = "Exam Template";
    private static final String SOURCE_HASH = OfficialExamSourceProfile.CAMBRIDGE_IELTS_20_V2_SHA256;

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

    private final ExamParserService parser = new ExamParserService(new ObjectMapper());

    @Test
    void previewsFullV2SourceWithoutIssuesAndWithCanonicalCounts() throws Exception {
        ExamImportPreviewResponse preview = preview(resourceBytes());

        assertThat(preview.sourceSha256()).isEqualTo(SOURCE_HASH);
        assertThat(preview.counts()).isEqualTo(new ExamImportPreviewResponse.Counts(9, 19, 82));
        assertThat(preview.issues()).isEmpty();
        assertThat(preview.canPublish()).isTrue();

        ExamBuilderRequest request = preview.request();
        assertThat(request.getTitle()).isEqualTo("Cambridge Ielts 20 Test 1");
        assertThat(request.getType()).isEqualTo("IELTS_ACADEMIC");
        assertThat(request.getExamLanguage()).isEqualTo("en");
        assertThat(request.isPublished()).isFalse();
        assertThat(request.getSections()).extracting(section -> section.getSkillType())
                .containsExactly("LISTENING", "READING", "WRITING");
        assertThat(request.getSections()).extracting(section -> section.getDurationMinutes())
                .containsExactly(30, 60, 60);
        assertThat(request.getSections().stream().mapToInt(section -> section.getParts().size()).sum())
                .isEqualTo(9);

        List<Map<String, Object>> questions = questions(request);
        assertThat(questions).hasSize(82);
        assertThat(questions).extracting(question -> question.get("question_id"))
                .containsExactlyElementsOf(expectedQuestionIds());
        assertThat(questions).filteredOn(question -> "ESSAY".equals(question.get("type"))).hasSize(2);
        assertThat(questions).filteredOn(question -> !"ESSAY".equals(question.get("type"))).hasSize(80);
        assertThat(questions).allSatisfy(question ->
                assertThat(String.valueOf(question.get("explanation"))).as("explanation of %s",
                        question.get("question_id")).isNotBlank());
        assertThat(questions).filteredOn(question -> "ESSAY".equals(question.get("type")))
                .allSatisfy(question -> {
                    assertThat(question).doesNotContainKey("correct_answer");
                    assertThat(String.valueOf(question.get("explanation")))
                            .contains("[EN]").contains("[VI]");
                });

        assertThat(questions).filteredOn(question -> question.containsKey("answer_group")).hasSize(10);
        Map<String, Object> firstPair = question(request, "l_017");
        assertThat(firstPair).containsEntry("type", "SINGLE_CHOICE");
        assertThat(firstPair.get("correct_answer")).isEqualTo(List.of("A", "E"));
        assertThat(firstPair.get("answer_group")).isEqualTo(Map.of(
                "id", "listening-17-18",
                "mode", "DISTINCT_UNORDERED",
                "question_ids", List.of("l_017", "l_018")));
        assertThat(question(request, "l_018").get("answer_group"))
                .isEqualTo(firstPair.get("answer_group"));
        assertThat(questions.stream().filter(question -> question.containsKey("answer_group"))
                .map(question -> String.valueOf(((Map<?, ?>) question.get("answer_group")).get("id")))
                .distinct().toList())
                .containsExactly("listening-17-18", "listening-19-20", "listening-21-22",
                        "listening-23-24", "listening-25-26");
        assertThat(questions.stream().filter(question -> question.containsKey("answer_group"))
                .map(question -> question.get("correct_answer")).toList())
                .containsExactly(List.of("A", "E"), List.of("A", "E"),
                        List.of("C", "E"), List.of("C", "E"), List.of("C", "E"), List.of("C", "E"),
                        List.of("A", "C"), List.of("A", "C"), List.of("A", "B"), List.of("A", "B"));

        assertThat(part(request, "READING", 5).getContentData().get("content_html").toString())
                .contains("The kākāpō")
                .doesNotContain("Bring elms to Britain", "How stress affects our judgement");
        assertThat(part(request, "READING", 6).getContentData().get("content_html").toString())
                .contains("Bring elms to Britain")
                .doesNotContain("The kākāpō", "How stress affects our judgement", "dongan.signs");
        assertThat(part(request, "READING", 7).getContentData().get("content_html").toString())
                .contains("How stress affects our judgement")
                .doesNotContain("The kākāpō", "Bring elms to Britain");

        assertThat(mediaUrls(request)).containsExactlyInAnyOrderElementsOf(
                java.util.stream.Stream.concat(AUDIO_URLS.stream(), IMAGE_URLS.stream()).toList())
                .doesNotHaveDuplicates();

        Map<String, Object> writingGroup = group(request, "w_001");
        assertThat(writingGroup.get("shared_media")).isInstanceOf(Map.class);
        assertThat(String.valueOf(writingGroup.get("content_html"))).doesNotContain("<img");
    }

    @Test
    void keepsLegacyElmsCorrectionBoundToTheLegacyHash() {
        OfficialExamSourceProfile legacy =
                OfficialExamSourceProfile.forSha256(OfficialExamSourceProfile.CAMBRIDGE_IELTS_20_SHA256);
        OfficialExamSourceProfile full = OfficialExamSourceProfile.forSha256(SOURCE_HASH);

        assertThat(legacy.isCambridgeIelts20V1()).isTrue();
        assertThat(legacy.verifiedCambridgeElmsPassage()).isPresent();
        assertThat(full.isCambridgeIelts20V2()).isTrue();
        assertThat(full.verifiedCambridgeElmsPassage()).isEmpty();
        assertThat(full.normalizeCambridgeTitle("Cambridge Ielts 20 Test 1 (Full giải thích)"))
                .isEqualTo("Cambridge Ielts 20 Test 1");
    }

    @Test
    void deduplicatesMergedGroupMediaAndRejectsDifferentMediaInSameScope() throws Exception {
        assertThat(preview(resourceBytes()).issues())
                .extracting(Issue::code)
                .doesNotContain("MEDIA_DUPLICATE", "MEDIA_CONFLICT");

        try (Workbook workbook = workbook()) {
            Sheet sheet = workbook.getSheet(TEMPLATE_SHEET);
            removeGroupMediaMerge(sheet, 18, 11, 16);
            setCell(sheet, 11, 18, IMAGE_URLS.get(0));
            setCell(sheet, 12, 18, IMAGE_URLS.get(1));

            ExamImportPreviewResponse parsed = new IeltsExcelV2ExamParser().parse(workbook, SOURCE_HASH);

            assertThat(parsed.issues()).anySatisfy(issue -> {
                assertThat(issue.code()).isEqualTo("MEDIA_CONFLICT");
                assertThat(issue.cell()).isEqualTo("S13");
            });
            Map<String, Object> group = group(parsed.request(), "l_012");
            assertThat(((Map<?, ?>) group.get("shared_media")).get("url")).isEqualTo(IMAGE_URLS.get(0));
        }
    }

    @Test
    void rejectsMissingHeadersFormulaCellsAndErrorCells() throws Exception {
        try (Workbook workbook = workbook()) {
            workbook.getSheet(TEMPLATE_SHEET).getRow(0).getCell(15).setCellValue("");
            assertThatThrownBy(() -> new IeltsExcelV2ExamParser().parse(workbook, SOURCE_HASH))
                    .isInstanceOf(AppException.class);
        }
        try (Workbook workbook = workbook()) {
            workbook.getSheet(TEMPLATE_SHEET).getRow(1).getCell(6).setCellFormula("1+1");
            assertThatThrownBy(() -> new IeltsExcelV2ExamParser().parse(workbook, SOURCE_HASH))
                    .isInstanceOf(AppException.class);
        }
        try (Workbook workbook = workbook()) {
            workbook.getSheet(TEMPLATE_SHEET).getRow(1).getCell(6)
                    .setCellErrorValue(FormulaError.VALUE.getCode());
            assertThatThrownBy(() -> new IeltsExcelV2ExamParser().parse(workbook, SOURCE_HASH))
                    .isInstanceOf(AppException.class);
        }
    }

    private ExamImportPreviewResponse preview(byte[] bytes) {
        return parser.previewExamFile(new MockMultipartFile("file", "Cambridge.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes));
    }

    private byte[] resourceBytes() throws Exception {
        try (InputStream input = getClass().getResourceAsStream(RESOURCE)) {
            assertThat(input).as("source fixture %s", RESOURCE).isNotNull();
            return input.readAllBytes();
        }
    }

    private Workbook workbook() throws Exception {
        return WorkbookFactory.create(new ByteArrayInputStream(resourceBytes()));
    }

    private void removeGroupMediaMerge(Sheet sheet, int column, int firstRow, int lastRow) {
        for (int index = 0; index < sheet.getNumMergedRegions(); index++) {
            CellRangeAddress region = sheet.getMergedRegion(index);
            if (region.getFirstColumn() == column && region.getFirstRow() <= firstRow
                    && region.getLastRow() >= lastRow) {
                sheet.removeMergedRegion(index);
                return;
            }
        }
        throw new AssertionError("Expected merged group media region at column " + column);
    }

    private void setCell(Sheet sheet, int rowIndex, int column, String value) {
        Row row = sheet.getRow(rowIndex);
        Cell cell = row.getCell(column);
        if (cell == null) cell = row.createCell(column);
        cell.setCellValue(value);
    }

    private List<String> expectedQuestionIds() {
        return java.util.stream.Stream.of(
                        IntStream.rangeClosed(1, 40).mapToObj(value -> "l_%03d".formatted(value)),
                        IntStream.rangeClosed(1, 40).mapToObj(value -> "r_%03d".formatted(value)),
                        IntStream.rangeClosed(1, 2).mapToObj(value -> "w_%03d".formatted(value)))
                .flatMap(stream -> stream).toList();
    }

    private List<Map<String, Object>> questions(ExamBuilderRequest request) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (var section : request.getSections()) {
            for (PartBuilderRequest part : section.getParts()) {
                Object rawGroups = part.getContentData().get("question_groups");
                if (!(rawGroups instanceof List<?> groups)) continue;
                for (Object rawGroup : groups) {
                    if (rawGroup instanceof Map<?, ?> group && group.get("questions") instanceof List<?> groupQuestions) {
                        for (Object rawQuestion : groupQuestions) {
                            if (rawQuestion instanceof Map<?, ?> question) result.add(cast(question));
                        }
                    }
                }
            }
        }
        return result;
    }

    private Map<String, Object> question(ExamBuilderRequest request, String questionId) {
        return questions(request).stream().filter(question -> questionId.equals(question.get("question_id")))
                .findFirst().orElseThrow();
    }

    private Map<String, Object> group(ExamBuilderRequest request, String questionId) {
        for (var section : request.getSections()) {
            for (PartBuilderRequest part : section.getParts()) {
                Object rawGroups = part.getContentData().get("question_groups");
                if (!(rawGroups instanceof List<?> groups)) continue;
                for (Object rawGroup : groups) {
                    if (!(rawGroup instanceof Map<?, ?> group) || !(group.get("questions") instanceof List<?> questions)) continue;
                    if (questions.stream().anyMatch(rawQuestion -> rawQuestion instanceof Map<?, ?> question
                            && questionId.equals(question.get("question_id")))) return cast(group);
                }
            }
        }
        throw new IllegalArgumentException("Question not found: " + questionId);
    }

    private PartBuilderRequest part(ExamBuilderRequest request, String skill, int number) {
        return request.getSections().stream().filter(section -> skill.equals(section.getSkillType()))
                .flatMap(section -> section.getParts().stream())
                .filter(part -> number == part.getPartNumber()).findFirst().orElseThrow();
    }

    private List<String> mediaUrls(ExamBuilderRequest request) {
        List<String> urls = new ArrayList<>();
        for (var section : request.getSections()) {
            for (PartBuilderRequest part : section.getParts()) {
                addMedia(urls, part.getContentData().get("shared_audio"));
                Object rawGroups = part.getContentData().get("question_groups");
                if (!(rawGroups instanceof List<?> groups)) continue;
                for (Object rawGroup : groups) {
                    if (!(rawGroup instanceof Map<?, ?> group)) continue;
                    addMedia(urls, group.get("shared_media"));
                    if (!(group.get("questions") instanceof List<?> questions)) continue;
                    for (Object rawQuestion : questions) {
                        if (rawQuestion instanceof Map<?, ?> question) addMedia(urls, question.get("media"));
                    }
                }
            }
        }
        return urls;
    }

    private void addMedia(List<String> urls, Object rawMedia) {
        if (rawMedia instanceof Map<?, ?> media && media.get("url") instanceof String url) urls.add(url);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> cast(Map<?, ?> value) {
        return (Map<String, Object>) value;
    }
}
