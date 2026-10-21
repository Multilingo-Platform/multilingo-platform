package com.multilingo.backend.modules.testing.ai.dictionary;

import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Set;

@Component
public class DictionaryLookupV2OutputParser {
    private static final Set<String> FIELDS = Set.of("meaning", "phonetic", "partOfSpeech", "example", "exampleTranslation");
    private final com.fasterxml.jackson.databind.ObjectMapper mapper = JsonMapper.builder().enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION).build();

    public DictionaryLookupDefinitionV2 parse(String output) {
        try {
            if (output == null || output.isBlank() || output.contains("```") || output.getBytes(StandardCharsets.UTF_8).length > 8192) throw invalid();
            JsonNode root;
            try (com.fasterxml.jackson.core.JsonParser parser = mapper.createParser(output)) {
                root = mapper.readTree(parser);
                if (root == null || !root.isObject()) throw invalid();
                if (parser.nextToken() != null) throw invalid();
            }
            Iterator<String> it = root.fieldNames(); while (it.hasNext()) if (!FIELDS.contains(it.next())) throw invalid();
            return new DictionaryLookupDefinitionV2(required(root, "meaning", 1000), optional(root, "phonetic", 150),
                    optional(root, "partOfSpeech", 50), required(root, "example", 1000), required(root, "exampleTranslation", 1000));
        } catch (AppException e) { throw e; }
        catch (Exception e) { throw invalid(); }
    }
    private String required(JsonNode n, String key, int max) { String v = optional(n, key, max); if (v == null || v.isBlank()) throw invalid(); return v; }
    private String optional(JsonNode n, String key, int max) {
        JsonNode v = n.get(key); if (v == null || v.isNull()) return null;
        if (!v.isTextual()) throw invalid(); String s = v.textValue().strip();
        if (s.codePointCount(0, s.length()) > max) throw invalid(); return s;
    }
    private static AppException invalid() { return new AppException(ErrorCode.DICTIONARY_LOOKUP_INVALID_RESPONSE); }
    public record DictionaryLookupDefinitionV2(String meaning, String phonetic, String partOfSpeech, String example, String exampleTranslation) { }
}
