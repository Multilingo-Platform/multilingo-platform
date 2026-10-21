package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.swing.text.MutableAttributeSet;
import javax.swing.text.html.HTML;
import javax.swing.text.html.HTMLEditorKit;
import javax.swing.text.html.parser.ParserDelegator;
import java.io.IOException;
import java.io.StringReader;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** Reads only the public passage fields in the requested immutable attempt snapshot document. */
@Component
public class DictionaryLookupContextReader {
    private static final Set<String> IGNORED_TAGS = Set.of("script", "style", "noscript", "svg", "audio", "video", "iframe", "object");
    private static final List<String> CONTENT_KEYS = List.of(
            "content_html", "contentHtml", "context_html", "contextHtml", "passage_html", "passageHtml",
            "content", "context", "passage"
    );
    private final DictionaryLookupRequestValidator requestValidator;
    private final DictionaryLookupV2RequestValidator v2RequestValidator;

    public DictionaryLookupContextReader(DictionaryLookupRequestValidator requestValidator) {
        this.requestValidator = requestValidator;
        this.v2RequestValidator = null;
    }

    @Autowired
    public DictionaryLookupContextReader(DictionaryLookupRequestValidator requestValidator,
                                         DictionaryLookupV2RequestValidator v2RequestValidator) {
        this.requestValidator = requestValidator;
        this.v2RequestValidator = v2RequestValidator;
    }

    public record VerifiedContext(String sourceContext, String selectedText) { }

    public VerifiedContext read(Map<String, Object> snapshot, DictionaryLookupRequest input) {
        DictionaryLookupRequest request = input != null && input.contractVersion() == 2
                ? validateV2(input) : requestValidator.validate(input);
        if (snapshot == null || !(snapshot.get("sections") instanceof List<?> sections)) throw invalid();
        Map<?, ?> targetPart = null;
        String skill = null;
        for (Object sectionValue : sections) {
            if (!(sectionValue instanceof Map<?, ?> section)) continue;
            String sectionSkill = text(first(section, "name", "skill"));
            Object partsValue = section.get("parts");
            if (!(partsValue instanceof List<?> parts)) continue;
            for (Object partValue : parts) {
                if (!(partValue instanceof Map<?, ?> part)) continue;
                if (Objects.equals(integer(first(part, "id", "part_id", "partId")), request.partId())) {
                    targetPart = part;
                    skill = sectionSkill;
                    break;
                }
            }
            if (targetPart != null) break;
        }
        if (targetPart == null || skill == null || !"READING".equalsIgnoreCase(skill)) throw invalid();

        String passageHtml;
        if ("part".equals(request.documentId())) {
            passageHtml = content(targetPart);
        } else {
            passageHtml = findGroupPassage(targetPart, request.documentId());
        }
        String passage = toPlainText(passageHtml);
        String candidateContext = normalizeWhitespace(request.contextText());
        String canonicalContext = findCanonicalContext(passage, candidateContext);
        String language = extractLanguage(snapshot);
        if (request.contractVersion() == 1 && !isEnglish(language)) {
            throw new AppException(ErrorCode.WRITING_HINTS_LANGUAGE_UNSUPPORTED);
        }
        if (canonicalContext == null || !containsTerm(canonicalContext, request.selectedText(), language)) throw invalid();
        return new VerifiedContext(canonicalContext, request.selectedText());
    }

    private DictionaryLookupRequest validateV2(DictionaryLookupRequest input) {
        if (v2RequestValidator == null) return input;
        v2RequestValidator.validate(new com.multilingo.backend.modules.testing.dto.request.DictionaryLookupV2Request(
                input.requestId(), input.partId(), input.documentId(), input.selectedText(), input.contextText(), input.meaningLanguage()), null);
        return input;
    }

    private String findGroupPassage(Map<?, ?> part, String documentId) {
        Object groupsValue = first(part, "question_groups", "questionGroups");
        if (!(groupsValue instanceof List<?> groups)) throw invalid();
        for (Object groupValue : groups) {
            if (!(groupValue instanceof Map<?, ?> group)) continue;
            Object id = first(group, "group_id", "groupId", "id");
            if (id != null && documentId.equals(String.valueOf(id))) return content(group);
        }
        throw invalid();
    }

    private String content(Map<?, ?> node) {
        for (String key : CONTENT_KEYS) {
            Object value = node.get(key);
            if (value instanceof String content && !content.isBlank()) return content;
        }
        throw invalid();
    }

