package com.multilingo.backend.modules.exam.dto.response;

import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import java.util.List;

public record ExamImportPreviewResponse(ExamBuilderRequest request, List<Issue> issues,
        Counts counts, String sourceSha256, boolean canPublish) {
    public record Issue(String code, String sheet, String cell, String questionId, String message) {}
    public record Counts(int parts, int groups, int questions) {}
}
