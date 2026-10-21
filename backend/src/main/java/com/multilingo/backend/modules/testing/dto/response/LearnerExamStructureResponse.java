package com.multilingo.backend.modules.testing.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Public exam structure for authenticated learners. No question or grading data. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LearnerExamStructureResponse {
    private Integer id;
    private String code;
    private String title;
    private String type;
    private String examLanguage;
    private Integer durationMinutes;
    private List<Section> sections;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Section {
        private Integer id;
        private String skillType;
        private String title;
        private Integer durationMinutes;
        private Integer orderIndex;
        private List<Part> parts;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Part {
        private Integer id;
        private Integer partNumber;
        private String title;
    }
}