    private static Object first(Map<?, ?> map, String... keys) {
        for (String key : keys) if (map.containsKey(key)) return map.get(key);
        return null;
    }

    private static Integer integer(Object value) {
        if (value instanceof Number number) {
            int parsed = number.intValue();
            return parsed > 0 && number.doubleValue() == parsed ? parsed : null;
        }
        if (value instanceof String text) {
            try { return Integer.parseInt(text); } catch (NumberFormatException ignored) { return null; }
        }
        return null;
    }

    private static String text(Object value) { return value instanceof String string ? string : null; }

    private static String toPlainText(String html) {
        StringBuilder text = new StringBuilder();
        int[] ignoredDepth = {0};
        HTMLEditorKit.ParserCallback callback = new HTMLEditorKit.ParserCallback() {
            @Override
            public void handleStartTag(HTML.Tag tag, MutableAttributeSet attributes, int position) {
                if (IGNORED_TAGS.contains(tag.toString().toLowerCase(Locale.ROOT))) ignoredDepth[0]++;
            }

            @Override
            public void handleEndTag(HTML.Tag tag, int position) {
                if (IGNORED_TAGS.contains(tag.toString().toLowerCase(Locale.ROOT)) && ignoredDepth[0] > 0) ignoredDepth[0]--;
            }

            @Override
            public void handleText(char[] data, int position) {
                if (ignoredDepth[0] == 0) text.append(data).append(' ');
            }
        };
        try {
            new ParserDelegator().parse(new StringReader(html), callback, true);
        } catch (IOException e) {
            throw invalid();
        }
        return normalizeWhitespace(text.toString());
    }

    private static String normalizeWhitespace(String value) {
        return value == null ? "" : value.replaceAll("[\\s\\p{Z}]+", " ")
                .replaceAll("\\s+([,.;:!?])", "$1")
                .strip();
    }

    private static String findCanonicalContext(String passage, String requestedContext) {
        if (passage.isBlank() || requestedContext.isBlank()) return null;
        for (int index = 0; index <= passage.length() - requestedContext.length(); index++) {
            if (passage.regionMatches(true, index, requestedContext, 0, requestedContext.length())) {
                return passage.substring(index, index + requestedContext.length());
            }
        }
        return null;
    }

    private static boolean containsTerm(String context, String selectedText, String language) {
        boolean cjkPolicy = isCjkLanguage(language)
                || selectedText.codePoints().anyMatch(DictionaryLookupContextReader::isCjkCodePoint);
        for (int from = 0; from <= context.length() - selectedText.length(); from++) {
            if (!context.regionMatches(true, from, selectedText, 0, selectedText.length())) continue;
            if (cjkPolicy) {
                return true;
            }
            int before = from - 1;
            int after = from + selectedText.length();
            boolean leftBoundary = before < 0 || !isWord(context.codePointBefore(from));
            boolean rightBoundary = after >= context.length() || !isWord(context.codePointAt(after));
            if (leftBoundary && rightBoundary) return true;
        }
        return false;
    }

    private static String extractLanguage(Map<String, Object> snapshot) {
        if (snapshot == null) return null;
        Object lang = snapshot.get("examLanguage");
        if (lang == null) lang = snapshot.get("exam_language");
        return lang instanceof String text ? text.trim().toLowerCase(Locale.ROOT) : null;
    }

    private static boolean isCjkLanguage(String language) {
        if (language == null) return false;
        String lang = language.trim().toLowerCase(Locale.ROOT);
        return lang.startsWith("zh") || lang.startsWith("ja");
    }

    private static boolean isEnglish(String language) {
        return language != null && (language.equals("en") || language.startsWith("en-"));
    }

    private static boolean isCjkCodePoint(int cp) {
        Character.UnicodeScript script = Character.UnicodeScript.of(cp);
        return script == Character.UnicodeScript.HAN
                || script == Character.UnicodeScript.HIRAGANA
                || script == Character.UnicodeScript.KATAKANA
                || script == Character.UnicodeScript.BOPOMOFO;
    }

    private static boolean isWord(int codePoint) {
        int type = Character.getType(codePoint);
        return Character.isLetterOrDigit(codePoint) || type == Character.NON_SPACING_MARK
                || type == Character.COMBINING_SPACING_MARK || type == Character.ENCLOSING_MARK;
    }

    private static AppException invalid() {
        return new AppException(ErrorCode.VALIDATION_FAILED, "Dictionary lookup context is invalid");
    }
}
