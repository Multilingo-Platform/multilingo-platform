package com.multilingo.backend.modules.exam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import com.multilingo.backend.modules.exam.dto.request.PartBuilderRequest;
import org.junit.jupiter.api.Test;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

class IeltsExcelV2ExamParserTest {
    private static final String IELTS_RESOURCE = "/datasets/official-source/cambridge-ielts-20-test-1.xlsx";
    private static final String FULL_IELTS_RESOURCE =
            "/datasets/official-source/cambridge-ielts-20-test-1-full.v2.xlsx";
    private static final String TOEIC_RESOURCE = "/datasets/official-source/ets-2024-test-1-completed.xlsx";
    private final ExamParserService parser = new ExamParserService(new ObjectMapper());

    @Test
    void parsesCompletedToeicSourceWithItsReviewedProfile() throws Exception {
        try (InputStream input = getClass().getResourceAsStream(TOEIC_RESOURCE)) {
            assertThat(input).isNotNull();
            byte[] bytes = input.readAllBytes();
            try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
                var parsed = new ExcelV2ExamParser().parse(workbook,
                        OfficialExamSourceProfile.ETS_2024_COMPLETED_SHA256);
                assertThat(parsed.counts()).isEqualTo(new com.multilingo.backend.modules.exam.dto.response.ExamImportPreviewResponse.Counts(7, 50, 200));
            }
        }
    }

    @Test
    void parsesCambridgeWorkbookIntoStableCanonicalIeltsSectionsAndPairedAnswers() throws Exception {
        ExamBuilderRequest request = parse(IELTS_RESOURCE, "Cambridge.xlsx");

        assertThat(request.getTitle()).isEqualTo("Cambridge Ielts 20 Test 1");
        assertThat(request.getType()).isEqualTo("IELTS_ACADEMIC");
        assertThat(request.getExamLanguage()).isEqualTo("en");
        assertThat(request.isPublished()).isFalse();
        assertThat(request.getSections()).extracting(section -> section.getSkillType())
                .containsExactly("LISTENING", "READING", "WRITING");
        assertThat(request.getSections()).extracting(section -> section.getDurationMinutes())
                .containsExactly(30, 60, 60);
        assertThat(request.getSections().stream().mapToInt(section -> section.getParts().size()).sum()).isEqualTo(9);

        List<Map<String, Object>> questions = questions(request);
        assertThat(questions).hasSize(82);
        assertThat(questions).filteredOn(question -> "ESSAY".equals(question.get("type"))).hasSize(2);
        assertThat(questions).filteredOn(question -> !"ESSAY".equals(question.get("type"))).hasSize(80);
        assertThat(questions).extracting(question -> question.get("question_id")).containsExactlyElementsOf(
                java.util.stream.Stream.of(
                        IntStream.rangeClosed(1, 40).mapToObj(i -> "l_%03d".formatted(i)),
                        IntStream.rangeClosed(1, 40).mapToObj(i -> "r_%03d".formatted(i)),
                        IntStream.rangeClosed(1, 2).mapToObj(i -> "w_%03d".formatted(i)))
                        .flatMap(stream -> stream).toList());

        Map<String, Object> firstPair = question(request, "l_017");
        Map<String, Object> secondPair = question(request, "l_018");
        assertThat(firstPair).containsEntry("type", "SINGLE_CHOICE");
        assertThat(firstPair.get("correct_answer")).isEqualTo(List.of("A", "E"));
        assertThat(firstPair.get("answer_group")).isEqualTo(Map.of(
                "id", "listening-17-18",
                "mode", "DISTINCT_UNORDERED",
                "question_ids", List.of("l_017", "l_018")));
        assertThat(secondPair.get("answer_group")).isEqualTo(firstPair.get("answer_group"));
        assertThat(questions).filteredOn(question -> question.containsKey("answer_group")).hasSize(10);

        assertThat(part(request, "READING", 5).getContentData().get("content_html").toString()).contains("Kākāpō");
        String elmsPassage = part(request, "READING", 6).getContentData().get("content_html").toString();
        assertThat(elmsPassage).contains("Bring elms to Britain", "Mark Rowe investigates attempts to reintroduce elms to Britain",
                "Around 25 million elms", "Dutch elm disease", "Cutty Sark", "17,000", "horticultural analogue",
                "a cultivated plant species that is genetically similar to an existing species")
                .doesNotContain("dongan.signs");
        assertThat(part(request, "READING", 7).getContentData().get("content_html").toString()).contains("stress affects");
        assertThat(questions.stream().mapToInt(question -> options(question).size()).max().orElse(0)).isEqualTo(7);
        Map<String, Object> writingGroup = group(request, "w_001");
        assertThat(writingGroup.get("shared_media")).isInstanceOf(Map.class);
        assertThat(String.valueOf(writingGroup.get("content_html"))).doesNotContain("<img");
    }

    @Test
    void mapsReadingByDeclaredPassageLabelsRatherThanTheLegacySourceIndex() throws Exception {
        try (InputStream input = getClass().getResourceAsStream(FULL_IELTS_RESOURCE)) {
            assertThat(input).isNotNull();
            try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(input.readAllBytes()))) {
                var parsed = new IeltsExcelV2ExamParser().parse(workbook, OfficialExamSourceProfile.CAMBRIDGE_IELTS_20_V2_SHA256);

                assertThat(parsed.issues()).isEmpty();
                assertThat(parsed.counts()).isEqualTo(
                        new com.multilingo.backend.modules.exam.dto.response.ExamImportPreviewResponse.Counts(9, 19, 82));
                assertThat(part(parsed.request(), "READING", 5).getContentData())
                        .containsEntry("part_title", "Reading Passage 1");
                assertThat(part(parsed.request(), "READING", 6).getContentData())
                        .containsEntry("part_title", "Reading Passage 2");
                assertThat(part(parsed.request(), "READING", 7).getContentData())
                        .containsEntry("part_title", "Reading Passage 3");
                assertThat(part(parsed.request(), "READING", 5).getContentData().get("content_html").toString())
                        .contains("The kākāpō");
                assertThat(part(parsed.request(), "READING", 6).getContentData().get("content_html").toString())
                        .contains("Bring elms to Britain");
                assertThat(part(parsed.request(), "READING", 7).getContentData().get("content_html").toString())
                        .contains("How stress affects our judgement");
            }
        }
    }

    @Test
    void previewBlocksTheKnownCambridgeSourceAndReportsExactUnverifiedCells() throws Exception {
        try (InputStream input = getClass().getResourceAsStream(IELTS_RESOURCE)) {
            assertThat(input).isNotNull();
            var preview = parser.previewExamFile(new MockMultipartFile("file", "Cambridge.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", input.readAllBytes()));

            assertThat(preview.canPublish()).isFalse();
            assertThat(preview.issues().stream().filter(issue -> "SOURCE_CONTENT_UNVERIFIED".equals(issue.code()))
                    .map(issue -> issue.sheet() + "!" + issue.cell()).toList())
                    .containsExactly("Exam Template!F42", "Exam Template!F46", "Exam Template!F51", "Exam Template!F56");
        }
    }

    @Test
    void doesNotApplyTheElmsCorrectionWhenWorkbookChecksumIsDifferent() throws Exception {
        try (InputStream input = getClass().getResourceAsStream(IELTS_RESOURCE)) {
            assertThat(input).isNotNull();
            try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(input.readAllBytes()))) {
                var parsed = new IeltsExcelV2ExamParser().parse(workbook, "0".repeat(64));
                String elmsPassage = part(parsed.request(), "READING", 6).getContentData().get("content_html").toString();

                assertThat(elmsPassage).contains("dongan.signs", "Bring elms to Britain");
            }
        }
    }

    @Test
    void retainsEighthOptionColumnWhenPresent() throws Exception {
        try (InputStream input = getClass().getResourceAsStream(IELTS_RESOURCE)) {
            assertThat(input).isNotNull();
            try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(input.readAllBytes()))) {
                workbook.getSheet("Exam Template").getRow(1).createCell(14).setCellValue("Option H");
                var parsed = new IeltsExcelV2ExamParser().parse(workbook,
                        OfficialExamSourceProfile.CAMBRIDGE_IELTS_20_SHA256);
                assertThat(options(question(parsed.request(), "l_001")))
                        .contains(Map.of("id", "H", "text", "Option H"));
            }
        }
    }

    @Test
    void appliesEtsPlaceholderAndGroupBoundaryCorrectionsOnlyToTheApprovedSource() throws Exception {
        ExamBuilderRequest request = parse(TOEIC_RESOURCE, "ETS_completed.xlsx");

        assertThat(request.getType()).isEqualTo("TOEIC_LR");
        assertThat(request.getSections()).extracting(section -> section.getSkillType())
                .containsExactly("LISTENING", "READING");
        assertThat(request.getSections()).extracting(section -> section.getDurationMinutes())
                .containsExactly(45, 75);
        assertThat(questions(request)).hasSize(200);
        assertThat(group(request, "q_164").get("group_id")).isEqualTo("toeic-p7-g7");
        assertThat(group(request, "q_165").get("group_id")).isEqualTo("toeic-p7-g8");
        assertThat(group(request, "q_165").get("content_html").toString()).contains("Great Dishwasher");
        assertThat(String.valueOf(group(request, "q_164").get("content_html"))).contains("delectable treat");

        assertThat(questions(request).stream().map(question -> String.valueOf(question.get("question_text")))
                .noneMatch(text -> text.contains("ANSWER-KEY-DERIVED CLUES"))).isTrue();
        assertThat(questions(request).stream()
                .flatMap(question -> options(question).stream())
                .filter(option -> "44".equals(option.get("text")))).isEmpty();

        List<Map<String, Object>> partOneOptions = options(question(request, "q_001"));
        assertThat(partOneOptions).containsExactly(
                Map.of("id", "A", "text", ""), Map.of("id", "B", "text", ""),
                Map.of("id", "C", "text", ""), Map.of("id", "D", "text", ""));
        assertThat(options(question(request, "q_007"))).extracting(option -> option.get("id"))
                .containsExactly("A", "B", "C");
    }

    private ExamBuilderRequest parse(String resource, String filename) throws Exception {
        try (InputStream input = getClass().getResourceAsStream(resource)) {
            assertThat(input).as("source fixture %s", resource).isNotNull();
            return parser.parseExamFile(new MockMultipartFile("file", filename,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", input.readAllBytes()));
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> questions(ExamBuilderRequest request) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (var section : request.getSections()) {
            for (PartBuilderRequest part : section.getParts()) {
                Object rawGroups = part.getContentData().get("question_groups");
                if (!(rawGroups instanceof List<?> groups)) continue;
                for (Object rawGroup : groups) {
                    if (rawGroup instanceof Map<?, ?> group && group.get("questions") instanceof List<?> groupQuestions) {
                        for (Object rawQuestion : groupQuestions) {
                            if (rawQuestion instanceof Map<?, ?> question) result.add((Map<String, Object>) question);
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

    @SuppressWarnings("unchecked")
    private Map<String, Object> group(ExamBuilderRequest request, String questionId) {
        for (var section : request.getSections()) {
            for (PartBuilderRequest part : section.getParts()) {
                Object rawGroups = part.getContentData().get("question_groups");
                if (!(rawGroups instanceof List<?> groups)) continue;
                for (Object rawGroup : groups) {
                    if (!(rawGroup instanceof Map<?, ?> group) || !(group.get("questions") instanceof List<?> groupQuestions)) continue;
                    if (groupQuestions.stream().anyMatch(rawQuestion -> rawQuestion instanceof Map<?, ?> question
                            && questionId.equals(question.get("question_id")))) return (Map<String, Object>) group;
                }
            }
        }
        throw new IllegalArgumentException("Question not found: " + questionId);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> options(Map<String, Object> question) {
        return (List<Map<String, Object>>) question.getOrDefault("options", List.of());
    }

    private PartBuilderRequest part(ExamBuilderRequest request, String skill, int number) {
        return request.getSections().stream().filter(section -> skill.equals(section.getSkillType()))
                .flatMap(section -> section.getParts().stream()).filter(part -> number == part.getPartNumber())
                .findFirst().orElseThrow();
    }
}
