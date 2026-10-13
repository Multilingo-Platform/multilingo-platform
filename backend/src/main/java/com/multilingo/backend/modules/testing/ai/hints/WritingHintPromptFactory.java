package com.multilingo.backend.modules.testing.ai.hints;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiGenerationRequest;
import com.multilingo.backend.modules.testing.service.support.WritingHintContextReader;
import com.multilingo.backend.modules.testing.service.support.WritingHintLanguageResolver;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Xây dựng GeminiGenerationRequest an toàn cho Writing Hints.
 * Phân tách system instruction tĩnh khỏi user prompt chứa dữ liệu đề bài không đáng tin cậy.
 */
@Component
public class WritingHintPromptFactory {

    private static final String PROMPT_RESOURCE_PATH = "prompts/writing-hints-v1.txt";
    private static final int MAX_OUTPUT_TOKENS = 4096;

    private final String systemInstructionTemplate;
    private final ObjectMapper objectMapper;

    public WritingHintPromptFactory() {
        this.systemInstructionTemplate = loadPromptTemplate();
        this.objectMapper = new ObjectMapper();
    }

    public GeminiGenerationRequest build(
            WritingHintContextReader.HintContext context,
            WritingHintLanguageResolver.ResolvedLanguages languages
    ) {
        if (context == null || languages == null) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "context and languages must not be null");
        }

        ObjectNode rootNode = objectMapper.createObjectNode();
        rootNode.put("learningLanguage", languages.learningLanguage());
        rootNode.put("hintLanguage", languages.hintLanguage());
        rootNode.put("visualContext", context.hasVisualContext());

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
        taskNode.put("taskPrompt", context.taskPrompt());

        String userText = rootNode.toString();

        return new GeminiGenerationRequest(
                systemInstructionTemplate,
                userText,
                MAX_OUTPUT_TOKENS,
                GeminiGenerationRequest.OutputFormat.JSON
        );
    }

    private String loadPromptTemplate() {
        ClassPathResource resource = new ClassPathResource(PROMPT_RESOURCE_PATH);
        try (InputStream is = resource.getInputStream()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8).trim();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to load prompt template from " + PROMPT_RESOURCE_PATH, e);
        }
    }
}
