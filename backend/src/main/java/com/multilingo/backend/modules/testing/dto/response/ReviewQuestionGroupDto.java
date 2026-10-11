package com.multilingo.backend.modules.testing.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
@com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
public class ReviewQuestionGroupDto {
    private String groupId;
    private String instruction;
    private String contentHtml;
    private Map<String, Object> sharedAudio;
    private Map<String, Object> sharedMedia;
    private List<ReviewQuestionDto> questions;
}
