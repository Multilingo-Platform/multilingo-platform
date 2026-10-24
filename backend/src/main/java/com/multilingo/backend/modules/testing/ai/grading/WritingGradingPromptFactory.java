package com.multilingo.backend.modules.testing.ai.grading;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiClientException;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiGenerationRequest;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiImagePart;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiPayloadCodec;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiProperties;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Builds validated {@link GeminiGenerationRequest} payloads for writing grading.
 * Separates immutable system instruction from unverified learner/exam text formatted as JSON.
 */
@Component
public class WritingGradingPromptFactory {

    private static final String PROMPT_RESOURCE_PATH = "prompts/writing-grading-en-v2.txt";
    private static final String GENERIC_PROMPT_RESOURCE_PATH = "prompts/writing-grading-generic-v1.txt";
    private static final String EN_MULTILINGUAL_PROMPT_RESOURCE_PATH = "prompts/writing-grading-en-multilingual-feedback-v1.txt";
    public static final int MAX_OUTPUT_TOKENS = 8192;

    private final String systemInstructionTemplate;
    private final ObjectMapper objectMapper;
    private final GeminiPayloadCodec payloadCodec;

    public WritingGradingPromptFactory() {
        this.systemInstructionTemplate = loadPromptTemplate();
        this.objectMapper = new ObjectMapper();
        this.payloadCodec = new GeminiPayloadCodec();
    }

    public void preflightText(WritingGradingContext context) {
        if (context == null) {
            throw new IllegalArgumentException("WritingGradingContext must not be null");
        }
        String userText = serializeUserText(context);
        long textBytes = (long) userText.getBytes(StandardCharsets.UTF_8).length
                + systemInstructionFor(context).getBytes(StandardCharsets.UTF_8).length;
        if (textBytes > GeminiProperties.MAX_TEXT_BYTES_WITH_IMAGES) {
            throw new WritingGradingException(
                    WritingGradingFailure.terminal("INVALID_INPUT", "Prompt and essay text exceeds maximum size limit")
            );
        }
    }

    public GeminiGenerationRequest build(WritingGradingContext context, List<GeminiImagePart> images) {
        if (context == null) {
            throw new IllegalArgumentException("WritingGradingContext must not be null");
        }

        String userText = serializeUserText(context);
        List<GeminiImagePart> imageList = (images == null) ? List.of() : List.copyOf(images);

        // Construction and encoding share the same classified input boundary.
        try {
            GeminiGenerationRequest request = new GeminiGenerationRequest(
                    systemInstructionFor(context),
                    userText,
                    MAX_OUTPUT_TOKENS,
                    GeminiGenerationRequest.OutputFormat.JSON,
                    imageList
            );

            payloadCodec.encode(request);
            return request;
        } catch (GeminiClientException e) {
            throw new WritingGradingException(
                    WritingGradingFailure.terminal("INVALID_INPUT", "Grading request payload exceeds allowed boundaries")
            );
        }
    }

    public String serializeUserText(WritingGradingContext context) {
        ObjectNode rootNode = objectMapper.createObjectNode();
        WritingRubricPolicy policy = context.rubricPolicy();
        rootNode.put("rubricCode", policy == null ? WritingGrade.DEFAULT_RUBRIC : policy.rubricCode());
        rootNode.put("learningLanguage", context.learningLanguage() != null ? context.learningLanguage() : "en");
        rootNode.put("feedbackLanguage", context.feedbackLanguage() != null ? context.feedbackLanguage() : WritingGrade.DEFAULT_LANGUAGE);
        if (context.lengthMetric() != null) {
            rootNode.put("lengthMetric", objectMapper.valueToTree(context.lengthMetric()));
        }

        ObjectNode taskNode = rootNode.putObject("task");
        if (context.partTitle() != null) {
            taskNode.put("partTitle", context.partTitle());
        }
        if (context.partInstruction() != null) {
            taskNode.put("partInstruction", context.partInstruction());
        }
        if (context.groupInstruction() != null) {
            taskNode.put("groupInstruction", context.groupInstruction());
        }
        taskNode.put("taskPrompt", context.taskPrompt() != null ? context.taskPrompt() : "");

        rootNode.put("originalEssay", context.originalText() != null ? context.originalText() : "");
        rootNode.put("wordCount", context.wordCount());

        return rootNode.toString();
    }

    private String loadPromptTemplate() {
        return loadPromptTemplate(PROMPT_RESOURCE_PATH);
    }

    private String systemInstructionFor(WritingGradingContext context) {
        WritingRubricPolicy policy = context.rubricPolicy();
        if (policy == null) return systemInstructionTemplate;
        String resource = WritingRubricRegistry.GENERIC_RUBRIC.equals(policy.rubricCode())
                ? GENERIC_PROMPT_RESOURCE_PATH
                : "vi".equalsIgnoreCase(context.feedbackLanguage()) ? PROMPT_RESOURCE_PATH : EN_MULTILINGUAL_PROMPT_RESOURCE_PATH;
        return loadPromptTemplate(resource);
    }

    private String loadPromptTemplate(String path) {
        ClassPathResource resource = new ClassPathResource(path);
        try (InputStream is = resource.getInputStream()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8).trim();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to load writing grading prompt template from classpath: " + path, e);
        }
    }
}
