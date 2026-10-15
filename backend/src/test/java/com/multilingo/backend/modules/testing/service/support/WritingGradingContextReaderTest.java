package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.modules.testing.ai.grading.WritingGradingContext;
import com.multilingo.backend.modules.testing.ai.grading.WritingImageRef;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.core.env.MapPropertySource;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

class WritingGradingContextReaderTest {

    private WritingGradingContextReader reader;
    private WritingGradingContextReader readerWithImagesEnabled;

    @BeforeEach
    void setUp() {
        reader = new WritingGradingContextReader(false);
        readerWithImagesEnabled = new WritingGradingContextReader(true);
    }

    private Map<String, Object> createWritingSnapshot(String examLanguage, Map<String, Object> partContentData) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        if (examLanguage != null) {
            snapshot.put("examLanguage", examLanguage);
        }
        snapshot.put("id", 1);
        snapshot.put("title", "IELTS Writing Test");

        Map<String, Object> partMap = new LinkedHashMap<>();
        partMap.put("id", 10);
        partMap.put("part_number", 1);
        partMap.put("title", "Writing Task 1");
        if (partContentData != null) {
            partMap.putAll(partContentData);
        }

        Map<String, Object> sectionMap = new LinkedHashMap<>();
        sectionMap.put("id", 1);
        sectionMap.put("name", "WRITING");
        sectionMap.put("parts", List.of(partMap));

