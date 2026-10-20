package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupRequest;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Iterator;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

@Component
public class DictionaryLookupRequestValidator {
    public static final int MAX_REQUEST_BODY_BYTES = 16 * 1024;
    public static final int MAX_CONTEXT_CODE_POINTS = 1_000;
    public static final int MAX_SELECTED_CODE_POINTS = 80;
    private static final Pattern UUID_PATTERN = Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
    private static final Pattern WORD_PATTERN = Pattern.compile("[\\p{L}\\p{M}\\p{N}]+(?:['’\\-‐‑‒–—][\\p{L}\\p{M}\\p{N}]+)*");
    private static final Set<String> FIELDS = Set.of("requestId", "partId", "documentId", "selectedText", "contextText");
    private final ObjectMapper mapper = JsonMapper.builder().enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION).build();

    public DictionaryLookupRequest read(InputStream body) {
        if (body == null) throw invalid();
        byte[] bytes = readBounded(body);
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
        Iterator<String> names = root.fieldNames();
        while (names.hasNext()) if (!FIELDS.contains(names.next())) throw invalid();

        String requestId = text(root, "requestId");
        if (!UUID_PATTERN.matcher(requestId).matches()) throw invalid();
        String normalizedId;
        try {
            normalizedId = UUID.fromString(requestId).toString().toLowerCase(Locale.ROOT);
        } catch (IllegalArgumentException e) {
            throw invalid();
        }
        JsonNode part = root.get("partId");
        if (part == null || !part.isIntegralNumber() || !part.canConvertToInt() || part.intValue() < 1) throw invalid();
        String documentId = text(root, "documentId");
        if (documentId.length() > 128 || !documentId.equals(documentId.strip()) || hasControl(documentId)) throw invalid();
        return validate(new DictionaryLookupRequest(normalizedId, part.intValue(), documentId,
                text(root, "selectedText"), text(root, "contextText")));
    }

    public DictionaryLookupRequest validate(DictionaryLookupRequest request) {
        if (request == null || request.requestId() == null || !UUID_PATTERN.matcher(request.requestId()).matches()
                || request.partId() == null || request.partId() < 1
                || request.documentId() == null || request.documentId().isBlank()
                || request.documentId().length() > 128 || !request.documentId().equals(request.documentId().strip())
                || request.selectedText() == null || request.contextText() == null) throw invalid();
        String selected = request.selectedText();
        String context = request.contextText();
        if (!selected.equals(selected.strip()) || selected.isBlank() || hasControl(selected)
                || selected.codePointCount(0, selected.length()) > MAX_SELECTED_CODE_POINTS) throw invalid();
        Matcher matcher = WORD_PATTERN.matcher(selected);
        int wordCount = 0;
        while (matcher.find()) wordCount++;
        if (wordCount == 0 || wordCount > 5) throw invalid();
        if (!context.equals(context.strip()) || context.isBlank() || hasControl(context)
                || context.codePointCount(0, context.length()) > MAX_CONTEXT_CODE_POINTS) throw invalid();
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

    private String text(JsonNode root, String name) {
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
