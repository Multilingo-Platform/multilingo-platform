package com.multilingo.backend.modules.testing.ai.hints;

import com.multilingo.backend.modules.testing.ai.gemini.GeminiGenerationRequest;
import com.multilingo.backend.modules.testing.service.support.WritingHintContextReader;
import com.multilingo.backend.modules.testing.service.support.WritingHintLanguageResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WritingHintPromptFactoryTest {

    private WritingHintPromptFactory factory;

    @BeforeEach
    void setUp() {
        factory = new WritingHintPromptFactory();
    }

    @Test
    @DisplayName("Xây dựng GeminiGenerationRequest đúng hợp đồng: JSON format, 4096 tokens, phân tách system/user prompt")
    void buildsValidGeminiGenerationRequest() {
        String originalTaskText = "Viết một bài luận về tác động của biến đổi khí hậu.";
        WritingHintContextReader.HintContext context = new WritingHintContextReader.HintContext(
                1,
                "w1",
                "Phần thi Viết",
                "Hướng dẫn làm bài",
                "Bối cảnh đề bài",
                originalTaskText,
                true // có visual context
        );

        WritingHintLanguageResolver.ResolvedLanguages languages =
                new WritingHintLanguageResolver.ResolvedLanguages("vi", "fr");

        GeminiGenerationRequest request = factory.build(context, languages);

        assertThat(request.maxOutputTokens()).isEqualTo(4096);
        assertThat(request.outputFormat()).isEqualTo(GeminiGenerationRequest.OutputFormat.JSON);
        assertThat(request.systemInstruction()).isNotBlank();
        assertThat(request.systemInstruction()).contains("writing tutor", "hintLanguage", "outline", "vocabulary");

        // userText chứa task gốc, ngôn ngữ và cờ visualContext
        assertThat(request.userText()).contains(originalTaskText);
        assertThat(request.userText()).contains("\"learningLanguage\":\"vi\"");
        assertThat(request.userText()).contains("\"hintLanguage\":\"fr\"");
        assertThat(request.userText()).contains("\"visualContext\":true");
    }

    @Test
    @DisplayName("Không chứa bất kỳ sentinels answer key, private prompt hay thông tin ngoài phạm vi")
    void doesNotContainSentinels() {
        String answerKeySentinel = "SECRET_ANSWER_KEY";
        String privatePromptSentinel = "SECRET_AI_PROMPT";

        WritingHintContextReader.HintContext context = new WritingHintContextReader.HintContext(
                2,
                "w2",
                "Writing Task",
                null,
                null,
                "Write an essay about renewable energy.",
                false
        );

        WritingHintLanguageResolver.ResolvedLanguages languages =
                new WritingHintLanguageResolver.ResolvedLanguages("en", "en");

        GeminiGenerationRequest request = factory.build(context, languages);

        assertThat(request.userText()).doesNotContain(answerKeySentinel, privatePromptSentinel);
        assertThat(request.systemInstruction()).doesNotContain(answerKeySentinel, privatePromptSentinel);
    }
}
