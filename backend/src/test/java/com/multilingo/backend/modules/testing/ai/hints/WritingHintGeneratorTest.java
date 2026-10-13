package com.multilingo.backend.modules.testing.ai.hints;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.ai.gemini.*;
import com.multilingo.backend.modules.testing.dto.response.WritingHintsResponse;
import com.multilingo.backend.modules.testing.service.support.WritingHintContextReader;
import com.multilingo.backend.modules.testing.service.support.WritingHintLanguageResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WritingHintGeneratorTest {

    @Mock
    private GeminiClient geminiClient;

    @Mock
    private WritingHintPromptFactory promptFactory;

    @Mock
    private WritingHintOutputParser outputParser;

    private WritingHintGenerator generator;

    private WritingHintContextReader.HintContext dummyContext;
    private WritingHintLanguageResolver.ResolvedLanguages dummyLanguages;
    private GeminiGenerationRequest dummyRequest;

    @BeforeEach
    void setUp() {
        generator = new WritingHintGenerator(geminiClient, promptFactory, outputParser);

        dummyContext = new WritingHintContextReader.HintContext(
                1, "w1", "Part Title", "Part Inst", "Group Inst", "Task prompt", false
        );
        dummyLanguages = new WritingHintLanguageResolver.ResolvedLanguages("en", "fr");
        dummyRequest = new GeminiGenerationRequest(
                "System inst", "User prompt", 4096, GeminiGenerationRequest.OutputFormat.JSON
        );

        lenient().when(promptFactory.build(any(), any())).thenReturn(dummyRequest);
    }

    @Test
    @DisplayName("generate thành công: gọi GeminiClient đúng 1 lần và parse output thành công")
    void generatesHintsSuccessfully() {
        String mockOutput = "{\"mock\":\"json\"}";
        GeminiGenerationResult result = new GeminiGenerationResult(
                mockOutput,
                new GeminiGenerationResult.Usage(10, 20, 30)
        );
        when(geminiClient.generate(dummyRequest)).thenReturn(result);

        WritingHintsResponse.Content expectedContent = new WritingHintsResponse.Content(
                List.of(new WritingHintsResponse.OutlineSection("Title", List.of("P1"))),
                List.of(new WritingHintsResponse.VocabularyItem("T1", "D1", "E1", "Ex1")),
                List.of()
        );
        when(outputParser.parse(mockOutput, "fr", false)).thenReturn(expectedContent);

        WritingHintsResponse.Content actual = generator.generate(dummyContext, dummyLanguages);

        assertThat(actual).isEqualTo(expectedContent);
        verify(geminiClient, times(1)).generate(dummyRequest);
    }

    @Test
    @DisplayName("Gemini trả về TIMEOUT: ném WRITING_HINTS_TIMEOUT")
    void mapsTimeoutException() {
        when(geminiClient.generate(dummyRequest)).thenThrow(
                new GeminiClientException(GeminiClientException.Kind.TIMEOUT, "Request timed out")
        );

        assertThatThrownBy(() -> generator.generate(dummyContext, dummyLanguages))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_TIMEOUT);

        verify(geminiClient, times(1)).generate(dummyRequest);
    }

    @Test
    @DisplayName("Gemini trả về DISABLED: ném WRITING_HINTS_UNAVAILABLE")
    void mapsProviderDisabledException() {
        when(geminiClient.generate(dummyRequest)).thenThrow(
                new GeminiClientException(GeminiClientException.Kind.DISABLED, "Gemini is disabled")
        );

        assertThatThrownBy(() -> generator.generate(dummyContext, dummyLanguages))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_UNAVAILABLE);
    }

    @Test
    @DisplayName("Gemini trả về UPSTREAM hoặc TRANSPORT: ném WRITING_HINTS_UNAVAILABLE")
    void mapsUpstreamUnavailableException() {
        when(geminiClient.generate(dummyRequest)).thenThrow(
                new GeminiClientException(GeminiClientException.Kind.UPSTREAM, "Service unavailable")
        );

        assertThatThrownBy(() -> generator.generate(dummyContext, dummyLanguages))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_UNAVAILABLE);
    }

    @Test
    @DisplayName("Gemini ném BLOCKED: ném WRITING_HINTS_INVALID_RESPONSE")
    void mapsBlockedException() {
        when(geminiClient.generate(dummyRequest)).thenThrow(
                new GeminiClientException(GeminiClientException.Kind.BLOCKED, "Content blocked")
        );

        assertThatThrownBy(() -> generator.generate(dummyContext, dummyLanguages))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_INVALID_RESPONSE);
    }

    @Test
    @DisplayName("Gemini ném INCOMPLETE: ném WRITING_HINTS_INVALID_RESPONSE")
    void mapsIncompleteException() {
        when(geminiClient.generate(dummyRequest)).thenThrow(
                new GeminiClientException(GeminiClientException.Kind.INCOMPLETE, "Max tokens reached")
        );

        assertThatThrownBy(() -> generator.generate(dummyContext, dummyLanguages))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_INVALID_RESPONSE);
    }

    @Test
    @DisplayName("Gemini ném RESPONSE_TOO_LARGE: ném WRITING_HINTS_INVALID_RESPONSE")
    void mapsResponseTooLargeException() {
        when(geminiClient.generate(dummyRequest)).thenThrow(
                new GeminiClientException(GeminiClientException.Kind.RESPONSE_TOO_LARGE, "Response exceeds byte limit")
        );

        assertThatThrownBy(() -> generator.generate(dummyContext, dummyLanguages))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_INVALID_RESPONSE);
    }
}
