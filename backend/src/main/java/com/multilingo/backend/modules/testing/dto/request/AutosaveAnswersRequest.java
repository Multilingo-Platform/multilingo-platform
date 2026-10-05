package com.multilingo.backend.modules.testing.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AutosaveAnswersRequest {

    @NotNull(message = "version is required")
    private Integer version;

    @NotNull(message = "answers list is required")
    private List<PartAnswerDto> answers;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PartAnswerDto {
        @NotNull(message = "partId is required")
        @JsonAlias({"part_id", "partId"})
        @JsonProperty("part_id")
        private Integer partId;

        @JsonAlias({"answers"})
        private List<QuestionAnswerDto> answers;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuestionAnswerDto {
        @NotNull(message = "questionId is required")
        @JsonAlias({"question_id", "questionId"})
        @JsonProperty("question_id")
        private String questionId;

        private Object answer;
    }
}
