package com.multilingo.backend.modules.analytics.adapter.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamSummaryInfo {
    private Integer id;
    private String title;
    private String code;
    private String type;
    private Boolean isPublished;
}
