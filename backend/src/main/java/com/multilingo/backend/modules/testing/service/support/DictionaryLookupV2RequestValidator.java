package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import org.springframework.beans.factory.annotation.Autowired;
import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupV2Request;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.Iterator;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Component
public class DictionaryLookupV2RequestValidator {
    private static final Pattern UUID_PATTERN = Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
    private static final Pattern WORD = Pattern.compile("[\\p{L}\\p{M}\\p{N}]+(?:['’\\-‐‑‒–—][\\p{L}\\p{M}\\p{N}]+)*");
    private static final Set<String> FIELDS = Set.of("requestId", "partId", "documentId", "selectedText", "contextText", "meaningLanguage");
    private final ObjectMapper mapper;
    private final LearningLanguageCatalog languages;

    @Autowired
    public DictionaryLookupV2RequestValidator(LearningLanguageCatalog languages) {
        this(JsonMapper.builder().enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION).build(), languages);
    }
    public DictionaryLookupV2RequestValidator(ObjectMapper mapper, LearningLanguageCatalog languages) {
        this.mapper = JsonMapper.builder(mapper.copy().getFactory())
                .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION).build();
        this.languages = languages;
    }

    public DictionaryLookupV2Request read(InputStream input) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[2048]; int n;
            while ((n = input.read(buffer)) >= 0) {
                if (out.size() + n > 16 * 1024) throw invalid();
                out.write(buffer, 0, n);
            }
            JsonNode root = mapper.readTree(out.toByteArray());
            if (root == null || !root.isObject()) throw invalid();
            Iterator<String> names = root.fieldNames(); while (names.hasNext()) if (!FIELDS.contains(names.next())) throw invalid();
            String id = text(root, "requestId");
            if (!UUID_PATTERN.matcher(id).matches()) throw invalid();
            int part = root.path("partId").canConvertToInt() && root.path("partId").isIntegralNumber() ? root.path("partId").intValue() : 0;
            if (part <= 0) throw invalid();
            String meaningLanguage = optionalText(root, "meaningLanguage");
            if (meaningLanguage != null) meaningLanguage = languages.findNormalized(meaningLanguage).orElseThrow(DictionaryLookupV2RequestValidator::invalid);
            return validate(new DictionaryLookupV2Request(UUID.fromString(id).toString(), part, text(root, "documentId"),
                    text(root, "selectedText"), text(root, "contextText"), meaningLanguage), null);
        } catch (AppException e) { throw e; }
        catch (Exception e) { throw invalid(); }
    }

    public DictionaryLookupV2Request validate(DictionaryLookupV2Request request, String sourceLanguage) {
        if (request == null || request.requestId() == null || !UUID_PATTERN.matcher(request.requestId()).matches()
                || request.partId() == null || request.partId() <= 0 || request.documentId() == null
                || request.documentId().isBlank() || request.documentId().length() > 128
                || !request.documentId().equals(request.documentId().strip()) || request.selectedText() == null
                || request.contextText() == null) throw invalid();
        String selected = request.selectedText();
        int length = selected.codePointCount(0, selected.length());
        if (selected.isBlank() || !selected.equals(selected.strip()) || length > 80 || hasControl(selected)) throw invalid();
        String normalizedSource = sourceLanguage == null ? null : languages.findNormalized(sourceLanguage)
                .orElseThrow(DictionaryLookupV2RequestValidator::invalid);
        String base = normalizedSource == null ? null : normalizedSource.split("-")[0];
        if (base == null || Set.of("zh", "ja").contains(base)) {
            if (length < 1) throw invalid();
        } else {
            var matcher = WORD.matcher(selected); int count = 0;
            while (matcher.find()) count++;
            if (count < 1 || count > 5) throw invalid();
        }
        String context = request.contextText();
        if (context.isBlank() || !context.equals(context.strip()) || hasControl(context)
                || context.codePointCount(0, context.length()) > 1000) throw invalid();
        return request;
    }

    public Integer parseAttemptId(String raw) {
        try { if (raw == null || !raw.matches("[1-9][0-9]{0,9}")) throw invalid(); return Integer.parseInt(raw); }
        catch (NumberFormatException e) { throw invalid(); }
    }

    private static String text(JsonNode root, String name) { JsonNode n = root.get(name); if (n == null || !n.isTextual()) throw invalid(); return n.textValue(); }
    private static String optionalText(JsonNode root, String name) { JsonNode n = root.get(name); if (n == null || n.isNull()) return null; if (!n.isTextual()) throw invalid(); return n.textValue(); }
    private static boolean hasControl(String value) { return value.codePoints().anyMatch(Character::isISOControl); }
    private static AppException invalid() { return new AppException(ErrorCode.VALIDATION_FAILED, "Dictionary lookup request is invalid"); }
}
