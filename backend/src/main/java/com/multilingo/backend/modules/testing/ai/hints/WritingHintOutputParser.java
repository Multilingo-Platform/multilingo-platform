package com.multilingo.backend.modules.testing.ai.hints;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import com.multilingo.backend.modules.testing.dto.response.WritingHintsResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Phân tích cú pháp và xác thực nghiêm ngặt phản hồi JSON từ Gemini cho Writing Hints.
 * Đảm bảo giới hạn 32 KiB, schema hợp lệ, biên từ vựng 5–10 items, term unique, và quy tắc limitations.
 */
@Component
@RequiredArgsConstructor
public class WritingHintOutputParser {

    public static final int MAX_OUTPUT_BYTES = 32 * 1024; // 32 KiB = 32,768 bytes
    public static final String UNKNOWN_PROPERTY_MESSAGE = "Unknown property in AI output";
    public static final String DUPLICATE_VOCABULARY_TERM_MESSAGE = "Duplicate vocabulary term in AI output";

    private static final Set<String> ALLOWED_ROOT_FIELDS = Set.of(
            "hintLanguage", "outline", "vocabulary", "limitations"
    );
    private static final Set<String> ALLOWED_OUTLINE_FIELDS = Set.of("title", "points");
    private static final Set<String> ALLOWED_VOCAB_FIELDS = Set.of("term", "definition", "explanation", "example");

    private final LearningLanguageCatalog catalog;
    private final ObjectMapper objectMapper = JsonMapper.builder()
            .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
            .build();

    public WritingHintsResponse.Content parse(String output, String expectedHintLanguage, boolean visualContext) {
        if (output == null || output.isBlank()) {
            throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "AI output is null or blank");
        }

