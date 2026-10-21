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
                .isInstanceOf(RuntimeException.class);

        for (int partNumber : List.of(1, 2, 3, 4)) {
            var part = request.getSections().stream().flatMap(section -> section.getParts().stream())
                    .filter(candidate -> candidate.getPartNumber() == partNumber).findFirst().orElseThrow();
            part.getContentData().put("shared_audio", Map.of("url", "https://media.example/nltv-part-" + partNumber + ".mp3"));
        }
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
