package com.multilingo.backend.modules.exam.service;

import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import com.multilingo.backend.modules.exam.dto.request.PartBuilderRequest;
import com.multilingo.backend.modules.exam.dto.request.SectionBuilderRequest;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ExamContentNormalizerTest {
    @Test
    void normalizesIeltsLegacyOptionsAtTheBuilderBoundaryWithoutChangingAnswerSemantics() {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("options", List.of("North", "South"));
        metadata.put("correct_answer", "B");
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("question_id", "r_001");
        question.put("type", "SINGLE_CHOICE");
        question.put("metadata", metadata);
        ExamBuilderRequest source = ieltsRequest(Map.of("question_groups", List.of(Map.of(
                "group_id", "ielts-p5-g1", "questions", List.of(question)))));

        ExamBuilderRequest normalized = new ExamContentNormalizer().normalize(source);
        Map<String, Object> normalizedQuestion = question(normalized);

        assertThat(normalized).isNotSameAs(source);
        assertThat(normalizedQuestion).containsEntry("type", "SINGLE_CHOICE")
                .containsEntry("correct_answer", "B")
                .containsEntry("options", List.of(
                        Map.of("id", "A", "text", "North"), Map.of("id", "B", "text", "South")));
        assertThat(normalizedQuestion).doesNotContainKey("metadata");
        assertThat(question).containsKey("metadata");
    }

    @Test
    void preservesPairedAnswerMetadataAndCanonicalIeltsTypes() {
        Map<String, Object> pair = Map.of("id", "listening-17-18", "mode", "DISTINCT_UNORDERED",
                "question_ids", List.of("l_017", "l_018"));
        Map<String, Object> first = new LinkedHashMap<>(Map.of("question_id", "l_017", "type", "SINGLE_CHOICE",
                "correct_answer", List.of("A", "E"), "answer_group", pair,
                "options", List.of(Map.of("id", "A", "text", "one"), Map.of("id", "E", "text", "five"))));
        Map<String, Object> second = new LinkedHashMap<>(Map.of("question_id", "l_018", "type", "SINGLE_CHOICE",
                "correct_answer", List.of("A", "E"), "answer_group", pair,
                "options", List.of(Map.of("id", "A", "text", "one"), Map.of("id", "E", "text", "five"))));
        ExamBuilderRequest source = ieltsRequest(Map.of("question_groups", List.of(Map.of(
                "group_id", "ielts-p2-g4", "questions", List.of(first, second)))));

        ExamBuilderRequest normalized = new ExamContentNormalizer().normalize(source);
        List<Map<String, Object>> normalizedQuestions = questions(normalized);

        assertThat(normalizedQuestions).extracting(question -> question.get("type"))
                .containsExactly("SINGLE_CHOICE", "SINGLE_CHOICE");
        assertThat(normalizedQuestions).extracting(question -> question.get("answer_group"))
                .containsExactly(pair, pair);
        assertThat(normalizedQuestions).extracting(question -> question.get("correct_answer"))
                .containsExactly(List.of("A", "E"), List.of("A", "E"));
    }

    private static ExamBuilderRequest ieltsRequest(Map<String, Object> partContent) {
        return ExamBuilderRequest.builder().title("IELTS").type("IELTS_ACADEMIC").examLanguage("en")
                .sections(new ArrayList<>(List.of(SectionBuilderRequest.builder().skillType("READING")
                        .durationMinutes(60).parts(new ArrayList<>(List.of(PartBuilderRequest.builder()
                                .partNumber(5).contentData(new LinkedHashMap<>(partContent)).build()))).build())))
                .build();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> question(ExamBuilderRequest request) {
        return questions(request).get(0);
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> questions(ExamBuilderRequest request) {
        Map<String, Object> content = request.getSections().getFirst().getParts().getFirst().getContentData();
        List<?> groups = (List<?>) content.get("question_groups");
        Map<?, ?> group = (Map<?, ?>) groups.getFirst();
        return (List<Map<String, Object>>) group.get("questions");
    }
}
