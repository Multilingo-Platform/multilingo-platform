package com.multilingo.backend.modules.exam.service;

import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import com.multilingo.backend.modules.exam.dto.request.PartBuilderRequest;
import com.multilingo.backend.modules.exam.dto.request.SectionBuilderRequest;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class LanguagePracticePublicationValidatorTest {
    private final LanguagePracticePublicationValidator validator = new LanguagePracticePublicationValidator();

    @Test
    void acceptsPublishedReadingPracticeWithExplicitLanguageAndSkill() {
        var request = request("ja-JP", "READING");

        assertThat(validator.issues(request)).isEmpty();
        validator.requirePublishable(request);
    }

    @Test
    void rejectsUnsupportedLanguageSpeakingAndMissingAnswerKey() {
        var unsupportedLanguage = request("it", "READING");
        var speaking = request("ja", "SPEAKING");
        var missingAnswer = request("ja", "READING");
        question(missingAnswer).remove("correct_answer");

        assertThat(validator.issues(unsupportedLanguage)).extracting("code").contains("LANGUAGE_INVALID");
        assertThat(validator.issues(speaking)).extracting("code").contains("SKILL_INVALID");
        assertThat(validator.issues(missingAnswer)).extracting("code").contains("ANSWER_INVALID");
    }

    @Test
    void rejectsMalformedFillInTheBlankAnswerKeys() {
        for (Object invalidKey : List.of("", "   ", List.of(), List.of(""), List.of("valid", "  "), Map.of("key", "val"), 123)) {
            var req = request("en", "READING");
            var q = question(req);
            q.put("type", "FILL_IN_THE_BLANK");
            q.put("correct_answer", invalidKey);
            assertThat(validator.issues(req))
                    .as("Expected ANSWER_INVALID for fill-in key: %s", invalidKey)
                    .extracting("code").contains("ANSWER_INVALID");
        }
    }

    @Test
    void acceptsValidFillInTheBlankAnswerKeys() {
        for (Object validKey : List.of("apple", List.of("apple", "apples"))) {
            var req = request("en", "READING");
            var q = question(req);
            q.put("type", "FILL_IN_THE_BLANK");
            q.put("correct_answer", validKey);
            assertThat(validator.issues(req)).isEmpty();
        }
    }

    @Test
    void validatesTfngAndYnngTokensStrictly() {
        var tfngReq = request("en", "READING");
        var qTfng = question(tfngReq);
        qTfng.put("type", "TRUE_FALSE_NOT_GIVEN");
        qTfng.put("correct_answer", "MAYBE");
        assertThat(validator.issues(tfngReq)).extracting("code").contains("ANSWER_INVALID");

        qTfng.put("correct_answer", "TRUE");
        assertThat(validator.issues(tfngReq)).isEmpty();

        var ynngReq = request("en", "READING");
        var qYnng = question(ynngReq);
        qYnng.put("type", "YES_NO_NOT_GIVEN");
        qYnng.put("correct_answer", "TRUE");
        assertThat(validator.issues(ynngReq)).extracting("code").contains("ANSWER_INVALID");

        qYnng.put("correct_answer", "YES");
        assertThat(validator.issues(ynngReq)).isEmpty();
    }

    @Test
    void validatesMatchingOptionsAndAnswer() {
        var req = request("en", "READING");
        var q = question(req);
        q.put("type", "MATCHING_FEATURES");
        q.put("options", List.of(Map.of("id", "A", "text", "Option A"), Map.of("id", "B", "text", "Option B")));
        q.put("correct_answer", "C"); // not in options
        assertThat(validator.issues(req)).extracting("code").contains("ANSWER_INVALID");

        q.put("correct_answer", "A");
        assertThat(validator.issues(req)).isEmpty();

        q.put("options", List.of()); // empty options
        assertThat(validator.issues(req)).extracting("code").contains("OPTIONS_INVALID");
    }

    @Test
    void rejectsWritingEssayAliasAtPublicationGate() {
        var req = request("en", "WRITING");
        var q = question(req);
        q.put("type", "WRITING_ESSAY");
        q.remove("options");
        q.remove("correct_answer");
        assertThat(validator.issues(req)).extracting("code").contains("TYPE_INVALID");

        q.put("type", "ESSAY");
        assertThat(validator.issues(req)).isEmpty();
    }

    @Test
    void rejectsNonCanonicalCasingAndWhitespaceAtPublicationGate() {
        for (String nonCanonical : List.of("essay", " ESSAY ", "single_choice", "SINGLE_CHOICE ", "fill_in_the_blank", "MULTIPLE_CHOICE_MULTI")) {
            var req = request("en", "READING");
            var q = question(req);
            q.put("type", nonCanonical);
            assertThat(validator.issues(req))
                    .as("Expected TYPE_INVALID for non-canonical type: '%s'", nonCanonical)
                    .extracting("code").contains("TYPE_INVALID");
        }
    }

    private static ExamBuilderRequest request(String language, String skill) {
        return ExamBuilderRequest.builder()
                .title("日本語 読解練習")
                .type("LANGUAGE_PRACTICE")
                .examLanguage(language)
                .isPublished(true)
                .sections(List.of(SectionBuilderRequest.builder()
                        .skillType(skill)
                        .durationMinutes(25)
                        .parts(List.of(PartBuilderRequest.builder()
                                .partNumber(1)
                                .contentData(new java.util.LinkedHashMap<>(Map.of(
                                        "question_groups", List.of(Map.of(
                                                "group_id", "reading-1",
                                                "content_html", "短い文章です。",
                                                "questions", List.of(questionMap()))))))
                                .build()))
                        .build()))
                .build();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> question(ExamBuilderRequest request) {
        var part = request.getSections().get(0).getParts().get(0);
        var groups = (List<Map<String, Object>>) part.getContentData().get("question_groups");
        return (Map<String, Object>) ((List<?>) groups.get(0).get("questions")).get(0);
    }

    private static Map<String, Object> questionMap() {
        return new java.util.LinkedHashMap<>(Map.of(
                "question_id", "ja_001",
                "type", "SINGLE_CHOICE",
                "question_text", "文章について正しいものはどれですか。",
                "options", List.of(Map.of("id", "A", "text", "答え"), Map.of("id", "B", "text", "違う答え")),
                "correct_answer", "A"));
    }
}
