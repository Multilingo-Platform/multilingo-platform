package com.multilingo.backend.modules.testing.ai.dictionary;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiClient;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiClientException;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiGenerationRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DictionaryLookupV2Generator {
    private final GeminiClient client;
    private final DictionaryLookupV2PromptFactory promptFactory;
    private final DictionaryLookupV2OutputParser parser;

    public DictionaryLookupV2OutputParser.DictionaryLookupDefinitionV2 generate(
            String selectedText, String sourceContext, String learningLanguage, String meaningLanguage) {
        try {
            GeminiGenerationRequest request = promptFactory.build(selectedText, sourceContext, learningLanguage, meaningLanguage);
            var result = client.generate(request);
            if (result == null || result.text() == null || result.text().isBlank()) throw new AppException(ErrorCode.DICTIONARY_LOOKUP_INVALID_RESPONSE);
            return parser.parse(result.text());
        } catch (GeminiClientException e) {
            throw switch (e.getKind()) {
                case TIMEOUT -> new AppException(ErrorCode.DICTIONARY_LOOKUP_TIMEOUT);
                case INVALID_INPUT, BLOCKED, INCOMPLETE, RESPONSE_TOO_LARGE, INVALID_RESPONSE -> new AppException(ErrorCode.DICTIONARY_LOOKUP_INVALID_RESPONSE);
                default -> new AppException(ErrorCode.DICTIONARY_LOOKUP_UNAVAILABLE);
            };
        }
    }
}
