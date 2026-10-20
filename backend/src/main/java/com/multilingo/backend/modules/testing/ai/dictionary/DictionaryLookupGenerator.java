package com.multilingo.backend.modules.testing.ai.dictionary;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiClient;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiClientException;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiGenerationRequest;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiGenerationResult;
import com.multilingo.backend.modules.testing.dto.response.DictionaryLookupResponse;
import com.multilingo.backend.modules.testing.service.support.DictionaryLookupTransactionCoordinator.Reservation;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DictionaryLookupGenerator {
    private final GeminiClient geminiClient;
    private final DictionaryLookupPromptFactory promptFactory;
    private final DictionaryLookupOutputParser outputParser;

    public DictionaryLookupResponse generate(Reservation reservation) {
        GeminiGenerationRequest request = promptFactory.build(reservation.request().selectedText(), reservation.sourceContext());
        GeminiGenerationResult result;
        try {
            result = geminiClient.generate(request);
        } catch (GeminiClientException e) {
            throw map(e.getKind());
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            throw new AppException(ErrorCode.DICTIONARY_LOOKUP_UNAVAILABLE);
        }
        if (result == null || result.text() == null || result.text().isBlank()) throw new AppException(ErrorCode.DICTIONARY_LOOKUP_INVALID_RESPONSE);
        DictionaryLookupDefinition definition = outputParser.parse(result.text());
        return new DictionaryLookupResponse(reservation.request().requestId(), reservation.attemptId(),
                reservation.request().partId(), reservation.request().documentId(), reservation.request().selectedText(),
                reservation.sourceContext(), "en", "vi", definition.meaningVi(), definition.phonetic(),
                definition.partOfSpeech(), definition.exampleEn(), definition.exampleVi());
    }

    private static AppException map(GeminiClientException.Kind kind) {
        return switch (kind) {
            case TIMEOUT -> new AppException(ErrorCode.DICTIONARY_LOOKUP_TIMEOUT);
            case INVALID_INPUT, BLOCKED, INCOMPLETE, RESPONSE_TOO_LARGE, INVALID_RESPONSE ->
                    new AppException(ErrorCode.DICTIONARY_LOOKUP_INVALID_RESPONSE);
            case DISABLED, AUTHENTICATION, PROVIDER_REQUEST_REJECTED, RATE_LIMITED, TRANSPORT, UPSTREAM,
                    INTERRUPTED, REDIRECT_REJECTED -> new AppException(ErrorCode.DICTIONARY_LOOKUP_UNAVAILABLE);
        };
    }
}
