package com.multilingo.backend.modules.exam.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamSummaryResponse {
    private Integer id;
    private String code;
    private String title;
    private String type;
    private Boolean isPublished;
    private Integer durationMinutes;
    private Instant updatedAt;
    
    // Additional metrics for frontend
    private int parts;
    private int questions;
    private int joins;
}
