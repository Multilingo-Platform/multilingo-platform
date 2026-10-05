package com.multilingo.backend.modules.testing.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data
@Builder
public class ExamReviewResponse {
    private Integer attemptId;
    private Integer partId;
    
    // Grading info for this part
    private Map<String, Object> partResult;
    
    // User's answers for this part
    private Map<String, Object> userAnswers;
    
    // The snapshot data of this part
    private Object examData;
}
