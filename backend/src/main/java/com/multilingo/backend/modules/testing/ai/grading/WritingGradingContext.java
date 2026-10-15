package com.multilingo.backend.modules.testing.ai.grading;

import java.util.List;
import java.util.Objects;

/**
 * Ngữ cảnh bài thi Writing được đóng băng từ attempt snapshot và bài nộp của học viên.
 * Phương thức toString() tuyệt đối không in nội dung essay, prompt, hoặc image URLs
 * nhằm tuân thủ quy tắc bảo mật dữ liệu và phòng chống rò rỉ thông tin riêng tư.
 */
public record WritingGradingContext(
        Integer partId,
        String questionId,
        String partTitle,
        String partInstruction,
        String groupInstruction,
        String taskPrompt,
        String originalText,
        String learningLanguage,
        int wordCount,
        List<WritingImageRef> images
) {
    public WritingGradingContext {
        Objects.requireNonNull(partId, "partId must not be null");
        Objects.requireNonNull(questionId, "questionId must not be null");
        Objects.requireNonNull(learningLanguage, "learningLanguage must not be null");
        originalText = originalText != null ? originalText : "";
        images = images != null ? List.copyOf(images) : List.of();
    }

    public WritingGradingContext(
            Integer partId,
            String questionId,
            String learningLanguage,
            String taskPrompt,
            String originalText,
            int wordCount,
            List<WritingImageRef> images
    ) {
        this(partId, questionId, null, null, null, taskPrompt, originalText, learningLanguage, wordCount, images);
    }

    public boolean hasVisualContext() {
        return !images.isEmpty();
    }

    public int imageCount() {
        return images.size();
    }

    @Override
    public String toString() {
        return "WritingGradingContext[partId=" + partId
                + ", questionId='" + questionId + '\''
                + ", learningLanguage='" + learningLanguage + '\''
                + ", wordCount=" + wordCount
                + ", imageCount=" + images.size() + ']';
    }
}
