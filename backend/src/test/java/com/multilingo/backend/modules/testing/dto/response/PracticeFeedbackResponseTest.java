package com.multilingo.backend.modules.testing.dto.response;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.grading.GradingVerdict;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PracticeFeedbackResponseTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("Serializes all allowlisted fields including explicit nulls and numeric score")
    void serialize_allowlistedFields_success() throws Exception {
        PracticeFeedbackResponse response = PracticeFeedbackResponse.builder()
                .attemptId(42)
                .partId(10)
                .questionId("q_1")
                .type("SINGLE_CHOICE")
                .userAnswer("A")
                .verdict(GradingVerdict.CORRECT)
                .score(BigDecimal.valueOf(1))
                .correctAnswer("A")
                .explanation("Lời giải câu q_1")
                .build();

        String json = objectMapper.writeValueAsString(response);
        JsonNode node = objectMapper.readTree(json);

        assertThat(node.get("attemptId").asInt()).isEqualTo(42);
        assertThat(node.get("partId").asInt()).isEqualTo(10);
        assertThat(node.get("questionId").asText()).isEqualTo("q_1");
        assertThat(node.get("type").asText()).isEqualTo("SINGLE_CHOICE");
        assertThat(node.get("userAnswer").asText()).isEqualTo("A");
        assertThat(node.get("verdict").asText()).isEqualTo("CORRECT");
        assertThat(node.get("score").decimalValue()).isEqualByComparingTo("1");
        assertThat(node.get("correctAnswer").asText()).isEqualTo("A");
        assertThat(node.get("explanation").asText()).isEqualTo("Lời giải câu q_1");

        // Verify leak boundary: no disallowed fields
        assertThat(node.has("version")).isFalse();
        assertThat(node.has("questions")).isFalse();
        assertThat(node.has("examData")).isFalse();
        assertThat(node.has("gradingKeys")).isFalse();
        assertThat(node.has("resultSummary")).isFalse();
        assertThat(node.has("isCorrectFlags")).isFalse();
    }

    @Test
    @DisplayName("Explicit nulls for userAnswer and explanation are preserved in JSON output")
    void serialize_explicitNulls_preserved() throws Exception {
        PracticeFeedbackResponse response = PracticeFeedbackResponse.builder()
                .attemptId(42)
                .partId(10)
                .questionId("q_blank")
                .type("SINGLE_CHOICE")
                .userAnswer(null)
                .verdict(GradingVerdict.BLANK)
                .score(BigDecimal.ZERO)
                .correctAnswer("B")
                .explanation(null)
                .build();

        String json = objectMapper.writeValueAsString(response);
        JsonNode node = objectMapper.readTree(json);

        assertThat(node.has("userAnswer")).isTrue();
        assertThat(node.get("userAnswer").isNull()).isTrue();
        assertThat(node.has("explanation")).isTrue();
        assertThat(node.get("explanation").isNull()).isTrue();
        assertThat(node.get("verdict").asText()).isEqualTo("BLANK");
        assertThat(node.get("score").decimalValue()).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("Score greater than 1 for MATCHING partial credit is serialized without truncation")
    void serialize_scoreGreaterThanOne_preserved() throws Exception {
        PracticeFeedbackResponse response = PracticeFeedbackResponse.builder()
                .attemptId(42)
                .partId(10)
                .questionId("q_match")
                .type("MATCHING")
                .userAnswer(Map.of("1", "A", "2", "B"))
                .verdict(GradingVerdict.CORRECT)
                .score(BigDecimal.valueOf(2))
                .correctAnswer(Map.of("1", "A", "2", "B"))
                .explanation("Tất cả cặp đều khớp")
                .build();

        String json = objectMapper.writeValueAsString(response);
        JsonNode node = objectMapper.readTree(json);

        assertThat(node.get("score").decimalValue()).isEqualByComparingTo("2");
        assertThat(node.has("version")).isFalse();
    }
}
