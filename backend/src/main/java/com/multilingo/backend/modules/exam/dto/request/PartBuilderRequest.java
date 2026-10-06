package com.multilingo.backend.modules.exam.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartBuilderRequest {

    @NotNull(message = "Part number is required")
    private Integer partNumber;

    @NotNull(message = "Content data is required")
    private Map<String, Object> contentData;
}
