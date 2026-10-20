package com.multilingo.backend.modules.testing.ai.grading;

import com.multilingo.backend.modules.testing.ai.gemini.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class WritingGradingGeneratorTest {

    private GeminiClient geminiClient;
    private WritingGradingPromptFactory promptFactory;
    private WritingGradingOutputParser outputParser;
    private WritingGradingGenerator generator;

    private static final String ESSAY = "Learning language is good for career and opens many chance.";
    private static final String VALID_TEXT_ONLY_RESPONSE = """
            {
              "feedbackLanguage": "vi",
              "criteria": [
                {"code": "TR", "score": 6.5, "feedback": "Nhận xét TR."},
                {"code": "CC", "score": 6.5, "feedback": "Nhận xét CC."},
                {"code": "LR", "score": 6.5, "feedback": "Nhận xét LR."},
                {"code": "GRA", "score": 6.5, "feedback": "Nhận xét GRA."}
              ],
              "overallFeedback": "Tổng quan tốt.",
              "correctedEssay": "Learning language is good for career and opens many chance.",
              "corrections": []
            }
            """;

    private static final String VALID_VISUAL_RESPONSE = """
            {
              "feedbackLanguage": "vi",
              "visualObservations": "Biểu đồ cột thể hiện mức tiêu thụ năng lượng từ 2010 đến 2020.",
              "criteria": [
                {"code": "TR", "score": 6.5, "feedback": "Nhận xét TR."},
                {"code": "CC", "score": 6.5, "feedback": "Nhận xét CC."},
                {"code": "LR", "score": 6.5, "feedback": "Nhận xét LR."},
                {"code": "GRA", "score": 6.5, "feedback": "Nhận xét GRA."}
              ],
              "overallFeedback": "Tổng quan tốt.",
              "correctedEssay": "Learning language is good for career and opens many chance.",
              "corrections": []
            }
            """;

    @BeforeEach
    void setUp() {
        geminiClient = mock(GeminiClient.class);
        promptFactory = new WritingGradingPromptFactory();
        outputParser = new WritingGradingOutputParser();
        generator = new WritingGradingGenerator(geminiClient, promptFactory, outputParser);
    }

    @Test
    @DisplayName("Should call GeminiClient once and return parsed WritingGrade for valid text-only context")
    void generate_validTextOnlyContext_callsGeminiOnceAndReturnsGrade() {
        WritingGradingContext context = new WritingGradingContext(
                10,
                "w_1",
                "en",
                "Discuss advantages of studying abroad.",
                ESSAY,
                11,
                List.of()
        );

        when(geminiClient.generate(any(GeminiGenerationRequest.class)))
                .thenReturn(new GeminiGenerationResult(VALID_TEXT_ONLY_RESPONSE, new GeminiGenerationResult.Usage(100, 200, 300)));

        WritingGrade grade = generator.generate(context);

        assertThat(grade).isNotNull();
        assertThat(grade.rubricCode()).isEqualTo("WRITING_EN_V1");
        assertThat(grade.overallScore()).isEqualByComparingTo(new BigDecimal("6.5"));
        assertThat(grade.visualObservations()).isNull();
        verify(geminiClient, times(1)).generate(any());
    }

    @Test
    @DisplayName("F5: Should pass pre-loaded GeminiImageParts and attach digests to WritingGrade")
    void generate_withPreLoadedImages_passesImagesToGeminiAndAttachesDigests() {
        WritingGradingContext context = new WritingGradingContext(
                10,
                "w_1",
                "en",
                "Describe the chart.",
                ESSAY,
                11,
                List.of(new WritingImageRef("https://cdn.example.test/chart.png"))
        );

        List<GeminiImagePart> images = List.of(new GeminiImagePart("image/png", new byte[]{1, 2, 3}));
        List<String> digests = List.of("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

        when(geminiClient.generate(any(GeminiGenerationRequest.class)))
                .thenReturn(new GeminiGenerationResult(VALID_VISUAL_RESPONSE, new GeminiGenerationResult.Usage(100, 200, 300)));

        WritingGrade grade = generator.generate(context, images, digests);

        assertThat(grade).isNotNull();
        assertThat(grade.rubricCode()).isEqualTo("WRITING_EN_V1");
        assertThat(grade.visualObservations()).contains("Biểu đồ cột");
        assertThat(grade.imageDigests()).containsExactly("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

        ArgumentCaptor<GeminiGenerationRequest> captor = ArgumentCaptor.forClass(GeminiGenerationRequest.class);
        verify(geminiClient, times(1)).generate(captor.capture());
        assertThat(captor.getValue().images()).hasSize(1);
        assertThat(captor.getValue().images().getFirst().mimeType()).isEqualTo("image/png");
    }

    @Test
    @DisplayName("F4: Generator with visual images should reject text-only Gemini response lacking visualObservations")
    void generate_withImages_rejectsResponseWithoutVisualObservations() {
        WritingGradingContext context = new WritingGradingContext(
                10,
                "w_1",
                "en",
                "Describe the chart.",
                ESSAY,
                11,
                List.of(new WritingImageRef("https://cdn.example.test/chart.png"))
        );

        List<GeminiImagePart> images = List.of(new GeminiImagePart("image/png", new byte[]{1, 2, 3}));

        when(geminiClient.generate(any(GeminiGenerationRequest.class)))
                .thenReturn(new GeminiGenerationResult(VALID_TEXT_ONLY_RESPONSE, new GeminiGenerationResult.Usage(100, 200, 300)));

        assertThatThrownBy(() -> generator.generate(context, images))
                .isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> {
                    WritingGradingFailure failure = ((WritingGradingException) ex).getFailure();
                    assertThat(failure.errorCode()).isEqualTo("MALFORMED_OUTPUT");
                    assertThat(failure.isTerminal()).isTrue();
                });
    }

    @Test
    @DisplayName("F3: Generator should safely wrap unexpected parsing exceptions or invalid score in MALFORMED_OUTPUT")
    void generate_invalidScoreFromProvider_wrapsInTerminalMalformedOutput() {
        WritingGradingContext context = new WritingGradingContext(
                10, "w_1", "en", "Prompt", ESSAY, 11, List.of()
        );

        String invalidScoreResponse = VALID_TEXT_ONLY_RESPONSE.replace("\"score\": 6.5,", "\"score\": 6.25,");
        when(geminiClient.generate(any()))
                .thenReturn(new GeminiGenerationResult(invalidScoreResponse, new GeminiGenerationResult.Usage(100, 200, 300)));

        assertThatThrownBy(() -> generator.generate(context))
                .isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> {
                    WritingGradingFailure failure = ((WritingGradingException) ex).getFailure();
                    assertThat(failure.errorCode()).isEqualTo("MALFORMED_OUTPUT");
                    assertThat(failure.isTerminal()).isTrue();
                });
    }

    @Test
    @DisplayName("Should map retryable GeminiClientException to retryable WritingGradingFailure")
    void generate_geminiTimeout_throwsRetryableFailure() {
        WritingGradingContext context = new WritingGradingContext(
                10, "w_1", "en", "Prompt", ESSAY, 11, List.of()
        );

        when(geminiClient.generate(any()))
                .thenThrow(new GeminiClientException(GeminiClientException.Kind.TIMEOUT, "Timeout"));

        assertThatThrownBy(() -> generator.generate(context))
                .isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> {
                    WritingGradingFailure failure = ((WritingGradingException) ex).getFailure();
                    assertThat(failure.isRetryable()).isTrue();
                    assertThat(failure.errorCode()).isEqualTo("TIMEOUT");
                });
    }

    @Test
    @DisplayName("Should map GeminiClientException DISABLED to waiting WritingGradingFailure")
    void generate_geminiDisabled_throwsWaitingFailure() {
        WritingGradingContext context = new WritingGradingContext(
                10, "w_1", "en", "Prompt", ESSAY, 11, List.of()
        );

        when(geminiClient.generate(any()))
                .thenThrow(new GeminiClientException(GeminiClientException.Kind.DISABLED, "Disabled"));

        assertThatThrownBy(() -> generator.generate(context))
                .isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> {
                    WritingGradingFailure failure = ((WritingGradingException) ex).getFailure();
                    assertThat(failure.isRetryable()).isFalse();
                    assertThat(failure.isWaiting()).isTrue();
                    assertThat(failure.errorCode()).isEqualTo("PROVIDER_DISABLED");
                });
    }

    @Test
    @DisplayName("Should map terminal GeminiClientException to non-retryable FAILED WritingGradingFailure")
    void generate_geminiAuth_throwsTerminalFailure() {
        WritingGradingContext context = new WritingGradingContext(
                10, "w_1", "en", "Prompt", ESSAY, 11, List.of()
        );

        when(geminiClient.generate(any()))
                .thenThrow(new GeminiClientException(GeminiClientException.Kind.AUTHENTICATION, "Bad key"));

        assertThatThrownBy(() -> generator.generate(context))
                .isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> {
                    WritingGradingFailure failure = ((WritingGradingException) ex).getFailure();
                    assertThat(failure.isRetryable()).isFalse();
                    assertThat(failure.isWaiting()).isFalse();
                    assertThat(failure.errorCode()).isEqualTo("AUTHENTICATION");
                });
    }

    @Test
    @DisplayName("Should immediately return 0 score for short essay (<= 10 words) without calling Gemini")
    void generate_tooShortWordCount_returnsZeroGradeWithoutGemini() {
        WritingGradingContext context = new WritingGradingContext(
                10,
                "w_1",
                "en",
                "Prompt",
                "Too short essay.",
                3,
                List.of(new WritingImageRef("https://cdn.example.test/chart.png"))
        );

        WritingGrade grade = generator.generate(context);

        assertThat(grade).isNotNull();
        assertThat(grade.rubricCode()).isEqualTo("WRITING_EN_V1");
        assertThat(grade.overallScore()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(grade.criteria()).allMatch(c -> c.score().compareTo(BigDecimal.ZERO) == 0);
        assertThat(grade.correctedEssay()).isEqualTo("Too short essay.");
        assertThat(grade.corrections()).isEmpty();

        verifyNoInteractions(geminiClient);
    }

    private WritingGradingContext imageContext(int refs, int words) {
        return new WritingGradingContext(10, "w_1", "en", "Describe chart", ESSAY, words,
                java.util.stream.IntStream.range(0, refs)
                        .mapToObj(i -> new WritingImageRef("https://cdn.example.test/chart" + i + ".png")).toList());
    }

    private void assertInvalidInput(Runnable call) {
        assertThatThrownBy(call::run).isInstanceOf(WritingGradingException.class).hasCause(null)
                .satisfies(e -> {
                    assertThat(((WritingGradingException)e).getFailure().errorCode()).isEqualTo("INVALID_INPUT");
                    assertThat(((WritingGradingException)e).getFailure().isTerminal()).isTrue();
                });
        verifyNoInteractions(geminiClient);
    }

    @Test
    void generate_missingOrExtraImages_failClosedAcrossOverloads() {
        GeminiImagePart image = new GeminiImagePart("image/png", new byte[]{1});
        assertInvalidInput(() -> generator.generate(imageContext(1, 11)));
        assertInvalidInput(() -> generator.generate(imageContext(1, 11), null));
        assertInvalidInput(() -> generator.generate(imageContext(1, 11), List.of()));
        assertInvalidInput(() -> generator.generate(imageContext(2, 11), List.of(image)));
        assertInvalidInput(() -> generator.generate(imageContext(1, 11), List.of(image, image)));
        assertInvalidInput(() -> generator.generate(imageContext(0, 11), List.of(image)));
        assertInvalidInput(() -> generator.generate(imageContext(1, 11), java.util.Arrays.asList((GeminiImagePart)null)));
    }

    @Test
    void generate_matchedTwoImages_keepsVisualSchemaAndOrder() {
        GeminiImagePart first = new GeminiImagePart("image/png", new byte[]{1});
        GeminiImagePart second = new GeminiImagePart("image/jpeg", new byte[]{2});
        when(geminiClient.generate(any())).thenReturn(new GeminiGenerationResult(VALID_VISUAL_RESPONSE, null));
        WritingGrade grade = generator.generate(imageContext(2, 11), List.of(first, second));
        assertThat(grade.rubricCode()).isEqualTo("WRITING_EN_V1");
        assertThat(grade.visualObservations()).isNotBlank();
        ArgumentCaptor<GeminiGenerationRequest> captor = ArgumentCaptor.forClass(GeminiGenerationRequest.class);
        verify(geminiClient).generate(captor.capture());
        assertThat(captor.getValue().images()).containsExactly(first, second);
    }

    @Test
    void generate_shortEssay_shortCircuitsEvenMismatchedImages() {
        for (int words : new int[]{0, 9, 10}) {
            WritingGrade grade = generator.generate(imageContext(2, words), null);
            assertThat(grade.overallScore()).isEqualByComparingTo("0.0");
            assertThat(grade.correctedEssay()).isEqualTo(ESSAY);
            assertThat(grade.rubricCode()).isEqualTo("WRITING_EN_V1");
            assertThat(grade.overallFeedback()).contains("không quá 10 từ");
            assertThat(grade.overallFeedback()).doesNotContain("dưới 10 từ");
        }
        verifyNoInteractions(geminiClient);
    }

    @Test
    void generate_invalidWirePayload_neverCallsProvider() {
        WritingGradingContext context = new WritingGradingContext(10, "w_1", "en", "\0".repeat(13300), ESSAY + "\0".repeat(7000), 11, List.of());
        assertInvalidInput(() -> generator.generate(context));
    }
}
