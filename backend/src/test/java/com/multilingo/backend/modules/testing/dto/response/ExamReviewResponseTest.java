package com.multilingo.backend.modules.testing.dto.response;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ExamReviewResponseTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void testExamReviewResponseSerializationAndBackwardCompatibility() throws Exception {
        ReviewOptionDto optionA = ReviewOptionDto.builder()
                .id("A")
                .text("Option A text")
                .content("Option A text")
                .isCorrect(true)
                .build();

        ReviewOptionDto optionB = ReviewOptionDto.builder()
                .id("B")
                .text("Option B text")
                .content("Option B text")
                .isCorrect(false)
                .build();

        ReviewQuestionDto question = ReviewQuestionDto.builder()
                .questionId("q_1")
                .type("SINGLE_CHOICE")
                .questionText("Question 1 text")
                .prompt("Choose the best answer")
                .label("Question 1")
                .explanation("<p>Explanation for Q1</p>")
                .correctAnswer("A")
                .userAnswer("A")
                .verdict("CORRECT")
                .score(BigDecimal.ONE)
                .options(List.of(optionA, optionB))
                .build();

        ReviewQuestionGroupDto group = ReviewQuestionGroupDto.builder()
                .groupId("grp_1")
                .instruction("Group 1 instruction")
                .contentHtml("<p>Passage</p>")
                .questions(List.of(question))
                .build();

        ReviewPartStatsDto stats = ReviewPartStatsDto.builder()
                .score(new BigDecimal("1.00"))
                .correctCount(1)
                .incorrectCount(0)
                .unansweredCount(0)
                .totalQuestions(1)
                .accuracy(new BigDecimal("100.00"))
                .isCorrectFlags(Map.of("q_1", true))
                .build();

        ExamReviewPartDataDto partData = ExamReviewPartDataDto.builder()
                .id(101)
                .partNumber(1)
                .title("Part 1")
                .partTitle("Part 1: Reading")
                .skill("READING")
                .instruction("Read carefully")
                .contentHtml("<p>Passage</p>")
                .questionGroups(List.of(group))
                .questions(List.of(question))
                .build();

        ExamReviewResponse response = ExamReviewResponse.builder()
                .attemptId(42)
                .partId(101)
                .partTitle("Part 1: Reading")
                .skill("READING")
                .partStats(stats)
                .userAnswers(Map.of("q_1", "A"))
                .questions(List.of(question))
                .questionGroups(List.of(group))
                .examData(partData)
                .partResult(Map.of("score", 1.0, "correctCount", 1, "totalQuestions", 1))
                .isCorrectFlags(Map.of("q_1", true))
                .build();

        String json = objectMapper.writeValueAsString(response);

        // Verify JSON contains key attributes
        assertThat(json).contains("\"attemptId\":42");
        assertThat(json).contains("\"partId\":101");
        assertThat(json).contains("\"partTitle\":\"Part 1: Reading\"");
        assertThat(json).contains("\"skill\":\"READING\"");
        assertThat(json).contains("\"explanation\":\"<p>Explanation for Q1</p>\"");
        assertThat(json).contains("\"correctAnswer\":\"A\"");
        assertThat(json).contains("\"userAnswer\":\"A\"");
        assertThat(json).contains("\"verdict\":\"CORRECT\"");
        assertThat(json).contains("\"isCorrect\":true");

        // Verify deserialization back to object
        ExamReviewResponse deserialized = objectMapper.readValue(json, ExamReviewResponse.class);
        assertThat(deserialized.getAttemptId()).isEqualTo(42);
        assertThat(deserialized.getPartId()).isEqualTo(101);
        assertThat(deserialized.getQuestions()).hasSize(1);
        ReviewQuestionDto desQ = deserialized.getQuestions().get(0);
        assertThat(desQ.getQuestionId()).isEqualTo("q_1");
        assertThat(desQ.getVerdict()).isEqualTo("CORRECT");
        assertThat(desQ.getExplanation()).isEqualTo("<p>Explanation for Q1</p>");
        assertThat(desQ.getOptions()).hasSize(2);
        assertThat(desQ.getOptions().get(0).getIsCorrect()).isTrue();
    }

    @Test
    void testQuestionAndOptionAliases() {
        ReviewOptionDto opt = ReviewOptionDto.builder()
                .id("A")
                .text("Test Text")
                .build();
        assertThat(opt.getContent()).isEqualTo("Test Text");

        ReviewQuestionDto q = ReviewQuestionDto.builder()
                .questionId("q_99")
                .questionText("Question prompt text")
                .build();
        assertThat(q.getId()).isEqualTo("q_99");
        assertThat(q.getContent()).isEqualTo("Question prompt text");
    }
}
