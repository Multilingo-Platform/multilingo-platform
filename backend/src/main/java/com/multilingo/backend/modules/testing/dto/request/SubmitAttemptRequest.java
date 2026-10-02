package com.multilingo.backend.modules.testing.dto.request;

import com.multilingo.backend.modules.testing.entity.enums.SubmitReason;
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
public class SubmitAttemptRequest {

    @NotNull(message = "Lý do nộp bài không được để trống")
    private SubmitReason reason;

    private Integer baseVersion;

    private List<AutosaveAnswersRequest.PartAnswerDto> finalAnswers;
}
