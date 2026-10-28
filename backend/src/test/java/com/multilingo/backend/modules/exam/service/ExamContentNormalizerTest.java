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

    @Test
    void normalizesLanguagePracticeLanguageWithoutMutatingCanonicalContent() {
        Map<String, Object> content = new LinkedHashMap<>(Map.of("question_groups", List.of(Map.of(
                "group_id", "ja-g1", "questions", List.of(Map.of("question_id", "ja-1"))))));
        ExamBuilderRequest source = ExamBuilderRequest.builder().title("日本語")
                .type("LANGUAGE_PRACTICE").examLanguage("jpn-JP")
                .sections(List.of(SectionBuilderRequest.builder().skillType("READING").durationMinutes(20)
                        .parts(List.of(PartBuilderRequest.builder().partNumber(1).contentData(content).build())).build()))
                .build();

        ExamBuilderRequest normalized = new ExamContentNormalizer().normalize(source);

        assertThat(normalized).isNotSameAs(source);
        assertThat(normalized.getExamLanguage()).isEqualTo("ja-JP");
        assertThat(normalized.getSections().getFirst().getParts().getFirst().getContentData())
                .isEqualTo(content);
        assertThat(source.getExamLanguage()).isEqualTo("jpn-JP");
    }

    @Test
    void normalizesLanguagePracticeWritingEssayToCanonicalEssayAndLiftsAlternates() {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("alternates", List.of("cafe", "café shop"));
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("question_id", "w_001");
        question.put("type", "WRITING_ESSAY");
        question.put("metadata", metadata);

        ExamBuilderRequest source = ExamBuilderRequest.builder()
                .title("Practice")
                .type("LANGUAGE_PRACTICE")
                .examLanguage("fr")
                .sections(new ArrayList<>(List.of(SectionBuilderRequest.builder()
                        .skillType("WRITING")
                        .durationMinutes(30)
                        .parts(new ArrayList<>(List.of(PartBuilderRequest.builder()
                                .partNumber(1)
                                .contentData(new LinkedHashMap<>(Map.of("question_groups", List.of(Map.of(
                                        "group_id", "g1", "questions", List.of(question))))))
                                .build())))
                        .build())))
                .build();

        ExamBuilderRequest normalized = new ExamContentNormalizer().normalize(source);
        Map<String, Object> normalizedQuestion = question(normalized);

        assertThat(normalizedQuestion).containsEntry("type", "ESSAY");
        assertThat(normalizedQuestion).containsEntry("alternates", List.of("cafe", "café shop"));
        assertThat(normalizedQuestion).doesNotContainKey("metadata");
    }

    @Test
    void normalizesOnlyNltvSingleAnswerMultipleChoiceWithoutMutatingSource() {
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("question_id", "q_001");
        question.put("type", "MULTIPLE_CHOICE");
        question.put("question_text", "Chọn đáp án đúng.");
        question.put("options", List.of("Đáp án A", "Đáp án B", "Đáp án C"));
        question.put("correct_answer", "B");
        Map<String, Object> sourceGroup = new LinkedHashMap<>();
        sourceGroup.put("group_id", "nltv-p1-g1");
        sourceGroup.put("questions", new ArrayList<>(List.of(question)));
        Map<String, Object> content = new LinkedHashMap<>();
        content.put("question_groups", new ArrayList<>(List.of(sourceGroup)));
        ExamBuilderRequest source = ExamBuilderRequest.builder().type("NLTV").examLanguage("vi")
                .sections(new ArrayList<>(List.of(SectionBuilderRequest.builder().skillType("LISTENING")
                        .durationMinutes(60).parts(new ArrayList<>(List.of(PartBuilderRequest.builder()
                                .partNumber(1).contentData(content).build()))).build()))).build();

        ExamBuilderRequest normalized = new ExamContentNormalizer().normalize(source);
        Map<String, Object> result = question(normalized);

        assertThat(normalized).isNotSameAs(source);
        assertThat(result).containsEntry("type", "SINGLE_CHOICE").containsEntry("correct_answer", "B")
                .containsEntry("options", List.of(Map.of("id", "A", "text", "Đáp án A"),
                        Map.of("id", "B", "text", "Đáp án B"), Map.of("id", "C", "text", "Đáp án C")));
        assertThat(question).containsEntry("type", "MULTIPLE_CHOICE").containsEntry("options",
                List.of("Đáp án A", "Đáp án B", "Đáp án C"));
    }

    @Test
    void normalizesNonCanonicalQuestionTypesToCanonicalUppercase() {
        Map<String, Object> q1 = new LinkedHashMap<>();
        q1.put("question_id", "q_1");
        q1.put("type", "essay");

        Map<String, Object> q2 = new LinkedHashMap<>();
        q2.put("question_id", "q_2");
        q2.put("type", " ESSAY ");

        Map<String, Object> q3 = new LinkedHashMap<>();
        q3.put("question_id", "q_3");
        q3.put("type", "single_choice");

        Map<String, Object> q4 = new LinkedHashMap<>();
        q4.put("question_id", "q_4");
        q4.put("type", " fill_in_the_blank ");

        ExamBuilderRequest source = ExamBuilderRequest.builder()
                .title("Practice")
                .type("LANGUAGE_PRACTICE")
                .examLanguage("ja")
                .sections(new ArrayList<>(List.of(SectionBuilderRequest.builder()
                        .skillType("READING")
                        .durationMinutes(30)
                        .parts(new ArrayList<>(List.of(PartBuilderRequest.builder()
                                .partNumber(1)
                                .contentData(new LinkedHashMap<>(Map.of("question_groups", List.of(Map.of(
                                        "group_id", "g1", "questions", List.of(q1, q2, q3, q4))))))
                                .build())))
                        .build())))
                .build();

        ExamBuilderRequest normalized = new ExamContentNormalizer().normalize(source);
        List<Map<String, Object>> normalizedQs = questions(normalized);

        assertThat(normalizedQs.get(0)).containsEntry("type", "ESSAY");
        assertThat(normalizedQs.get(1)).containsEntry("type", "ESSAY");
        assertThat(normalizedQs.get(2)).containsEntry("type", "SINGLE_CHOICE");
        assertThat(normalizedQs.get(3)).containsEntry("type", "FILL_IN_THE_BLANK");
    }

    @Test
    void normalizesContentHtmlImageToSharedMediaWhenSharedMediaIsAbsent() {
        Map<String, Object> group = new LinkedHashMap<>();
        group.put("group_id", "nltv-p8-g1");
        group.put("content_html", "<p>Viết thư theo ảnh minh họa:</p><p><img src=\"https://media.example/letter-prompt.png\" alt=\"prompt\" /></p>");
        group.put("questions", List.of(Map.of("question_id", "q_001", "type", "WRITING_ESSAY")));

        ExamBuilderRequest source = ExamBuilderRequest.builder()
                .title("NLTV").type("NLTV").examLanguage("vi")
                .sections(new ArrayList<>(List.of(SectionBuilderRequest.builder().skillType("WRITING")
                        .durationMinutes(60).parts(new ArrayList<>(List.of(PartBuilderRequest.builder()
                                .partNumber(8).contentData(new LinkedHashMap<>(Map.of("question_groups", List.of(group)))).build()))).build())))
                .build();

        ExamBuilderRequest normalized = new ExamContentNormalizer().normalize(source);
        Map<String, Object> normalizedContent = normalized.getSections().getFirst().getParts().getFirst().getContentData();
        List<?> groups = (List<?>) normalizedContent.get("question_groups");
        @SuppressWarnings("unchecked")
        Map<String, Object> normalizedGroup = (Map<String, Object>) groups.getFirst();

        assertThat(normalizedGroup).containsKey("shared_media");
        @SuppressWarnings("unchecked")
        Map<String, Object> sharedMedia = (Map<String, Object>) normalizedGroup.get("shared_media");
        assertThat(sharedMedia)
                .containsEntry("type", "image")
                .containsEntry("url", "https://media.example/letter-prompt.png");
    }

    @Test
    void normalizesNltvPartEightWithoutImageAndCleansBlankMediaAndCorrectAnswer() {
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("question_id", "q_001");
        question.put("type", "WRITING_ESSAY");
        question.put("correct_answer", "");
        question.put("options", List.of());
        question.put("media", Map.of("type", "image", "url", ""));

        Map<String, Object> group = new LinkedHashMap<>();
        group.put("group_id", "nltv-p8-g1");
        group.put("content_html", "<p>Viết một bức thư...</p>");
        group.put("shared_media", Map.of("type", "image", "url", ""));
        group.put("questions", List.of(question));

        ExamBuilderRequest source = ExamBuilderRequest.builder()
                .title("NLTV").type("NLTV").examLanguage("vi")
                .sections(new ArrayList<>(List.of(SectionBuilderRequest.builder().skillType("WRITING")
                        .durationMinutes(60).parts(new ArrayList<>(List.of(PartBuilderRequest.builder()
                                .partNumber(8).contentData(new LinkedHashMap<>(Map.of("question_groups", List.of(group)))).build()))).build())))
                .build();

        ExamBuilderRequest normalized = new ExamContentNormalizer().normalize(source);
        Map<String, Object> normalizedContent = normalized.getSections().getFirst().getParts().getFirst().getContentData();
        List<?> groups = (List<?>) normalizedContent.get("question_groups");
        @SuppressWarnings("unchecked")
        Map<String, Object> normalizedGroup = (Map<String, Object>) groups.getFirst();

        assertThat(normalizedGroup).doesNotContainKey("shared_media");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> questions = (List<Map<String, Object>>) normalizedGroup.get("questions");
        Map<String, Object> normalizedQ = questions.getFirst();

        assertThat(normalizedQ.get("type")).isEqualTo("ESSAY");
        assertThat(normalizedQ).doesNotContainKey("correct_answer");
        assertThat(normalizedQ).doesNotContainKey("options");
        assertThat(normalizedQ).doesNotContainKey("media");
        assertThat(normalizedQ.get("min_words")).isEqualTo(120);
    }

    @Test
    void normalizesNltvReadingGroupPassageAndPartSevenDictationMarkers() {
        // Part 5 reading group with blank content_html but part has content_html
        Map<String, Object> readingGroup = new LinkedHashMap<>();
        readingGroup.put("group_id", "nltv-p5-g1");
        readingGroup.put("content_html", "");
        readingGroup.put("questions", List.of(Map.of("question_id", "q_001", "type", "MULTIPLE_CHOICE", "options", List.of("A", "B"), "correct_answer", "A")));
        Map<String, Object> part5Content = new LinkedHashMap<>();
        part5Content.put("content_html", "<p>Đoạn văn đọc hiểu Part 5</p>");
        part5Content.put("question_groups", new ArrayList<>(List.of(readingGroup)));

        // Part 7 dictation with unmasked answer "(1) lớn nhất" in passage
        Map<String, Object> dictationQ = new LinkedHashMap<>();
        dictationQ.put("question_id", "q_001");
        dictationQ.put("type", "FILL_IN_THE_BLANK");
        dictationQ.put("correct_answer", "lớn nhất");
        Map<String, Object> part7Group = new LinkedHashMap<>();
        part7Group.put("group_id", "nltv-p7-g1");
        part7Group.put("content_html", "Việt Nam là nước (1) lớn nhất Đông Nam Á");
        part7Group.put("questions", new ArrayList<>(List.of(dictationQ)));
        Map<String, Object> part7Content = new LinkedHashMap<>();
        part7Content.put("question_groups", new ArrayList<>(List.of(part7Group)));

        ExamBuilderRequest request = ExamBuilderRequest.builder()
                .title("NLTV")
                .type("NLTV")
                .examLanguage("vi")
                .sections(List.of(
                        SectionBuilderRequest.builder().skillType("READING").durationMinutes(60)
                                .parts(List.of(PartBuilderRequest.builder().partNumber(5).contentData(part5Content).build())).build(),
                        SectionBuilderRequest.builder().skillType("WRITING").durationMinutes(60)
                                .parts(List.of(PartBuilderRequest.builder().partNumber(7).contentData(part7Content).build())).build()
                )).build();

        ExamBuilderRequest normalized = new ExamContentNormalizer().normalize(request);

        // Verify Part 5 reading group received the passage
        var normalizedPart5 = normalized.getSections().get(0).getParts().get(0).getContentData();
        @SuppressWarnings("unchecked")
        var p5Groups = (List<Map<String, Object>>) normalizedPart5.get("question_groups");
        assertThat(p5Groups.get(0).get("content_html")).isEqualTo("<p>Đoạn văn đọc hiểu Part 5</p>");

        // Verify Part 7 dictation passage is masked with (1) ____
        var normalizedPart7 = normalized.getSections().get(1).getParts().get(0).getContentData();
        @SuppressWarnings("unchecked")
        var p7Groups = (List<Map<String, Object>>) normalizedPart7.get("question_groups");
        assertThat(p7Groups.get(0).get("content_html")).isEqualTo("Việt Nam là nước (1) ____ Đông Nam Á");
    }

    @Test
    void normalizesPartSevenDictationWithDotMarkersAndHighQuestionId() {
        Map<String, Object> dictationQ = new LinkedHashMap<>();
        dictationQ.put("question_id", "q_071");
        dictationQ.put("type", "FILL_IN_THE_BLANK");
        dictationQ.put("correct_answer", "lớn nhất");

        Map<String, Object> part7Group = new LinkedHashMap<>();
        part7Group.put("group_id", "nltv-p7-g1");
        part7Group.put("content_html", "Hồ Tây là hồ tự nhiên (1) ................ của thành phố Hà Nội.");
        part7Group.put("questions", new ArrayList<>(List.of(dictationQ)));

        Map<String, Object> part7Content = new LinkedHashMap<>();
        part7Content.put("question_groups", new ArrayList<>(List.of(part7Group)));

        ExamBuilderRequest request = ExamBuilderRequest.builder()
                .title("NLTV")
                .type("NLTV")
                .examLanguage("vi")
                .sections(List.of(
                        SectionBuilderRequest.builder().skillType("WRITING").durationMinutes(60)
                                .parts(List.of(PartBuilderRequest.builder().partNumber(7).contentData(part7Content).build())).build()
                )).build();

        ExamBuilderRequest normalized = new ExamContentNormalizer().normalize(request);

        var normalizedPart7 = normalized.getSections().get(0).getParts().get(0).getContentData();
        @SuppressWarnings("unchecked")
        var p7Groups = (List<Map<String, Object>>) normalizedPart7.get("question_groups");
        assertThat(p7Groups.get(0).get("content_html"))
                .isEqualTo("Hồ Tây là hồ tự nhiên (1) ____ của thành phố Hà Nội.");
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
