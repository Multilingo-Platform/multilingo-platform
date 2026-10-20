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
                + systemInstructionTemplate.getBytes(StandardCharsets.UTF_8).length;
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
                    systemInstructionTemplate,
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
        rootNode.put("rubricCode", WritingGrade.DEFAULT_RUBRIC);
        rootNode.put("learningLanguage", context.learningLanguage() != null ? context.learningLanguage() : "en");
        rootNode.put("feedbackLanguage", WritingGrade.DEFAULT_LANGUAGE);

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
        ClassPathResource resource = new ClassPathResource(PROMPT_RESOURCE_PATH);
        try (InputStream is = resource.getInputStream()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8).trim();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to load writing grading prompt template from classpath: " + PROMPT_RESOURCE_PATH, e);
        }
    }
}
