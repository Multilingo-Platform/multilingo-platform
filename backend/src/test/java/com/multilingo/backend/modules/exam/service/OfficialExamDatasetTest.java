package com.multilingo.backend.modules.exam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import com.multilingo.backend.modules.exam.dto.request.PartBuilderRequest;
import com.multilingo.backend.modules.exam.dto.response.ExamDatasetBundle;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.HashSet;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OfficialExamDatasetTest {
    private static final String IELTS_RESOURCE = "/datasets/official-source/cambridge-ielts-20-test-1.xlsx";
    private static final String TOEIC_RESOURCE = "/datasets/official-source/ets-2024-test-1-completed.xlsx";
    private final ExamParserService parser = new ExamParserService(new ObjectMapper());

    @Test
    void parsesCanonicalCountsAndAuditsMediaReferencesWithoutMarkingThemApproved() throws Exception {
        ExamBuilderRequest ielts = parse(IELTS_RESOURCE, "Cambridge.xlsx");
        ExamBuilderRequest toeic = parse(TOEIC_RESOURCE, "ETS_completed.xlsx");

        assertThat(questions(ielts)).hasSize(82);
        assertThat(questions(toeic)).hasSize(200);
        assertThat(mediaUrls(ielts, "shared_audio")).hasSize(4);
        assertThat(mediaUrls(toeic, "shared_audio")).hasSize(4);
        assertThat(mediaUrls(ielts, "shared_media", "media")).hasSize(4);
        assertThat(mediaUrls(toeic, "shared_media", "media")).hasSize(11);

        List<Object> toeicContent = contentData(toeic);
        List<String> toeicStrings = strings(toeicContent);
        assertThat(toeicStrings).doesNotContain("44");
        assertThat(toeicStrings).noneMatch(value -> value.contains("ANSWER-KEY-DERIVED CLUES"));
        assertThat(hasKey(toeicContent, "metadata.options")).isFalse();
        assertThat(mediaUrls(ielts, "shared_audio")).allMatch(ExcelV2ExamParser::safeUrl);
        assertThat(mediaUrls(toeic, "shared_audio")).allMatch(ExcelV2ExamParser::safeUrl);
        assertThat(mediaUrls(ielts, "shared_media", "media")).allMatch(ExcelV2ExamParser::safeUrl);
        assertThat(mediaUrls(toeic, "shared_media", "media")).allMatch(ExcelV2ExamParser::safeUrl);

        assertThatThrownBy(() -> ExamDatasetBundle.exportOfficial(toeic,
                OfficialExamDatasetRegistry.ETS_TOEIC_KEY, null))
                .isInstanceOf(AppException.class);
    }

    @Test
    void contaminatedCambridgeSourceCannotProduceAnOfficialBundle() throws Exception {
        ExamBuilderRequest ielts = parse(IELTS_RESOURCE, "Cambridge.xlsx");

        assertThat(new IeltsAcademicPublicationValidator().issues(ielts))
                .extracting(issue -> issue.code())
                .contains("SOURCE_CONTENT_UNVERIFIED");
        assertThatThrownBy(() -> ExamDatasetBundle.exportOfficial(ielts,
                OfficialExamDatasetRegistry.CAMBRIDGE_IELTS_KEY, 1, null))
                .isInstanceOf(AppException.class);
    }

    private ExamBuilderRequest parse(String resource, String filename) throws Exception {
        try (InputStream input = getClass().getResourceAsStream(resource)) {
            assertThat(input).as("workbook fixture %s", resource).isNotNull();
            return parser.parseExamFile(new MockMultipartFile("file", filename,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", input.readAllBytes()));
        }
    }

    private List<Map<String, Object>> questions(ExamBuilderRequest request) {
        List<Map<String, Object>> result = new ArrayList<>();
        request.getSections().stream().flatMap(section -> section.getParts().stream())
                .forEach(part -> collectQuestions(part.getContentData(), result));
        return result;
    }

    private List<Object> contentData(ExamBuilderRequest request) {
        return request.getSections().stream().flatMap(section -> section.getParts().stream())
                .map(part -> (Object) part.getContentData()).toList();
    }

    private void collectQuestions(Object value, List<Map<String, Object>> result) {
        if (value instanceof Map<?, ?> map) {
            if (map.get("question_id") instanceof String) {
                @SuppressWarnings("unchecked") Map<String, Object> question = (Map<String, Object>) map;
                result.add(question);
                return;
            }
            map.values().forEach(child -> collectQuestions(child, result));
        } else if (value instanceof Iterable<?> iterable) {
            iterable.forEach(child -> collectQuestions(child, result));
        }
    }

    private Set<String> mediaUrls(ExamBuilderRequest request, String... mediaKeys) {
        Set<String> keys = Set.of(mediaKeys);
        Set<String> urls = new HashSet<>();
        request.getSections().stream().flatMap(section -> section.getParts().stream())
                .forEach(part -> collectMedia(part.getContentData(), keys, urls));
        return urls;
    }

    private void collectMedia(Object value, Set<String> mediaKeys, Set<String> urls) {
        if (value instanceof Map<?, ?> map) {
            for (var entry : map.entrySet()) {
                if (mediaKeys.contains(entry.getKey()) && entry.getValue() instanceof Map<?, ?> media
                        && media.get("url") instanceof String url) urls.add(url);
                collectMedia(entry.getValue(), mediaKeys, urls);
            }
        } else if (value instanceof Iterable<?> iterable) {
            iterable.forEach(child -> collectMedia(child, mediaKeys, urls));
        }
    }

    private List<String> strings(Object value) {
        List<String> result = new ArrayList<>();
        collectStrings(value, result);
        return result;
    }

    private void collectStrings(Object value, List<String> result) {
        if (value instanceof String text) result.add(text);
        else if (value instanceof Map<?, ?> map) map.forEach((key, child) -> {
            result.add(String.valueOf(key));
            collectStrings(child, result);
        });
        else if (value instanceof Iterable<?> iterable) iterable.forEach(child -> collectStrings(child, result));
    }

    private boolean hasKey(Object value, String key) {
        if (value instanceof Map<?, ?> map) {
            if (map.containsKey(key)) return true;
            return map.values().stream().anyMatch(child -> hasKey(child, key));
        }
        if (value instanceof Iterable<?> iterable) {
            for (Object child : iterable) if (hasKey(child, key)) return true;
        }
        return false;
    }
}
