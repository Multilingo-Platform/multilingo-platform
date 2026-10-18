package com.multilingo.backend.modules.exam.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class IeltsAcademicPublicationValidatorTest {
    private final IeltsAcademicPublicationValidator validator = new IeltsAcademicPublicationValidator();

    @Test
    void ordinaryIeltsAcademicExamDoesNotUseTheCambridgeOfficialDatasetProfile() {
        ExamBuilderRequest request = ExamBuilderRequest.builder()
                .title("IELTS Academic classroom practice")
                .type("IELTS_ACADEMIC")
                .examLanguage("en")
                .isPublished(false)
                .sections(java.util.List.of())
                .build();
        ExamPublicationValidator publicationValidator = new ExamPublicationValidator();

        assertThatCode(() -> publicationValidator.requireStructure(request)).doesNotThrowAnyException();
        assertThatCode(() -> publicationValidator.requirePublishable(request)).doesNotThrowAnyException();
    }

    @Test
    void enforcesRegisteredGroupCountPerPartEvenWhenGlobalCountIsUnchanged() {
        ExamBuilderRequest request = OfficialExamTestData.ieltsRequest();
        var partOne = request.getSections().getFirst().getParts().getFirst();
        @SuppressWarnings("unchecked")
        var partOneGroups = (java.util.List<java.util.Map<String, Object>>) (java.util.List<?>) partOne.getContentData()
                .get("question_groups");
        var splitGroup = partOneGroups.getFirst();
        @SuppressWarnings("unchecked")
        var splitQuestions = (java.util.List<java.util.Map<String, Object>>) (java.util.List<?>) splitGroup.get("questions");
        var movedQuestions = new java.util.ArrayList<>(splitQuestions.subList(1, splitQuestions.size()));
        splitQuestions.subList(1, splitQuestions.size()).clear();
        var extraGroup = new java.util.LinkedHashMap<String, Object>(splitGroup);
        extraGroup.put("group_id", "ielts-p1-g-extra");
        extraGroup.put("questions", movedQuestions);
        partOneGroups.add(1, extraGroup);

        var partTwo = request.getSections().getFirst().getParts().get(1);
        @SuppressWarnings("unchecked")
        var partTwoGroups = (java.util.List<java.util.Map<String, Object>>) (java.util.List<?>) partTwo.getContentData()
                .get("question_groups");
        var removedGroup = partTwoGroups.removeLast();
        @SuppressWarnings("unchecked")
        var destinationQuestions = (java.util.List<java.util.Map<String, Object>>) (java.util.List<?>) partTwoGroups
                .getLast().get("questions");
        @SuppressWarnings("unchecked")
        var removedQuestions = (java.util.List<java.util.Map<String, Object>>) (java.util.List<?>) removedGroup.get("questions");
        destinationQuestions.addAll(removedQuestions);

        assertThat(validator.issues(request)).extracting(issue -> issue.code()).contains("GROUP_COUNT_INVALID");
        assertThatThrownBy(() -> validator.requirePublishable(request)).isInstanceOf(AppException.class);
    }

    @Test
    void allowsPartialExplanationsWhenTheCanonicalDatasetIsOtherwiseComplete() {
        ExamBuilderRequest request = OfficialExamTestData.ieltsRequest();
        assertThat(validator.issues(request)).isEmpty();
        validator.requirePublishable(request);
    }

    @Test
    void rejectsTheKnownUnverifiedTextRatherThanPublishingItAsPassageContent() {
        ExamBuilderRequest request = OfficialExamTestData.ieltsRequest();
        request.getSections().get(1).getParts().get(0).getContentData()
                .put("content_html", "Verified passage thread: dongan.signs inserted note");

        assertThat(validator.issues(request)).anySatisfy(issue ->
                assertThat(issue.code()).isEqualTo("SOURCE_CONTENT_UNVERIFIED"));
        assertThatThrownBy(() -> validator.requirePublishable(request)).isInstanceOf(AppException.class);
    }

    @Test
    void rejectsMissingPassageInvalidAnswerAndMalformedAnswerGroup() {
        ExamBuilderRequest request = OfficialExamTestData.ieltsRequest();
        request.getSections().get(1).getParts().get(0).getContentData().put("content_html", "");
        OfficialExamTestData.questions(request).stream().filter(question -> "l_001".equals(question.get("question_id")))
                .findFirst().orElseThrow().put("correct_answer", "Z");
        OfficialExamTestData.questions(request).stream().filter(question -> "l_018".equals(question.get("question_id")))
                .findFirst().orElseThrow().put("answer_group", Map.of("id", "wrong", "mode", "DISTINCT_UNORDERED",
                        "question_ids", java.util.List.of("l_017", "l_020")));

        assertThat(validator.issues(request)).extracting(issue -> issue.code())
                .contains("CONTEXT_REQUIRED", "ANSWER_INVALID", "ANSWER_GROUP_INVALID");
    }

    @Test
    void rejectsNonCanonicalChoiceTypeAndMultiAnswerOnAnIndependentQuestion() {
        ExamBuilderRequest request = OfficialExamTestData.ieltsRequest();
        var questions = OfficialExamTestData.questions(request);
        questions.stream().filter(question -> "r_001".equals(question.get("question_id")))
                .findFirst().orElseThrow().put("type", "MULTIPLE_CHOICE");
        questions.stream().filter(question -> "r_002".equals(question.get("question_id")))
                .findFirst().orElseThrow().put("correct_answer", java.util.List.of("A", "B"));

        assertThat(validator.issues(request)).extracting(issue -> issue.code())
                .contains("QUESTION_TYPE_INVALID", "ANSWER_INVALID");
    }

    @Test
    void rejectsBlankFillInAlternatives() {
        ExamBuilderRequest request = OfficialExamTestData.ieltsRequest();
        var question = OfficialExamTestData.questions(request).stream()
                .filter(item -> "r_001".equals(item.get("question_id"))).findFirst().orElseThrow();
        question.put("type", "FILL_IN_THE_BLANK");
        question.put("correct_answer", java.util.List.of("", "verified"));

        assertThat(validator.issues(request)).anySatisfy(issue -> {
            assertThat(issue.code()).isEqualTo("ANSWER_INVALID");
            assertThat(issue.questionId()).isEqualTo("r_001");
        });
    }
}
