package com.multilingo.backend.modules.testing.ai.dictionary;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Set;

@Component
public class DictionaryLookupOutputParser {
    public static final int MAX_OUTPUT_BYTES = 8 * 1024;
    private static final Set<String> FIELDS = Set.of("meaningVi", "phonetic", "partOfSpeech", "exampleEn", "exampleVi");
    private final ObjectMapper mapper = JsonMapper.builder().enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION).build();

    public DictionaryLookupDefinition parse(String output) {
        if (output == null || output.isBlank() || output.contains("```")) throw invalid();
        byte[] bytes = output.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_OUTPUT_BYTES) throw invalid();
        JsonNode root;
        try (JsonParser parser = mapper.createParser(bytes)) {
            root = mapper.readTree(parser);
            if (root == null || parser.nextToken() != null) throw invalid();
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            throw invalid();
        }
        if (!root.isObject()) throw invalid();
        Iterator<String> fields = root.fieldNames();
        while (fields.hasNext()) if (!FIELDS.contains(fields.next())) throw invalid();
        String meaning = required(root, "meaningVi", 1000);
        String exampleEn = required(root, "exampleEn", 1000);
        String exampleVi = required(root, "exampleVi", 1000);
        return new DictionaryLookupDefinition(meaning, optional(root, "phonetic", 150),
                optional(root, "partOfSpeech", 50), exampleEn, exampleVi);
    }

    private String required(JsonNode root, String key, int maxCodePoints) {
        String value = optional(root, key, maxCodePoints);
        if (value == null || value.isBlank()) throw invalid();
        return value;
    }

    private String optional(JsonNode root, String key, int maxCodePoints) {
        JsonNode node = root.get(key);
        if (node == null || node.isNull()) return null;
        if (!node.isTextual()) throw invalid();
        String value = node.textValue().strip();
        if (value.codePointCount(0, value.length()) > maxCodePoints) throw invalid();
        return value;
    }

    private static AppException invalid() {
        return new AppException(ErrorCode.DICTIONARY_LOOKUP_INVALID_RESPONSE);
    }
}
