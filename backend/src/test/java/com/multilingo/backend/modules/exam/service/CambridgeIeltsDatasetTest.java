package com.multilingo.backend.modules.exam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import com.multilingo.backend.modules.exam.dto.response.ExamDatasetBundle;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class CambridgeIeltsDatasetTest {
    private static final String SOURCE =
            "/datasets/official-source/cambridge-ielts-20-test-1-full.v2.xlsx";
    private static final String RUNTIME =
            "/datasets/exams/cambridge-ielts-20-test-1.v2.json";
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void runtimeBundleMatchesValidatedCanonicalSourceAndHasNoPublicAnswerLeak() throws Exception {
        ExamDatasetBundle sourceBundle = ExamDatasetBundle.exportForCode(parseSource(),
                "IELTS-CAMBRIDGE-20-T1-V2");
        sourceBundle.validate();

        try (InputStream input = getClass().getResourceAsStream(RUNTIME)) {
            assertThat(input).as("Cambridge IELTS V2 runtime bundle").isNotNull();
            ExamDatasetBundle runtimeBundle = objectMapper.readValue(input, ExamDatasetBundle.class);
            runtimeBundle.validate();
            assertThat(runtimeBundle.schemaVersion()).isEqualTo(2);
            assertThat(runtimeBundle.datasetKey()).isEqualTo(OfficialExamDatasetRegistry.CAMBRIDGE_IELTS_KEY);
            assertThat(runtimeBundle.version()).isEqualTo(2);
            assertThat(runtimeBundle.examCode()).isEqualTo("IELTS-CAMBRIDGE-20-T1-V2");
            assertThat(runtimeBundle.checksum()).isEqualTo(sourceBundle.checksum());
            assertThat(runtimeBundle.source().approvalReference())
                    .isEqualTo("OWNER_RIGHTS_CONFIRMED_CHAT_2026-10-19");
            assertThat(runtimeBundle.additionalSources()).isEmpty();

            List<Map<String, Object>> questions = questions(runtimeBundle.request());
            assertThat(questions).hasSize(82);
            assertThat(questions).extracting(question -> question.get("question_id"))
                    .containsExactlyElementsOf(expectedIds());
            assertThat(questions).allSatisfy(question ->
                    assertThat(String.valueOf(question.get("explanation"))).isNotBlank());

            String json = objectMapper.writeValueAsString(runtimeBundle);
            assertThat(json).doesNotContain("metadata.options", "sectionId", "partId", "attemptId", "token",
                    "ANSWER-KEY-DERIVED CLUES", "dongan.signs");
            assertThat(json).doesNotContain("<img");
        }
    }

    @Test
    void runtimeBundleKeepsOnlyStructuredMediaReferencesFromAuditedSource() throws Exception {
        ExamDatasetBundle bundle;
        try (InputStream input = getClass().getResourceAsStream(RUNTIME)) {
            assertThat(input).isNotNull();
            bundle = objectMapper.readValue(input, ExamDatasetBundle.class);
        }
        bundle.validate();

        List<String> audio = new ArrayList<>();
        List<String> images = new ArrayList<>();
        for (var section : bundle.request().getSections()) {
            for (var part : section.getParts()) {
                collectMedia(part.getContentData(), audio, images);
            }
        }
        assertThat(audio).hasSize(4).allMatch(ExcelV2ExamParser::safeUrl);
        assertThat(images).hasSize(4).allMatch(ExcelV2ExamParser::safeUrl);
        assertThat(images).allMatch(url -> url.contains("res.cloudinary.com"));
    }

    private ExamBuilderRequest parseSource() throws Exception {
        try (InputStream input = getClass().getResourceAsStream(SOURCE)) {
            assertThat(input).as("Cambridge IELTS V2 source fixture").isNotNull();
            return new ExamParserService(objectMapper).parseExamFile(new MockMultipartFile("file",
                    "Cambridge_Ielts_20_Test_1_(Full_giai_thich).xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", input.readAllBytes()));
        }
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> questions(ExamBuilderRequest request) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (var section : request.getSections()) for (var part : section.getParts()) {
            Object rawGroups = part.getContentData().get("question_groups");
            if (!(rawGroups instanceof List<?> groups)) continue;
            for (Object rawGroup : groups) if (rawGroup instanceof Map<?, ?> group
                    && group.get("questions") instanceof List<?> items)
                for (Object rawQuestion : items) if (rawQuestion instanceof Map<?, ?> question)
                    result.add((Map<String, Object>) question);
        }
        return result;
    }

    private static List<String> expectedIds() {
        List<String> ids = new ArrayList<>();
        for (int index = 1; index <= 40; index++) ids.add(String.format("l_%03d", index));
        for (int index = 1; index <= 40; index++) ids.add(String.format("r_%03d", index));
        ids.add("w_001");
        ids.add("w_002");
        return ids;
    }

    @SuppressWarnings("unchecked")
    private static void collectMedia(Map<String, Object> contentData, List<String> audio, List<String> images) {
        Object rawAudio = contentData.get("shared_audio");
        if (rawAudio instanceof Map<?, ?> media && media.get("url") instanceof String value) audio.add(value);
        Object rawGroups = contentData.get("question_groups");
        if (!(rawGroups instanceof List<?> groups)) return;
        for (Object rawGroup : groups) if (rawGroup instanceof Map<?, ?> group) {
            Object rawMedia = group.get("shared_media");
            if (rawMedia instanceof Map<?, ?> media && media.get("url") instanceof String value) images.add(value);
            Object rawQuestions = group.get("questions");
            if (!(rawQuestions instanceof List<?> questions)) continue;
            for (Object rawQuestion : questions) if (rawQuestion instanceof Map<?, ?> question
                    && question.get("media") instanceof Map<?, ?> media
                    && media.get("url") instanceof String value) images.add(value);
        }
    }
}
