package com.multilingo.backend.modules.testing.dto.response;

import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubmitResultResponse {
    private Integer attemptId;
    private AttemptStatus status;
    private String redirectUrl;

    public static SubmitResultResponse from(Integer attemptId, AttemptStatus status) {
        return SubmitResultResponse.builder()
                .attemptId(attemptId)
                .status(status)
                .redirectUrl("/attempts/" + attemptId + "/result")
                .build();
    }
}
