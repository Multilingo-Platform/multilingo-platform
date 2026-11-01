package com.multilingo.backend.modules.exam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import com.multilingo.backend.modules.exam.dto.response.ExamImportPreviewResponse;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NltvPublicationValidatorTest {
    private static final String HASH =
            "b93b2d2cf13d8139faeabc133c271deec555f12368125e059fb54e9ce167f224";

    @Test
    void acceptsDraftShapeButRequiresOnlyFourListeningAudioPartsBeforePublication() throws Exception {
        ExamImportPreviewResponse preview = parseSource();
        ExamBuilderRequest request = preview.request();
        NltvPublicationValidator validator = new NltvPublicationValidator();

        validator.requireStructure(request);
        assertThat(validator.issues(request)).filteredOn(issue -> "AUDIO_REQUIRED".equals(issue.code()))
                .hasSize(4);
        assertThatThrownBy(() -> validator.requirePublishable(request))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Thiếu audio gốc cho Part 1.");

        for (int partNumber : List.of(1, 2, 3, 4)) {
            var part = request.getSections().stream().flatMap(section -> section.getParts().stream())
                    .filter(candidate -> candidate.getPartNumber() == partNumber).findFirst().orElseThrow();
            part.getContentData().put("shared_audio", Map.of("url", "https://media.example/nltv-part-" + partNumber + ".mp3"));
        }
        assertThat(validator.issues(request)).isEmpty();
        validator.requirePublishable(request);
    }

    @Test
    void allowsPublicationWithoutPartEightImage() throws Exception {
        ExamImportPreviewResponse preview = parseSource();
        ExamBuilderRequest request = preview.request();
        NltvPublicationValidator validator = new NltvPublicationValidator();

        for (int partNumber : List.of(1, 2, 3, 4)) {
            var part = request.getSections().stream().flatMap(section -> section.getParts().stream())
                    .filter(candidate -> candidate.getPartNumber() == partNumber).findFirst().orElseThrow();
            part.getContentData().put("shared_audio", Map.of("url", "https://media.example/nltv-part-" + partNumber + ".mp3"));
        }

        // Remove shared_media from Part 8 (Writing Task 1)
        var partEight = request.getSections().get(2).getParts().get(1);
        var groups = (List<Map<String, Object>>) partEight.getContentData().get("question_groups");
        groups.get(0).remove("shared_media");

        assertThat(validator.issues(request)).isEmpty();
        validator.requirePublishable(request);
    }

    @Test
    void allowsPublicationWithDotMarkersInPartSeven() throws Exception {
        ExamImportPreviewResponse preview = parseSource();
        ExamBuilderRequest request = preview.request();
        NltvPublicationValidator validator = new NltvPublicationValidator();

        for (int partNumber : List.of(1, 2, 3, 4)) {
            var part = request.getSections().stream().flatMap(section -> section.getParts().stream())
                    .filter(candidate -> candidate.getPartNumber() == partNumber).findFirst().orElseThrow();
            part.getContentData().put("shared_audio", Map.of("url", "https://media.example/nltv-part-" + partNumber + ".mp3"));
        }

        // Replace (1) ____ with (1) ................ in Part 7
        var partSeven = request.getSections().get(2).getParts().get(0);
        @SuppressWarnings("unchecked")
        var groups = (List<Map<String, Object>>) partSeven.getContentData().get("question_groups");
        String currentHtml = groups.get(0).get("content_html").toString();
        groups.get(0).put("content_html", currentHtml.replace("(1) ____", "(1) ................"));

        assertThat(validator.issues(request)).isEmpty();
        validator.requirePublishable(request);
    }

    @Test
    void rejectsWrongCountAndUnmaskedDictationContent() throws Exception {
        ExamBuilderRequest request = parseSource().request();
        var partSeven = request.getSections().get(2).getParts().get(0);
        var groups = (List<Map<String, Object>>) partSeven.getContentData().get("question_groups");
        groups.get(0).put("content_html", groups.get(0).get("content_html").toString().replace("(1) ____", "(1) lớn nhất"));
        var questions = (List<Map<String, Object>>) groups.get(0).get("questions");
        questions.removeLast();

        var issues = new NltvPublicationValidator().issues(request);
        assertThat(issues).anySatisfy(issue -> assertThat(issue.code()).isEqualTo("SOURCE_COUNTS_INVALID"));
        assertThat(issues).anySatisfy(issue -> assertThat(issue.code()).isEqualTo("ANSWER_KEY_LEAK"));
    }

    @Test
    void rejectsPartSevenWithoutTheSourceWordBank() throws Exception {
        ExamBuilderRequest request = parseSource().request();
        var partSeven = request.getSections().get(2).getParts().get(0);
        var groups = (List<Map<String, Object>>) partSeven.getContentData().get("question_groups");
        groups.getFirst().put("instruction", "Đọc đoạn văn và điền vào chỗ trống.");

        assertThat(new NltvPublicationValidator().issues(request))
                .anySatisfy(issue -> assertThat(issue.code()).isEqualTo("WORD_BANK_INVALID"));
    }

    @Test
    void sharedPublicationGateDelegatesNltvDraftAndPublishChecks() throws Exception {
        ExamBuilderRequest request = parseSource().request();
        ExamPublicationValidator validator = new ExamPublicationValidator();

        validator.requireStructure(request);
        assertThat(validator.issues(request)).filteredOn(issue -> "AUDIO_REQUIRED".equals(issue.code()))
                .hasSize(4);
        assertThatThrownBy(() -> validator.requirePublishable(request))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void acceptsSingleSkillReadingExam() throws Exception {
        ExamBuilderRequest full = parseSource().request();
        ExamBuilderRequest readingOnly = ExamBuilderRequest.builder()
                .title("NLTV Kỹ năng Đọc")
                .type("NLTV")
                .examLanguage("vi")
                .sections(List.of(full.getSections().get(1)))
                .build();
        NltvPublicationValidator validator = new NltvPublicationValidator();
        validator.requireStructure(readingOnly);
        validator.requirePublishable(readingOnly);
    }

    @Test
    void acceptsSingleSkillListeningExam() throws Exception {
        ExamBuilderRequest full = parseSource().request();
        var listeningSection = full.getSections().get(0);
        ExamBuilderRequest listeningOnly = ExamBuilderRequest.builder()
                .title("NLTV Kỹ năng Nghe")
                .type("NLTV")
                .examLanguage("vi")
                .sections(List.of(listeningSection))
                .build();
        NltvPublicationValidator validator = new NltvPublicationValidator();
        validator.requireStructure(listeningOnly);
        assertThat(validator.issues(listeningOnly)).filteredOn(issue -> "AUDIO_REQUIRED".equals(issue.code()))
                .hasSize(4);

        for (int partNumber : List.of(1, 2, 3, 4)) {
            var part = listeningSection.getParts().stream()
                    .filter(candidate -> candidate.getPartNumber() == partNumber).findFirst().orElseThrow();
            part.getContentData().put("shared_audio", Map.of("url", "https://media.example/nltv-part-" + partNumber + ".mp3"));
        }
        validator.requirePublishable(listeningOnly);
    }

    @Test
    void acceptsSingleSkillWritingExam() throws Exception {
        ExamBuilderRequest full = parseSource().request();
        ExamBuilderRequest writingOnly = ExamBuilderRequest.builder()
                .title("NLTV Kỹ năng Viết")
                .type("NLTV")
                .examLanguage("vi")
                .sections(List.of(full.getSections().get(2)))
                .build();
        NltvPublicationValidator validator = new NltvPublicationValidator();
        validator.requireStructure(writingOnly);
        validator.requirePublishable(writingOnly);
    }

    @Test
    void acceptsSinglePartExamAndCustomDuration() throws Exception {
        ExamBuilderRequest full = parseSource().request();
        var readingSection = full.getSections().get(1);
        var partFive = readingSection.getParts().get(0);

        var customSection = com.multilingo.backend.modules.exam.dto.request.SectionBuilderRequest.builder()
                .skillType("READING")
                .durationMinutes(25)
                .parts(List.of(partFive))
                .build();

        ExamBuilderRequest partOnly = ExamBuilderRequest.builder()
                .title("NLTV Đọc - Phần 1")
                .type("NLTV")
                .examLanguage("vi")
                .sections(List.of(customSection))
                .build();

        NltvPublicationValidator validator = new NltvPublicationValidator();
        validator.requireStructure(partOnly);
        validator.requirePublishable(partOnly);
    }


    private ExamImportPreviewResponse parseSource() throws Exception {
        try (InputStream input = getClass().getResourceAsStream(
                "/datasets/official-source/nltv-sample-test-1.xlsx")) {
            byte[] bytes = input.readAllBytes();
            String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
            try (var workbook = WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
                return new NltvExcelV2ExamParser().parse(workbook, hash);
            }
        }
    }
}
