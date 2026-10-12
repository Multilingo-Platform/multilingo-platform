package com.multilingo.backend.modules.testing.dto.response;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class ReviewQuestionDto {
    @JsonAlias({"id"})
    private String questionId;
    private String type;
    @JsonAlias({"content"})
    private String questionText;
    private String prompt;
    private String label;
    private String explanation;
    private Object correctAnswer;
    private Object userAnswer;
    private String verdict;
    private BigDecimal score;
    private List<ReviewOptionDto> options;
    private Map<String, Object> media;

    public String getId() {
        return questionId;
    }

    public void setId(String id) {
        if (this.questionId == null) {
            this.questionId = id;
        }
    }

    public String getContent() {
        return questionText != null ? questionText : prompt;
    }

    public void setContent(String content) {
        if (this.questionText == null) {
            this.questionText = content;
        }
    }

    public BigDecimal getEarnedScore() {
        return score;
    }

    public void setEarnedScore(BigDecimal earnedScore) {
        this.score = earnedScore;
    }

    public Boolean getIsCorrect() {
        if ("CORRECT".equalsIgnoreCase(verdict)) return true;
        if ("WRONG".equalsIgnoreCase(verdict)) return false;
        return null;
    }
}
