package com.multilingo.backend.modules.testing.ai.hints;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiClient;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiClientException;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiGenerationRequest;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiGenerationResult;
import com.multilingo.backend.modules.testing.dto.response.WritingHintsResponse;
import com.multilingo.backend.modules.testing.service.support.WritingHintContextReader;
import com.multilingo.backend.modules.testing.service.support.WritingHintLanguageResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Điều phối gọi GeminiClient và chuyển đổi kết quả cho Writing Hints.
 * Thực hiện đúng 1 lần gọi, phân loại chính xác các lỗi transport sang ErrorCode nghiệp vụ an toàn.
 */
@Component
@RequiredArgsConstructor
public class WritingHintGenerator {

    private final GeminiClient geminiClient;
    private final WritingHintPromptFactory promptFactory;
    private final WritingHintOutputParser outputParser;

    public WritingHintsResponse.Content generate(
            WritingHintContextReader.HintContext context,
            WritingHintLanguageResolver.ResolvedLanguages languages
    ) {
        GeminiGenerationRequest request = promptFactory.build(context, languages);

        GeminiGenerationResult result;
        try {
            result = geminiClient.generate(request);
        } catch (GeminiClientException e) {
            throw mapGeminiClientException(e);
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            throw new AppException(ErrorCode.WRITING_HINTS_UNAVAILABLE, "Gemini client call failed");
        }

        if (result == null || result.text() == null || result.text().isBlank()) {
            throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "Gemini returned empty response text");
        }

        return outputParser.parse(result.text(), languages.hintLanguage(), context.hasVisualContext());
    }

    private AppException mapGeminiClientException(GeminiClientException e) {
        GeminiClientException.Kind kind = e.getKind();
        return switch (kind) {
            case TIMEOUT -> new AppException(ErrorCode.WRITING_HINTS_TIMEOUT, "Gemini request timed out");
            case DISABLED -> new AppException(ErrorCode.WRITING_HINTS_UNAVAILABLE, "Gemini provider is disabled");
            case UPSTREAM, TRANSPORT, RATE_LIMITED, AUTHENTICATION, PROVIDER_REQUEST_REJECTED, REDIRECT_REJECTED ->
                    new AppException(ErrorCode.WRITING_HINTS_UNAVAILABLE, "Gemini provider is currently unavailable");
            case BLOCKED, INCOMPLETE, RESPONSE_TOO_LARGE, INVALID_RESPONSE, INVALID_INPUT, INTERRUPTED ->
                    new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "Gemini returned an invalid or incomplete response");
        };
    }
}