        byte[] outputBytes = output.getBytes(StandardCharsets.UTF_8);
        if (outputBytes.length > MAX_OUTPUT_BYTES) {
            throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "AI output exceeds 32 KiB limit");
        }

        if (output.contains("```")) {
            throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "Markdown code fences are not permitted");
        }

        JsonNode root;
        try (JsonParser parser = objectMapper.createParser(outputBytes)) {
            root = objectMapper.readTree(parser);
            if (root == null || parser.nextToken() != null) {
                throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "Trailing JSON content is not allowed");
            }
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "Failed to parse AI output JSON");
        }

        if (!root.isObject()) {
            throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "AI output must be a JSON object");
        }

        // Kiểm tra unknown fields ở root
        Iterator<String> rootFields = root.fieldNames();
        while (rootFields.hasNext()) {
            String field = rootFields.next();
            if (!ALLOWED_ROOT_FIELDS.contains(field)) {
                throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, UNKNOWN_PROPERTY_MESSAGE);
            }
        }

        // 1. hintLanguage validation
        JsonNode hintLangNode = root.get("hintLanguage");
        if (hintLangNode == null || !hintLangNode.isTextual() || hintLangNode.textValue().isBlank()) {
            throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "hintLanguage must be a non-blank string");
        }
        String normalizedResponseLang;
        String normalizedExpectedLang;
        try {
            normalizedResponseLang = catalog.normalize(hintLangNode.textValue());
            normalizedExpectedLang = catalog.normalize(expectedHintLanguage);
        } catch (Exception e) {
            throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "hintLanguage in response is invalid or unsupported");
        }
        if (!normalizedResponseLang.equalsIgnoreCase(normalizedExpectedLang)) {
            throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "hintLanguage in response does not match expected hintLanguage");
        }

        // 2. outline validation (2–8 sections, 1–6 points/section)
        JsonNode outlineNode = root.get("outline");
        if (outlineNode == null || !outlineNode.isArray()) {
            throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "outline must be a JSON array");
        }
        int sectionCount = outlineNode.size();
        if (sectionCount < 2 || sectionCount > 8) {
            throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "outline must have between 2 and 8 sections");
        }

        List<WritingHintsResponse.OutlineSection> outlineList = new ArrayList<>(sectionCount);
        for (JsonNode sectionNode : outlineNode) {
            if (!sectionNode.isObject()) {
                throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "outline section must be a JSON object");
            }
            Iterator<String> secFields = sectionNode.fieldNames();
            while (secFields.hasNext()) {
                if (!ALLOWED_OUTLINE_FIELDS.contains(secFields.next())) {
                    throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "Unknown property in outline section");
                }
            }

            JsonNode titleNode = sectionNode.get("title");
            if (titleNode == null || !titleNode.isTextual() || titleNode.textValue().isBlank()) {
                throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "section title must be a non-blank string");
            }
            String title = titleNode.textValue().trim();
            if (title.length() > 200) {
                throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "section title exceeds 200 characters");
            }

            JsonNode pointsNode = sectionNode.get("points");
            if (pointsNode == null || !pointsNode.isArray()) {
                throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "section points must be a JSON array");
            }
            int pointsCount = pointsNode.size();
            if (pointsCount < 1 || pointsCount > 6) {
                throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "section points must have between 1 and 6 points");
            }

            List<String> pointsList = new ArrayList<>(pointsCount);
            for (JsonNode pointNode : pointsNode) {
                if (!pointNode.isTextual() || pointNode.textValue().isBlank()) {
                    throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "point must be a non-blank string");
                }
                String point = pointNode.textValue().trim();
                if (point.length() > 1000) {
                    throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "point exceeds 1000 characters");
                }
                pointsList.add(point);
            }

            outlineList.add(new WritingHintsResponse.OutlineSection(title, Collections.unmodifiableList(pointsList)));
        }

        // 3. vocabulary validation (5–10 items, term unique sau trim/case-fold)
        JsonNode vocabNode = root.get("vocabulary");
        if (vocabNode == null || !vocabNode.isArray()) {
            throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "vocabulary must be a JSON array");
        }
        int vocabCount = vocabNode.size();
        if (vocabCount < 5 || vocabCount > 10) {
            throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "vocabulary must have between 5 and 10 items");
        }

        List<WritingHintsResponse.VocabularyItem> vocabList = new ArrayList<>(vocabCount);
        Set<String> seenTerms = new HashSet<>();

        for (JsonNode itemNode : vocabNode) {
            if (!itemNode.isObject()) {
                throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "vocabulary item must be a JSON object");
            }
            Iterator<String> itemFields = itemNode.fieldNames();
            while (itemFields.hasNext()) {
                if (!ALLOWED_VOCAB_FIELDS.contains(itemFields.next())) {
                    throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "Unknown property in vocabulary item");
                }
            }

            String term = validateTextField(itemNode, "term", 200);
            String definition = validateTextField(itemNode, "definition", 1000);
            String explanation = validateTextField(itemNode, "explanation", 1000);
            String example = validateTextField(itemNode, "example", 2000);

            String termKey = term.trim().toLowerCase(Locale.ROOT);
            if (!seenTerms.add(termKey)) {
                throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, DUPLICATE_VOCABULARY_TERM_MESSAGE);
            }

            vocabList.add(new WritingHintsResponse.VocabularyItem(term, definition, explanation, example));
        }

        // 4. limitations validation (0–5 items, tối thiểu 1 item nếu visualContext = true)
        JsonNode limitNode = root.get("limitations");
        List<String> limitationsList = new ArrayList<>();
        if (limitNode != null) {
            if (!limitNode.isArray()) {
                throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "limitations must be a JSON array");
            }
            if (limitNode.size() > 5) {
                throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "limitations must not exceed 5 items");
            }
            for (JsonNode item : limitNode) {
                if (!item.isTextual() || item.textValue().isBlank()) {
                    throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "limitation item must be a non-blank string");
                }
                String limitation = item.textValue().trim();
                if (limitation.length() > 1000) {
                    throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "limitation item exceeds 1000 characters");
                }
                limitationsList.add(limitation);
            }
        }

        if (visualContext && limitationsList.isEmpty()) {
            throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "Task with visual context requires at least one limitation");
        }

        return new WritingHintsResponse.Content(
                Collections.unmodifiableList(outlineList),
                Collections.unmodifiableList(vocabList),
                Collections.unmodifiableList(limitationsList)
        );
    }

    private String validateTextField(JsonNode parent, String fieldName, int maxLength) {
        JsonNode node = parent.get(fieldName);
        if (node == null || !node.isTextual() || node.textValue().isBlank()) {
            throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, fieldName + " must be a non-blank string");
        }
        String text = node.textValue().trim();
        if (text.length() > maxLength) {
            throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, fieldName + " exceeds " + maxLength + " characters");
        }
        return text;
    }
}
