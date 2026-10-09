package com.multilingo.backend.modules.exam.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentExamSummaryResponse {
    private Integer id;
    private String code;
    private String title;
    private String type;
    private String level;
    private Integer durationMinutes;
    private Integer joins;
    private List<String> tags;
    private String thumbnailUrl;
}