        snapshot.put("sections", List.of(sectionMap));
        return snapshot;
    }

    private TestAttempt createAttempt(Map<String, Object> snapshot) {
        TestAttempt attempt = new TestAttempt();
        attempt.setId(42);
        attempt.setExamSnapshot(snapshot);
        return attempt;
    }

    private List<AttemptAnswer> createAnswers(Integer partId, String questionId, Object answerValue) {
        AttemptAnswer ans = new AttemptAnswer();
        ans.setPartId(partId);
        Map<String, Object> userAnswers = new HashMap<>();
        userAnswers.put(questionId, answerValue);
        ans.setUserAnswers(userAnswers);
        return List.of(ans);
    }

    @Test
    @DisplayName("Should return Eligible for valid English essay over 10 words")
    void read_validTextOnlyEssay_returnsEligible() {
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put("prompt", "Some people think that universities should provide graduates with the knowledge and skills needed in the workplace.");

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("instruction", "Write at least 250 words.");
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
        String submittedEssay = "In modern society, education plays a vital and indispensable role in preparing young professionals for the global job market.";
        List<AttemptAnswer> answers = createAnswers(10, "w_1", submittedEssay);

        ContextDecision decision = reader.read(attempt, 10, "w_1", answers);

        assertThat(decision).isInstanceOf(ContextDecision.Eligible.class);
        ContextDecision.Eligible eligible = (ContextDecision.Eligible) decision;
        WritingGradingContext context = eligible.context();

        assertThat(context.partId()).isEqualTo(10);
        assertThat(context.questionId()).isEqualTo("w_1");
        assertThat(context.learningLanguage()).isEqualTo("en");
        assertThat(context.originalText()).isEqualTo(submittedEssay);
        assertThat(context.wordCount()).isEqualTo(19);
        assertThat(context.images()).isEmpty();
    }

    @Test
    @DisplayName("Should preserve untrimmed essay exactly as submitted without normalization")
    void read_untrimmedEssay_preservesExactWhitespace() {
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put("prompt", "Discuss both views.");

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
        String submittedEssay = "  \n\tLeading whitespace and several newlines in this formal academic essay.\t\n  ";
        List<AttemptAnswer> answers = createAnswers(10, "w_1", submittedEssay);

        ContextDecision decision = reader.read(attempt, 10, "w_1", answers);

        assertThat(decision).isInstanceOf(ContextDecision.Eligible.class);
        WritingGradingContext context = ((ContextDecision.Eligible) decision).context();
        assertThat(context.originalText()).isEqualTo(submittedEssay);
        assertThat(context.wordCount()).isEqualTo(10);
    }

    @Test
    @DisplayName("Should treat missing or null answer as empty string without failing")
    void read_nullOrMissingAnswer_returnsEligibleWithEmptyString() {
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put("prompt", "Write an essay.");

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));

        // Case 1: null answers list
        ContextDecision decisionNull = reader.read(attempt, 10, "w_1", null);
        assertThat(decisionNull).isInstanceOf(ContextDecision.Eligible.class);
        assertThat(((ContextDecision.Eligible) decisionNull).context().originalText()).isEmpty();
        assertThat(((ContextDecision.Eligible) decisionNull).context().wordCount()).isZero();

        // Case 2: empty answers list
        ContextDecision decisionEmpty = reader.read(attempt, 10, "w_1", Collections.emptyList());
        assertThat(decisionEmpty).isInstanceOf(ContextDecision.Eligible.class);
        assertThat(((ContextDecision.Eligible) decisionEmpty).context().originalText()).isEmpty();
    }

    @Test
    @DisplayName("Should treat non-string answer as empty string without stringifying it")
    void read_nonStringAnswer_returnsEmptyString() {
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put("prompt", "Write an essay.");

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
        List<AttemptAnswer> answers = createAnswers(10, "w_1", Map.of("unexpected", "data"));

        ContextDecision decision = reader.read(attempt, 10, "w_1", answers);
        assertThat(decision).isInstanceOf(ContextDecision.Eligible.class);
        WritingGradingContext context = ((ContextDecision.Eligible) decision).context();
        assertThat(context.originalText()).isEmpty();
        assertThat(context.wordCount()).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"vi", "fr", "ja", "de", "es", "zh"})
    @DisplayName("Should return Unavailable when examLanguage is not English")
    void read_nonEnglishLanguage_returnsUnavailable(String lang) {
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put("prompt", "Prompt text");

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot(lang, partContent));
        List<AttemptAnswer> answers = createAnswers(10, "w_1", "Some valid long essay written in another language for test.");

        ContextDecision decision = reader.read(attempt, 10, "w_1", answers);
        assertThat(decision).isInstanceOf(ContextDecision.Unavailable.class);
        ContextDecision.Unavailable unavail = (ContextDecision.Unavailable) decision;
        assertThat(unavail.reasonCode()).isEqualTo("UNSUPPORTED_LANGUAGE");
    }

    @Test
    @DisplayName("Should return Unavailable when examLanguage is missing from snapshot")
    void read_missingExamLanguage_returnsUnavailable() {
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put("prompt", "Prompt text");

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot(null, partContent));
        List<AttemptAnswer> answers = createAnswers(10, "w_1", "Some valid essay text that exceeds 10 words in length.");

        ContextDecision decision = reader.read(attempt, 10, "w_1", answers);
        assertThat(decision).isInstanceOf(ContextDecision.Unavailable.class);
        assertThat(((ContextDecision.Unavailable) decision).reasonCode()).isEqualTo("MISSING_LANGUAGE");
    }

    @Test
    @DisplayName("Should return Unavailable when essay exceeds 8,000 Unicode code points")
    void read_essayExceeds8000CodePoints_returnsUnavailable() {
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put("prompt", "Prompt text");

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
        String massiveEssay = "word ".repeat(2000); // 10000 chars > 8000 code points
        List<AttemptAnswer> answers = createAnswers(10, "w_1", massiveEssay);

        ContextDecision decision = reader.read(attempt, 10, "w_1", answers);
        assertThat(decision).isInstanceOf(ContextDecision.Unavailable.class);
        assertThat(((ContextDecision.Unavailable) decision).reasonCode()).isEqualTo("ESSAY_TOO_LONG");
    }

    @Test
    @DisplayName("Should return Unavailable when text context exceeds 16,000 Unicode code points")
    void read_contextExceeds16000CodePoints_returnsUnavailable() {
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put("prompt", "P".repeat(16001));

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
        List<AttemptAnswer> answers = createAnswers(10, "w_1", "This is an essay with more than ten words written by a student.");

        ContextDecision decision = reader.read(attempt, 10, "w_1", answers);
        assertThat(decision).isInstanceOf(ContextDecision.Unavailable.class);
        assertThat(((ContextDecision.Unavailable) decision).reasonCode()).isEqualTo("CONTEXT_TOO_LONG");
    }

    @Test
    @DisplayName("Should return Unavailable when question is not an ESSAY")
    void read_nonEssayQuestion_returnsUnavailable() {
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "q_1");
        questionMap.put("type", "SINGLE_CHOICE");
        questionMap.put("prompt", "Prompt text");

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
        List<AttemptAnswer> answers = createAnswers(10, "q_1", "A");

        ContextDecision decision = reader.read(attempt, 10, "q_1", answers);
        assertThat(decision).isInstanceOf(ContextDecision.Unavailable.class);
        assertThat(((ContextDecision.Unavailable) decision).reasonCode()).isEqualTo("NOT_AN_ESSAY");
    }

    @Test
    @DisplayName("Should return Unavailable when question belongs to non-writing section")
    void read_readingSection_returnsUnavailable() {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("examLanguage", "en");
        snapshot.put("sections", List.of(Map.of(
                "name", "READING",
                "parts", List.of(Map.of(
                        "id", 10,
                        "questions", List.of(Map.of(
                                "question_id", "r_1",
                                "type", "ESSAY",
                                "prompt", "Some reading essay prompt"
                        ))
                ))
        )));

        TestAttempt attempt = createAttempt(snapshot);
        List<AttemptAnswer> answers = createAnswers(10, "r_1", "A long essay answering a reading prompt text.");

        ContextDecision decision = reader.read(attempt, 10, "r_1", answers);
        assertThat(decision).isInstanceOf(ContextDecision.Unavailable.class);
        assertThat(((ContextDecision.Unavailable) decision).reasonCode()).isEqualTo("NOT_WRITING_SECTION");
    }

    @Test
    @DisplayName("Should extract images across part, group, and question levels with deduplication and order preservation")
    void read_multimodalImages_extractedInOrderAndDeduped() {
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put("prompt", "Summarize the chart.");
        questionMap.put("image_url", "https://storage.multilingo.com/exam/question-chart.png");

        Map<String, Object> groupMap = new LinkedHashMap<>();
        groupMap.put("group_id", "g_1");
        groupMap.put("instruction", "Look at the graphs below.");
        groupMap.put("shared_media", Map.of("type", "image", "url", "https://storage.multilingo.com/exam/shared-trend.png"));
        groupMap.put("questions", List.of(questionMap));

        Map<String, Object> partContent = new LinkedHashMap<>();
        // Duplicate the group image at the part level to test deduplication:
        partContent.put("shared_media", Map.of("type", "image", "url", "https://storage.multilingo.com/exam/shared-trend.png"));
        partContent.put("question_groups", List.of(groupMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
        String submitted = "The given chart illustrates the trends in language learning over two decades.";
        List<AttemptAnswer> answers = createAnswers(10, "w_1", submitted);

        ContextDecision decision = readerWithImagesEnabled.read(attempt, 10, "w_1", answers);
        assertThat(decision).isInstanceOf(ContextDecision.Eligible.class);

        WritingGradingContext context = ((ContextDecision.Eligible) decision).context();
        assertThat(context.images()).hasSize(2);
        // Deterministic order: part/group first, question second:
        assertThat(context.images().get(0).url()).isEqualTo("https://storage.multilingo.com/exam/shared-trend.png");
        assertThat(context.images().get(1).url()).isEqualTo("https://storage.multilingo.com/exam/question-chart.png");
    }

    @Test
    @DisplayName("Should return VISUAL_CONTEXT_UNSUPPORTED when task has images but images-enabled is false")
    void read_imagesDisabled_returnsVisualContextUnsupported() {
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put("prompt", "Summarize the chart.");
        questionMap.put("image_url", "https://storage.multilingo.com/exam/chart.png");

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
        String submitted = "The bar chart compares the percentage of renewable energy production across several European countries in recent years.";
        List<AttemptAnswer> answers = createAnswers(10, "w_1", submitted);

        ContextDecision decision = reader.read(attempt, 10, "w_1", answers); // imagesEnabled = false
        assertThat(decision).isInstanceOf(ContextDecision.Unavailable.class);
        assertThat(((ContextDecision.Unavailable) decision).reasonCode()).isEqualTo("VISUAL_CONTEXT_UNSUPPORTED");
    }

    @Test
    @DisplayName("Should return TOO_MANY_IMAGES when task has more than 2 distinct images")
    void read_moreThanTwoImages_returnsTooManyImages() {
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put("prompt", "Compare the 3 graphs.");
        questionMap.put("images", List.of(
                "https://storage.multilingo.com/img1.png",
                "https://storage.multilingo.com/img2.png",
                "https://storage.multilingo.com/img3.png"
        ));

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
        String submitted = "The three graphs show various economic indicators over five years for developing and developed nations.";
        List<AttemptAnswer> answers = createAnswers(10, "w_1", submitted);

        ContextDecision decision = readerWithImagesEnabled.read(attempt, 10, "w_1", answers);
        assertThat(decision).isInstanceOf(ContextDecision.Unavailable.class);
        assertThat(((ContextDecision.Unavailable) decision).reasonCode()).isEqualTo("TOO_MANY_IMAGES");
    }

    @Test
    @DisplayName("Should return UNSUPPORTED_MEDIA when non-image media is detected (audio, video, pdf)")
    void read_nonImageMedia_returnsUnsupportedMedia() {
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put("prompt", "Listen and summarize.");
        questionMap.put("shared_audio", Map.of("url", "https://storage.multilingo.com/audio.mp3"));

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
        String submitted = "The speaker discusses climate policies in urban environments with diverse perspectives and detailed suggestions.";
        List<AttemptAnswer> answers = createAnswers(10, "w_1", submitted);

        ContextDecision decision = readerWithImagesEnabled.read(attempt, 10, "w_1", answers);
        assertThat(decision).isInstanceOf(ContextDecision.Unavailable.class);
        assertThat(((ContextDecision.Unavailable) decision).reasonCode()).isEqualTo("UNSUPPORTED_MEDIA");
    }

    @Test
    @DisplayName("Should return UNSUPPORTED_MEDIA when HTML contains embedded <img> tag")
    void read_htmlWithImgTag_returnsUnsupportedMedia() {
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put("prompt", "Look at this image: <img src='https://malicious.org/tracker.png' alt='graph'/> and write an essay.");

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
        String submitted = "The student essay about this chart has more than ten words.";
        List<AttemptAnswer> answers = createAnswers(10, "w_1", submitted);

        ContextDecision decision = readerWithImagesEnabled.read(attempt, 10, "w_1", answers);
        assertThat(decision).isInstanceOf(ContextDecision.Unavailable.class);
        assertThat(((ContextDecision.Unavailable) decision).reasonCode()).isEqualTo("UNSUPPORTED_MEDIA");
    }

    @Test
    @DisplayName("Should not process images or fail on image constraints when essay has <= 10 words")
    void read_shortEssay_doesNotProcessImages() {
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put("prompt", "Describe the diagram.");
        // Intentionally invalid: 3 images and images disabled
        questionMap.put("images", List.of(
                "https://storage.multilingo.com/img1.png",
                "https://storage.multilingo.com/img2.png",
                "https://storage.multilingo.com/img3.png"
        ));

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
        // Essay with only 5 words:
        List<AttemptAnswer> answers = createAnswers(10, "w_1", "Only five words written here.");

        // Even with images disabled and > 2 images, <= 10 words is Eligible (for 0 score) without processing images
        ContextDecision decision = reader.read(attempt, 10, "w_1", answers);
        assertThat(decision).isInstanceOf(ContextDecision.Eligible.class);
        WritingGradingContext context = ((ContextDecision.Eligible) decision).context();
        assertThat(context.wordCount()).isEqualTo(5);
        assertThat(context.images()).isEmpty();
    }

    @Test
    @DisplayName("toString methods must redact essay, prompt, and image URLs to prevent logging leaks")
    void toString_redactsSensitiveData() {
        String sensitiveEssay = "CONFIDENTIAL_ESSAY_CONTENT_DO_NOT_LOG";
        String sensitivePrompt = "SECRET_PROMPT_DO_NOT_LOG";
        String signedUrl = "https://bucket.s3.amazonaws.com/chart.png?AWSAccessKeyId=AKIAIOSFODNN7EXAMPLE&Signature=vjbyPxybdZaNmGa%2ByT272YEAiv4%3D";

        WritingImageRef imageRef = new WritingImageRef(signedUrl);
        assertThat(imageRef.toString()).doesNotContain("Signature");
        assertThat(imageRef.toString()).doesNotContain("AWSAccessKeyId");
        assertThat(imageRef.toString()).doesNotContain("chart.png");

        WritingGradingContext context = new WritingGradingContext(
                10,
                "w_1",
                "Part 1",
                "Instruction",
                "Group instruction",
                sensitivePrompt,
                sensitiveEssay,
                "en",
                15,
                List.of(imageRef)
        );

        assertThat(context.toString()).doesNotContain(sensitiveEssay);
        assertThat(context.toString()).doesNotContain(sensitivePrompt);
        assertThat(context.toString()).doesNotContain(signedUrl);

        ContextDecision.Eligible eligible = new ContextDecision.Eligible(context);
        assertThat(eligible.toString()).doesNotContain(sensitiveEssay);
        assertThat(eligible.toString()).doesNotContain(sensitivePrompt);

        ContextDecision.Unavailable unavail = new ContextDecision.Unavailable("TEST_REASON", "Safe message");
        assertThat(unavail.toString()).contains("TEST_REASON");
        assertThat(unavail.toString()).doesNotContain(sensitiveEssay);
    }

    @Test
    @DisplayName("P1-01: Spring context wiring with images-enabled=true should produce Eligible with images")
    void p1_01_springWiring_imagesEnabledTrue_returnsEligibleWithImages() {
        try (AnnotationConfigApplicationContext ctx = new AnnotationConfigApplicationContext()) {
            ctx.getEnvironment().getPropertySources().addFirst(new MapPropertySource(
                    "test", Map.of("testing.writing-grading.images-enabled", "true")
            ));
            ctx.register(WritingGradingContextReader.class, WritingHintContextReader.class);
            ctx.refresh();

            WritingGradingContextReader springReader = ctx.getBean(WritingGradingContextReader.class);

            Map<String, Object> questionMap = new LinkedHashMap<>();
            questionMap.put("question_id", "w_1");
            questionMap.put("type", "ESSAY");
            questionMap.put("prompt", "Summarize the chart.");
            questionMap.put("image_url", "https://storage.multilingo.com/exam/chart.png");

            Map<String, Object> partContent = new LinkedHashMap<>();
            partContent.put("questions", List.of(questionMap));

            TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
            String submitted = "The bar chart compares the percentage of renewable energy production across several European countries in recent years.";
            List<AttemptAnswer> answers = createAnswers(10, "w_1", submitted);

            ContextDecision decision = springReader.read(attempt, 10, "w_1", answers);
            assertThat(decision).isInstanceOf(ContextDecision.Eligible.class);
            WritingGradingContext context = ((ContextDecision.Eligible) decision).context();
            assertThat(context.images()).hasSize(1);
            assertThat(context.images().get(0).url()).isEqualTo("https://storage.multilingo.com/exam/chart.png");
        }
    }

    @Test
    @DisplayName("P1-01: Spring context wiring with images-enabled=false should return VISUAL_CONTEXT_UNSUPPORTED")
    void p1_01_springWiring_imagesEnabledFalse_returnsVisualContextUnsupported() {
        try (AnnotationConfigApplicationContext ctx = new AnnotationConfigApplicationContext()) {
            ctx.getEnvironment().getPropertySources().addFirst(new MapPropertySource(
                    "test", Map.of("testing.writing-grading.images-enabled", "false")
            ));
            ctx.register(WritingGradingContextReader.class, WritingHintContextReader.class);
            ctx.refresh();

            WritingGradingContextReader springReader = ctx.getBean(WritingGradingContextReader.class);

            Map<String, Object> questionMap = new LinkedHashMap<>();
            questionMap.put("question_id", "w_1");
            questionMap.put("type", "ESSAY");
            questionMap.put("prompt", "Summarize the chart.");
            questionMap.put("image_url", "https://storage.multilingo.com/exam/chart.png");

            Map<String, Object> partContent = new LinkedHashMap<>();
            partContent.put("questions", List.of(questionMap));

            TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
            String submitted = "The bar chart compares the percentage of renewable energy production across several European countries in recent years.";
            List<AttemptAnswer> answers = createAnswers(10, "w_1", submitted);

            ContextDecision decision = springReader.read(attempt, 10, "w_1", answers);
            assertThat(decision).isInstanceOf(ContextDecision.Unavailable.class);
            assertThat(((ContextDecision.Unavailable) decision).reasonCode()).isEqualTo("VISUAL_CONTEXT_UNSUPPORTED");
        }
    }

    @Test
    @DisplayName("P1-02: Unavailable safeMessage and toString must not echo sentinels from snapshot media type")
    void p1_02_unavailable_malformedMediaType_doesNotLeakSentinelInSafeMessageOrToString() {
        String sentinel = "audio-PRIVATE_URL?signature=SENTINEL_TOKEN";
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put("prompt", "Describe the diagram.");
        questionMap.put("shared_media", Map.of("type", sentinel, "url", "https://storage.multilingo.com/image.png"));

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
        String submitted = "The bar chart compares the percentage of renewable energy production across several European countries in recent years.";
        List<AttemptAnswer> answers = createAnswers(10, "w_1", submitted);

        ContextDecision decision = readerWithImagesEnabled.read(attempt, 10, "w_1", answers);
        assertThat(decision).isInstanceOf(ContextDecision.Unavailable.class);
        ContextDecision.Unavailable unavail = (ContextDecision.Unavailable) decision;
        assertThat(unavail.reasonCode()).isEqualTo("UNSUPPORTED_MEDIA");

        // Verify neither safeMessage nor toString leaks sentinel
        assertThat(unavail.safeMessage()).doesNotContain("SENTINEL_TOKEN");
        assertThat(unavail.safeMessage()).doesNotContain("PRIVATE_URL");
        assertThat(unavail.safeMessage()).doesNotContain("signature");
        assertThat(unavail.toString()).doesNotContain("SENTINEL_TOKEN");
        assertThat(unavail.toString()).doesNotContain("PRIVATE_URL");
        assertThat(unavail.toString()).doesNotContain("signature");
    }

    @Test
    @DisplayName("P1-02: Unavailable safeMessage and toString must not echo sentinels from snapshot language")
    void p1_02_unavailable_malformedLanguage_doesNotLeakSentinelInSafeMessageOrToString() {
        String sentinel = "lang-PRIVATE_URL?signature=SENTINEL_TOKEN";
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put("prompt", "Describe the diagram.");

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot(sentinel, partContent));
        List<AttemptAnswer> answers = createAnswers(10, "w_1", "Some submitted text for the exam attempt.");

        ContextDecision decision = reader.read(attempt, 10, "w_1", answers);
        assertThat(decision).isInstanceOf(ContextDecision.Unavailable.class);
        ContextDecision.Unavailable unavail = (ContextDecision.Unavailable) decision;
        assertThat(unavail.reasonCode()).isEqualTo("UNSUPPORTED_LANGUAGE");

        assertThat(unavail.safeMessage()).doesNotContain("SENTINEL_TOKEN");
        assertThat(unavail.safeMessage()).doesNotContain("PRIVATE_URL");
        assertThat(unavail.safeMessage()).doesNotContain("signature");
        assertThat(unavail.toString()).doesNotContain("SENTINEL_TOKEN");
        assertThat(unavail.toString()).doesNotContain("PRIVATE_URL");
        assertThat(unavail.toString()).doesNotContain("signature");
    }

    @Test
    @DisplayName("P1-03: Empty or blank URL in nonempty media object must return INVALID_IMAGE_URL Unavailable, not Eligible")
    void p1_03_blankUrlInMediaObject_returnsInvalidImageUrlUnavailable() {
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put("prompt", "Analyze the given chart.");
        questionMap.put("shared_media", Map.of("type", "image", "url", ""));

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
        String submitted = "The bar chart compares the percentage of renewable energy production across several European countries in recent years.";
        List<AttemptAnswer> answers = createAnswers(10, "w_1", submitted);

        ContextDecision decision = readerWithImagesEnabled.read(attempt, 10, "w_1", answers);
        assertThat(decision).isInstanceOf(ContextDecision.Unavailable.class);
        assertThat(((ContextDecision.Unavailable) decision).reasonCode()).isEqualTo("INVALID_IMAGE_URL");
    }

    @Test
    @DisplayName("P1-03: Padded whitespace in URL must be preserved raw without trimming")
    void p1_03_paddedUrl_preservesRawUrlWithoutTrimming() {
        String paddedUrl = "  https://storage.multilingo.com/chart.png  ";
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put("prompt", "Analyze the chart.");
        questionMap.put("image_url", paddedUrl);

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
        String submitted = "The bar chart compares the percentage of renewable energy production across several European countries in recent years.";
        List<AttemptAnswer> answers = createAnswers(10, "w_1", submitted);

        ContextDecision decision = readerWithImagesEnabled.read(attempt, 10, "w_1", answers);
        assertThat(decision).isInstanceOf(ContextDecision.Eligible.class);
        WritingGradingContext context = ((ContextDecision.Eligible) decision).context();
        assertThat(context.images()).hasSize(1);
        assertThat(context.images().get(0).url()).isEqualTo(paddedUrl);
    }

    @Test
    @DisplayName("P1-03: Two URLs differing only by whitespace must both be preserved and not deduped")
    void p1_03_twoUrlsDifferingOnlyByWhitespace_bothPreservedAndNotDeduped() {
        String url1 = "https://storage.multilingo.com/chart.png ";
        String url2 = "https://storage.multilingo.com/chart.png";
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put("prompt", "Analyze both charts.");
        questionMap.put("images", List.of(url1, url2));

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
        String submitted = "The bar chart compares the percentage of renewable energy production across several European countries in recent years.";
        List<AttemptAnswer> answers = createAnswers(10, "w_1", submitted);

        ContextDecision decision = readerWithImagesEnabled.read(attempt, 10, "w_1", answers);
        assertThat(decision).isInstanceOf(ContextDecision.Eligible.class);
        WritingGradingContext context = ((ContextDecision.Eligible) decision).context();
        assertThat(context.images()).hasSize(2);
        assertThat(context.images().get(0).url()).isEqualTo(url1);
        assertThat(context.images().get(1).url()).isEqualTo(url2);
    }

    @Test
    @DisplayName("P1-03: Raw URL exceeding 2048 characters must return INVALID_IMAGE_URL")
    void p1_03_rawUrlExceedingCap_returnsInvalidImageUrl() {
        String longUrl = "https://storage.multilingo.com/" + "a".repeat(2030); // > 2048
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put("prompt", "Analyze the chart.");
        questionMap.put("image_url", longUrl);

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
        String submitted = "The bar chart compares the percentage of renewable energy production across several European countries in recent years.";
        List<AttemptAnswer> answers = createAnswers(10, "w_1", submitted);

        ContextDecision decision = readerWithImagesEnabled.read(attempt, 10, "w_1", answers);
        assertThat(decision).isInstanceOf(ContextDecision.Unavailable.class);
        assertThat(((ContextDecision.Unavailable) decision).reasonCode()).isEqualTo("INVALID_IMAGE_URL");
    }

    @Test
    @DisplayName("P1-03 / Short essay rule: Essay with <= 10 words bypasses image extraction even with invalid media URL")
    void p1_03_shortEssay_bypassesInvalidMediaUrl() {
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put("prompt", "Analyze the chart.");
        questionMap.put("shared_media", Map.of("type", "image", "url", "")); // blank URL

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
        String submitted = "Only five short words here.";
        List<AttemptAnswer> answers = createAnswers(10, "w_1", submitted);

        ContextDecision decision = readerWithImagesEnabled.read(attempt, 10, "w_1", answers);
        assertThat(decision).isInstanceOf(ContextDecision.Eligible.class);
        WritingGradingContext context = ((ContextDecision.Eligible) decision).context();
        assertThat(context.wordCount()).isEqualTo(5);
        assertThat(context.images()).isEmpty();
    }

    @Test
    @DisplayName("P2-01: Reuses WritingHintContextReader allowlist and text projection without exposing private fields")
    void p2_01_reusesHintContextReaderAllowlistAndProjections() {
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put("prompt", "Explain how technology changes education.");
        // Sensitive and private fields in snapshot:
        questionMap.put("answer_key", "SENSITIVE_KEY_DO_NOT_EXPOSE");
        questionMap.put("grading_criteria", "PRIVATE_GRADING_CRITERIA");
        questionMap.put("model_answer", "PRIVATE_SAMPLE_ANSWER");

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("title", "Writing Section Part 2");
        partContent.put("instructions", "Spend about 40 minutes on this task.");
        partContent.put("private_admin_notes", "DO_NOT_LEAK_ADMIN_NOTES");
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
        String submitted = "Technology has undeniably transformed modern education in unprecedented and multifaceted ways.";
        List<AttemptAnswer> answers = createAnswers(10, "w_1", submitted);

        ContextDecision decision = reader.read(attempt, 10, "w_1", answers);
        assertThat(decision).isInstanceOf(ContextDecision.Eligible.class);
        WritingGradingContext context = ((ContextDecision.Eligible) decision).context();

        assertThat(context.partTitle()).isEqualTo("Writing Section Part 2");
        assertThat(context.partInstruction()).isEqualTo("Spend about 40 minutes on this task.");
        assertThat(context.taskPrompt()).isEqualTo("Explain how technology changes education.");
        assertThat(context.originalText()).isEqualTo(submitted);

        // Verify that the context object or its string representation never contains sensitive keys
        String str = context.toString();
        assertThat(str).doesNotContain("SENSITIVE_KEY_DO_NOT_EXPOSE");
        assertThat(str).doesNotContain("PRIVATE_GRADING_CRITERIA");
        assertThat(str).doesNotContain("DO_NOT_LEAK_ADMIN_NOTES");
    }

    @ParameterizedTest
    @ValueSource(strings = {"question_text", "content", "title", "text", "prompt"})
    @DisplayName("P1-04: Supported prompt aliases containing <img> with 11 words essay must return UNSUPPORTED_MEDIA for both imagesEnabled=true and false")
    void p1_04_promptAliasesWithImgTag_longEssay_returnsUnsupportedMedia(String aliasKey) {
        String htmlWithImg = "Describe <img src='https://cdn.example.test/chart.png'> and write an essay.";
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put(aliasKey, htmlWithImg);

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
        String submitted = "The bar chart compares the percentage of renewable energy production across several European countries in recent years."; // 18 words
        List<AttemptAnswer> answers = createAnswers(10, "w_1", submitted);

        // Test with imagesEnabled = false
        ContextDecision decisionFalse = reader.read(attempt, 10, "w_1", answers);
        assertThat(decisionFalse).isInstanceOf(ContextDecision.Unavailable.class);
        assertThat(((ContextDecision.Unavailable) decisionFalse).reasonCode()).isEqualTo("UNSUPPORTED_MEDIA");

        // Test with imagesEnabled = true
        ContextDecision decisionTrue = readerWithImagesEnabled.read(attempt, 10, "w_1", answers);
        assertThat(decisionTrue).isInstanceOf(ContextDecision.Unavailable.class);
        assertThat(((ContextDecision.Unavailable) decisionTrue).reasonCode()).isEqualTo("UNSUPPORTED_MEDIA");
    }

    @ParameterizedTest
    @ValueSource(strings = {"question_text", "content", "title", "text", "prompt"})
    @DisplayName("P1-04: Supported prompt aliases containing <img> with <= 10 words essay bypasses image checks and returns Eligible with empty images")
    void p1_04_promptAliasesWithImgTag_shortEssay_returnsEligible(String aliasKey) {
        String htmlWithImg = "Describe <img src='https://cdn.example.test/chart.png'> and write an essay.";
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put(aliasKey, htmlWithImg);

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
        String submitted = "Only five words written here."; // 5 words <= 10
        List<AttemptAnswer> answers = createAnswers(10, "w_1", submitted);

        ContextDecision decision = readerWithImagesEnabled.read(attempt, 10, "w_1", answers);
        assertThat(decision).isInstanceOf(ContextDecision.Eligible.class);
        WritingGradingContext context = ((ContextDecision.Eligible) decision).context();
        assertThat(context.wordCount()).isEqualTo(5);
        assertThat(context.images()).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"instruction", "instructions", "description", "context"})
    @DisplayName("P1-04: Supported part instruction aliases containing <img> with 11 words essay must return UNSUPPORTED_MEDIA")
    void p1_04_partInstructionAliasesWithImgTag_returnsUnsupportedMedia(String instructionKey) {
        String htmlWithImg = "Look at <img src='https://cdn.example.test/chart.png'> and follow instructions.";
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put("prompt", "Summarize the chart.");

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put(instructionKey, htmlWithImg);
        partContent.put("questions", List.of(questionMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
        String submitted = "The bar chart compares the percentage of renewable energy production across several European countries in recent years."; // 18 words
        List<AttemptAnswer> answers = createAnswers(10, "w_1", submitted);

        ContextDecision decision = readerWithImagesEnabled.read(attempt, 10, "w_1", answers);
        assertThat(decision).isInstanceOf(ContextDecision.Unavailable.class);
        assertThat(((ContextDecision.Unavailable) decision).reasonCode()).isEqualTo("UNSUPPORTED_MEDIA");
    }

    @ParameterizedTest
    @ValueSource(strings = {"instruction", "instructions", "context", "passage", "description"})
    @DisplayName("P1-04: Supported group instruction aliases containing <img> with 11 words essay must return UNSUPPORTED_MEDIA")
    void p1_04_groupInstructionAliasesWithImgTag_returnsUnsupportedMedia(String groupInstructionKey) {
        String htmlWithImg = "Group instructions: <img src='https://cdn.example.test/chart.png'>";
        Map<String, Object> questionMap = new LinkedHashMap<>();
        questionMap.put("question_id", "w_1");
        questionMap.put("type", "ESSAY");
        questionMap.put("prompt", "Summarize the chart.");

        Map<String, Object> groupMap = new LinkedHashMap<>();
        groupMap.put("group_id", "g_1");
        groupMap.put(groupInstructionKey, htmlWithImg);
        groupMap.put("questions", List.of(questionMap));

        Map<String, Object> partContent = new LinkedHashMap<>();
        partContent.put("question_groups", List.of(groupMap));

        TestAttempt attempt = createAttempt(createWritingSnapshot("en", partContent));
        String submitted = "The bar chart compares the percentage of renewable energy production across several European countries in recent years."; // 18 words
        List<AttemptAnswer> answers = createAnswers(10, "w_1", submitted);

        ContextDecision decision = readerWithImagesEnabled.read(attempt, 10, "w_1", answers);
        assertThat(decision).isInstanceOf(ContextDecision.Unavailable.class);
        assertThat(((ContextDecision.Unavailable) decision).reasonCode()).isEqualTo("UNSUPPORTED_MEDIA");
    }
}
