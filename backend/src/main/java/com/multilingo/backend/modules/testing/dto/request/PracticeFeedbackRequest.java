package com.multilingo.backend.modules.testing.dto.request;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PracticeFeedbackRequest {
    private JsonNode partId;
    private JsonNode questionId;
    private JsonNode answer;
}
