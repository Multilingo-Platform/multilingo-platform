package com.multilingo.backend.modules.exam.service;

import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NltvExcelV2ExamParserTest {
    private static final String SOURCE_SHA256 =
            "b93b2d2cf13d8139faeabc133c271deec555f12368125e059fb54e9ce167f224";
    private static final String AUDIO_SOURCE_SHA256 =
            "e155c3b007cd5f51cf5a73f8652e7d7274aa4a4953cf0c552b05c670a3582d13";

    @Test
    void parsesNewFourAudioWorkbookAndNormalizesPartSevenAsWordBankWriting() throws Exception {
        try (InputStream input = getClass().getResourceAsStream(
                "/datasets/official-source/nltv-sample-test-1-audio.v1.xlsx")) {
            byte[] bytes = input.readAllBytes();
            String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
            assertThat(hash).isEqualTo(AUDIO_SOURCE_SHA256);
            try (var workbook = WorkbookFactory.create(new java.io.ByteArrayInputStream(bytes))) {
                var preview = new NltvExcelV2ExamParser().parse(workbook, hash);
                assertThat(preview.canPublish()).isTrue();
                assertThat(preview.counts().questions()).isEqualTo(107);
                var partSeven = preview.request().getSections().get(2).getParts().get(0);
                assertThat(partSeven.getContentData()).doesNotContainKey("shared_audio");
                assertThat(partSeven.getContentData().get("instruction").toString())
                        .contains("Chọn từ").doesNotContain("chính tả");
                var group = groups(partSeven.getContentData()).getFirst();
                assertThat(group.get("instruction").toString()).contains("Đọc đoạn văn", "Các từ để chọn")
                        .doesNotContain("Nghe");
                assertThat(group.get("content_html").toString())
                        .contains("(1) ____", "(10) ____").doesNotContain("(1) lớn nhất");
                assertThat(preview.request().getSections().getFirst().getParts()).allSatisfy(part ->
                        assertThat(part.getContentData()).containsKey("shared_audio"));
            }
        }
    }

    @Test
    void parsesNltvSourceIntoScopedCanonicalQuestionsAndMasksDictationPassage() throws Exception {
        try (InputStream input = getClass().getResourceAsStream(
                "/datasets/official-source/nltv-sample-test-1.xlsx")) {
            byte[] bytes = input.readAllBytes();
            String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
            try (var workbook = WorkbookFactory.create(new java.io.ByteArrayInputStream(bytes))) {
                NltvExcelV2ExamParser parser = new NltvExcelV2ExamParser();
                assertThat(parser.supports(workbook)).isTrue();

                var preview = parser.parse(workbook, hash);
                var request = preview.request();
                assertThat(request.getType()).isEqualTo("NLTV");
                assertThat(request.getExamLanguage()).isEqualTo("vi");
                assertThat(request.isPublished()).isFalse();
                assertThat(request.getSections()).extracting(section -> section.getSkillType())
                        .containsExactly("LISTENING", "READING", "WRITING");
                assertThat(request.getSections()).extracting(section -> section.getDurationMinutes())
                        .containsExactly(60, 60, 60);

                List<Integer> counts = request.getSections().stream().flatMap(section -> section.getParts().stream())
                        .map(part -> questions(part.getContentData()).size()).toList();
                assertThat(counts).containsExactly(15, 14, 14, 12, 16, 24, 10, 1, 1);
                assertThat(preview.counts().parts()).isEqualTo(9);
                assertThat(preview.counts().groups()).isEqualTo(27);
                assertThat(preview.counts().questions()).isEqualTo(107);

                var dictation = request.getSections().get(2).getParts().get(0);
                String publicPassage = String.valueOf(groups(dictation.getContentData()).get(0).get("content_html"));
                assertThat(publicPassage).contains("(1) ____", "(10) ____").doesNotContain("(1) lớn nhất");
                assertThat(questions(dictation.getContentData())).allSatisfy(question ->
                        assertThat(question.get("correct_answer")).isNotNull());

                var essay = questions(request.getSections().get(2).getParts().get(1).getContentData()).get(0);
                assertThat(essay).containsEntry("type", "ESSAY").containsEntry("min_words", 120)
                        .doesNotContainKey("correct_answer");
                var imageGroup = groups(request.getSections().get(2).getParts().get(1).getContentData()).get(0);
                assertThat(imageGroup.get("content_html").toString()).doesNotContain("<img");
                assertThat(imageGroup.get("shared_media")).isInstanceOf(Map.class);
                assertThat(preview.canPublish()).isFalse();
                assertThat(preview.issues()).anySatisfy(issue -> assertThat(issue.code()).isEqualTo("AUDIO_REQUIRED"));
            }
        }
    }

    @Test
    void refusesUnrecognizedWorkbookChecksumInsteadOfExposingUnmaskedDictationAnswers() throws Exception {
        byte[] altered;
        try (InputStream input = getClass().getResourceAsStream(
                "/datasets/official-source/nltv-sample-test-1.xlsx")) {
            try (var workbook = WorkbookFactory.create(input)) {
                workbook.getSheet("Exam Template").getRow(1).getCell(6).setCellValue("Question 999: edited source");
                var output = new java.io.ByteArrayOutputStream();
                workbook.write(output);
                altered = output.toByteArray();
            }
        }
        String changedHash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(altered));

        assertThatThrownBy(() -> {
            try (var workbook = WorkbookFactory.create(new java.io.ByteArrayInputStream(altered))) {
                new NltvExcelV2ExamParser().parse(workbook, changedHash);
            }
        }).isInstanceOf(RuntimeException.class);
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> questions(Map<String, Object> content) {
        return groups(content).stream()
                .flatMap(group -> ((List<Map<String, Object>>) group.get("questions")).stream()).toList();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> groups(Map<String, Object> content) {
        return (List<Map<String, Object>>) content.get("question_groups");
    }
}
