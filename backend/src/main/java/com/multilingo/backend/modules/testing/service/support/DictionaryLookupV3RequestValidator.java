package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupV3Request;
import com.multilingo.backend.modules.testing.dto.request.WorkspaceTextSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Iterator;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Component
public class DictionaryLookupV3RequestValidator {
    public static final int MAX_REQUEST_BODY_BYTES = 16 * 1024;
    public static final int MAX_SELECTED_CODE_POINTS = 80;
    public static final int MAX_CONTEXT_CODE_POINTS = 1_000;
    private static final Pattern UUID_PATTERN = Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
    private static final Pattern WORD = Pattern.compile("[\\p{L}\\p{M}\\p{N}]+(?:['’\\-‐‑‒–—][\\p{L}\\p{M}\\p{N}]+)*");
    private static final Set<String> ALLOWED_ROOT_FIELDS = Set.of(
            "requestId", "partId", "source", "selectedText", "contextText"
    );

    private final ObjectMapper mapper;
    private final LearningLanguageCatalog languages;

    @Autowired
    public DictionaryLookupV3RequestValidator(LearningLanguageCatalog languages) {
        this(JsonMapper.builder().enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION).build(), languages);
    }

    public DictionaryLookupV3RequestValidator(ObjectMapper mapper, LearningLanguageCatalog languages) {
        this.mapper = JsonMapper.builder(mapper.copy().getFactory())
                .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION).build();
        this.languages = languages;
    }

    public DictionaryLookupV3Request read(InputStream input) {
        if (input == null) throw invalid();
        byte[] bytes = readBounded(input);
        if (bytes.length == 0) throw invalid();

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

        // Enforce strict root fields: reject language, user ID, client identity or any arbitrary field
        Iterator<String> names = root.fieldNames();
        while (names.hasNext()) {
            if (!ALLOWED_ROOT_FIELDS.contains(names.next())) throw invalid();
        }

        String rawRequestId = text(root, "requestId");
        if (!UUID_PATTERN.matcher(rawRequestId).matches()) throw invalid();
        String normalizedId;
        try {
            normalizedId = UUID.fromString(rawRequestId).toString().toLowerCase(Locale.ROOT);
        } catch (IllegalArgumentException e) {
            throw invalid();
        }

        JsonNode partNode = root.get("partId");
        if (partNode == null || !partNode.isIntegralNumber() || !partNode.canConvertToInt() || partNode.intValue() < 1) {
            throw invalid();
        }
        int partId = partNode.intValue();

        JsonNode sourceNode = root.get("source");
        if (sourceNode == null || !sourceNode.isObject()) throw invalid();
        WorkspaceTextSource source;
        try {
            source = mapper.treeToValue(sourceNode, WorkspaceTextSource.class);
        } catch (Exception e) {
            throw invalid();
        }
        if (source == null) throw invalid();

        String selectedText = text(root, "selectedText");
        String contextText = text(root, "contextText");

        return validate(new DictionaryLookupV3Request(normalizedId, partId, source, selectedText, contextText), null);
    }

    public DictionaryLookupV3Request validate(DictionaryLookupV3Request request) {
        return validate(request, null);
    }

    public DictionaryLookupV3Request validate(DictionaryLookupV3Request request, String sourceLanguage) {
        if (request == null || request.requestId() == null || !UUID_PATTERN.matcher(request.requestId()).matches()
                || request.partId() == null || request.partId() < 1 || request.source() == null
                || request.selectedText() == null || request.contextText() == null) {
            throw invalid();
        }

        String selected = request.selectedText();
        int length = selected.codePointCount(0, selected.length());
        if (selected.isBlank() || !selected.equals(selected.strip()) || length > MAX_SELECTED_CODE_POINTS || hasControl(selected)) {
            throw invalid();
        }

        String normalizedSource = sourceLanguage == null ? null : languages.findNormalized(sourceLanguage)
                .orElseThrow(DictionaryLookupV3RequestValidator::invalid);
        String base = normalizedSource == null ? null : normalizedSource.split("-")[0];
        if (base == null || Set.of("zh", "ja").contains(base)) {
            if (length < 1) throw invalid();
        } else {
            var matcher = WORD.matcher(selected);
            int count = 0;
            while (matcher.find()) count++;
            if (count < 1 || count > 5) throw invalid();
        }

        String context = request.contextText();
        int contextLength = context.codePointCount(0, context.length());
        if (context.isBlank() || !context.equals(context.strip()) || contextLength > MAX_CONTEXT_CODE_POINTS || hasControl(context)) {
            throw invalid();
        }

        return request;
    }

    public Integer parseAttemptId(String raw) {
        if (raw == null || !raw.matches("[1-9][0-9]{0,9}")) throw invalid();
        try {
            int value = Integer.parseInt(raw);
            return value > 0 ? value : throwInvalid();
        } catch (NumberFormatException e) {
            throw invalid();
        }
    }

    private byte[] readBounded(InputStream input) {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] chunk = new byte[2048];
        try {
            int count;
            while ((count = input.read(chunk)) != -1) {
                if (output.size() + count > MAX_REQUEST_BODY_BYTES) {
                    throw new AppException(ErrorCode.DICTIONARY_LOOKUP_REQUEST_TOO_LARGE);
                }
                output.write(chunk, 0, count);
            }
        } catch (AppException e) {
            throw e;
        } catch (IOException e) {
            throw invalid();
        }
        return output.toByteArray();
    }

    private static String text(JsonNode root, String name) {
        JsonNode node = root.get(name);
        if (node == null || !node.isTextual()) throw invalid();
        return node.textValue();
    }

    private static boolean hasControl(String value) {
        return value.codePoints().anyMatch(Character::isISOControl);
    }

    private static int throwInvalid() { throw invalid(); }

    private static AppException invalid() {
        return new AppException(ErrorCode.VALIDATION_FAILED, "Dictionary lookup request is invalid");
    }
}
