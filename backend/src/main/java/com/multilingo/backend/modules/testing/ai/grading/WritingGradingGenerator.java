package com.multilingo.backend.modules.testing.ai.grading;

import com.multilingo.backend.modules.testing.ai.gemini.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Orchestrates executing exactly one Gemini generation call with optional pre-loaded images,
 * mapping exceptions to classified retryable/terminal failures, and parsing the grading grade.
 */
@Component
@RequiredArgsConstructor
public class WritingGradingGenerator {

    private final GeminiClient geminiClient;
    private final WritingGradingPromptFactory promptFactory;
    private final WritingGradingOutputParser outputParser;

    public WritingGrade generate(WritingGradingContext context) {
        return generate(context, List.of(), List.of());
    }

    public WritingGrade generate(WritingGradingContext context, List<GeminiImagePart> images) {
        return generate(context, images, List.of());
    }

    public WritingGrade generate(WritingGradingContext context, List<GeminiImagePart> images, List<String> imageDigests) {
        if (context == null) {
            throw new IllegalArgumentException("WritingGradingContext must not be null");
        }

        boolean genericRubric = context.rubricPolicy() != null
                && WritingRubricRegistry.GENERIC_RUBRIC.equals(context.rubricPolicy().rubricCode());
        // Preserve the English legacy cutoff. Generic scripts are not measured by English whitespace words.
        if ((!genericRubric && context.wordCount() <= 10) || (genericRubric && com.multilingo.backend.modules.testing.util.WritingWordCounter.count(context.originalText()) == 0)) {
            return genericRubric
                    ? WritingGrade.emptyEssay(context.originalText(), context.rubricPolicy(), context.feedbackLanguage())
                    : WritingGrade.tooShort(context.originalText());
        }

        List<GeminiImagePart> suppliedImages = images == null ? List.of() : images;
        if (suppliedImages.size() != context.imageCount() || suppliedImages.stream().anyMatch(image -> image == null)) {
            throw new WritingGradingException(
                    WritingGradingFailure.terminal("INVALID_INPUT", "Loaded images do not match grading context")
            );
        }
        List<GeminiImagePart> imageParts = List.copyOf(suppliedImages);
        GeminiGenerationRequest request = promptFactory.build(context, imageParts);

        GeminiGenerationResult result;
        try {
            result = geminiClient.generate(request);
        } catch (GeminiClientException e) {
            throw mapGeminiClientException(e);
        } catch (WritingGradingException e) {
            throw e;
        } catch (Exception e) {
            throw new WritingGradingException(
                    WritingGradingFailure.retryable("UPSTREAM", "Gemini generation failed: " + e.getClass().getSimpleName())
            );
        }

        if (result == null || result.text() == null || result.text().isBlank()) {
            throw new WritingGradingException(
                    WritingGradingFailure.terminal("INVALID_RESPONSE", "Gemini returned empty response text")
            );
        }

        boolean hasVisualContext = !imageParts.isEmpty();
        try {
            WritingGrade grade = outputParser.parse(result.text(), context.originalText(), hasVisualContext,
                    context.rubricPolicy(), context.feedbackLanguage());
            if (imageDigests != null && !imageDigests.isEmpty()) {
                return grade.withImageDigests(imageDigests);
            }
            return grade;
        } catch (WritingGradingException e) {
            throw e;
        } catch (Exception e) {
            throw new WritingGradingException(
                    WritingGradingFailure.terminal("MALFORMED_OUTPUT", "Failed to parse grading output")
            );
        }
    }

    private WritingGradingException mapGeminiClientException(GeminiClientException e) {
        GeminiClientException.Kind kind = e.getKind();
        return switch (kind) {
            case TIMEOUT -> new WritingGradingException(WritingGradingFailure.retryable("TIMEOUT", "Gemini request timed out"));
            case TRANSPORT -> new WritingGradingException(WritingGradingFailure.retryable("TRANSPORT", "Gemini transport failure"));
            case RATE_LIMITED -> new WritingGradingException(WritingGradingFailure.retryable("RATE_LIMITED", "Gemini rate limit exceeded"));
            case UPSTREAM -> new WritingGradingException(WritingGradingFailure.retryable("UPSTREAM", "Gemini upstream server error"));
            case INTERRUPTED -> new WritingGradingException(WritingGradingFailure.retryable("INTERRUPTED", "Gemini call interrupted during shutdown"));
            case DISABLED -> new WritingGradingException(WritingGradingFailure.waiting("PROVIDER_DISABLED", "Gemini provider is disabled"));
            case AUTHENTICATION -> new WritingGradingException(WritingGradingFailure.terminal("AUTHENTICATION", "Gemini authentication failed"));
            case PROVIDER_REQUEST_REJECTED -> new WritingGradingException(WritingGradingFailure.terminal("PROVIDER_REJECTED", "Gemini request rejected by provider"));
            case REDIRECT_REJECTED -> new WritingGradingException(WritingGradingFailure.terminal("REDIRECT_REJECTED", "Gemini request redirected unexpectedly"));
            case BLOCKED -> new WritingGradingException(WritingGradingFailure.terminal("BLOCKED", "Gemini generation blocked by safety filters"));
            case INCOMPLETE -> new WritingGradingException(WritingGradingFailure.terminal("INCOMPLETE", "Gemini response truncated or incomplete"));
            case RESPONSE_TOO_LARGE -> new WritingGradingException(WritingGradingFailure.terminal("RESPONSE_TOO_LARGE", "Gemini response exceeded size limit"));
            case INVALID_RESPONSE -> new WritingGradingException(WritingGradingFailure.terminal("INVALID_RESPONSE", "Gemini returned invalid response"));
            case INVALID_INPUT -> new WritingGradingException(WritingGradingFailure.terminal("INVALID_INPUT", "Invalid input sent to Gemini"));
        };
    }
}
