package com.multilingo.backend.modules.exam.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
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
public class SectionBuilderRequest {

    @NotBlank(message = "Skill type is required")
    private String skillType;

    @NotNull(message = "Duration minutes is required")
    private Integer durationMinutes;

    @NotEmpty(message = "Section must have at least one part")
    @Valid
    private List<PartBuilderRequest> parts;
}
