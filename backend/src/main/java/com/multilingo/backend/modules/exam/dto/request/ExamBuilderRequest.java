package com.multilingo.backend.modules.exam.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamBuilderRequest {

    @NotBlank(message = "Title is required")
    private String title;

    @NotBlank(message = "Type is required")
    private String type;

    @NotBlank(message = "Exam language is required")
    private String examLanguage;

    private boolean isPublished;

    @NotEmpty(message = "Exam must have at least one section")
    @Valid
    private List<SectionBuilderRequest> sections;
}
