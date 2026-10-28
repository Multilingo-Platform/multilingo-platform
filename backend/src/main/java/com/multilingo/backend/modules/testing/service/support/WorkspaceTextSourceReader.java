package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.dto.request.WorkspaceTextSource;
import org.springframework.stereotype.Component;
import org.unbescape.html.HtmlEscape;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Reads public authored fields and type-derived control tokens of one sanitized snapshot part.
 * The reader never scans arbitrary snapshot keys and never exposes answers, explanations,
 * transcripts, grading metadata or learner input.
 */
@Component
public class WorkspaceTextSourceReader {
    private static final Set<String> IGNORED_HTML_TAGS = Set.of(
            "script", "style", "noscript", "svg", "math", "head", "title",
            "audio", "video", "iframe", "object", "embed", "source", "track",
            "template", "noembed", "noframes", "plaintext", "xmp"
    );
    /**
     * HTML raw-text elements: everything up to the first matching end tag is character data,
     * so markup-looking text inside them must never start a new tag.
     */
    private static final Set<String> RAWTEXT_HTML_TAGS = Set.of("script", "style", "xmp");
    /** HTML void elements have no end tag; a trailing slash on any other element is ignored. */
    private static final Set<String> VOID_HTML_TAGS = Set.of(
            "area", "base", "br", "col", "embed", "hr", "img", "input",
            "link", "meta", "param", "source", "track", "wbr"
    );
    /** Foreign content elements in HTML5 (SVG, MathML) honor a self-closing trailing slash. */
    private static final Set<String> FOREIGN_HTML_TAGS = Set.of("svg", "math");
    /** Elements whose immediate leading newline character is stripped in HTML DOM parsing. */
    private static final Set<String> LEADING_NEWLINE_HTML_TAGS = Set.of("pre", "listing", "textarea");
    private static final List<String> PART_TITLE_PATHS = List.of(
            "part_title", "partTitle", "title", "content.part_title", "content.partTitle"
    );
    private static final List<String> PART_INSTRUCTION_PATHS = List.of(
            "instruction", "content.instruction"
    );
    private static final List<String> PART_CONTENT_PATHS = List.of(
            "content_html", "contentHtml", "content.shared_content_html", "content.content_html",
            "content.contentHtml"
    );
    private static final List<String> GROUP_INSTRUCTION_PATHS = List.of(
            "instruction", "content.instruction"
    );
    private static final List<String> GROUP_CONTENT_PATHS = List.of(
            "context_html", "content_html", "contextHtml", "contentHtml",
            "content.context_html", "content.contentHtml"
    );

    public record WorkspaceTextDocument(
            int partId,
            WorkspaceTextSource source,
            String sourceKey,
            String text,
            String contentHash
    ) { }

    public record VerifiedSelection(
            WorkspaceTextDocument document,
            String selectedText,
            String sourceContext,
            int start,
            int end
    ) { }

    public WorkspaceTextDocument read(Map<String, Object> snapshot, int partId, WorkspaceTextSource source) {
        if (snapshot == null || partId <= 0 || source == null) throw invalid();
        PartContext part = findPart(snapshot, partId);
        String raw = switch (source.kind()) {
            case PART_TITLE -> requiredText(part.node(), PART_TITLE_PATHS);
            case PART_INSTRUCTION -> requiredText(part.node(), PART_INSTRUCTION_PATHS);
            case PART_CONTENT -> requiredText(part.node(), PART_CONTENT_PATHS);
            case GROUP_INSTRUCTION -> requiredText(
                    findGroup(part.node(), source.groupId()), GROUP_INSTRUCTION_PATHS);
            case GROUP_CONTENT -> requiredText(
                    findGroup(part.node(), source.groupId()), GROUP_CONTENT_PATHS);
            case QUESTION_TEXT -> requiredText(
                    findQuestion(part.node(), source.questionId()).node(), questionTextPaths());
            case OPTION_TEXT -> findOptionText(part.node(), source.questionId(), source.optionId());
        };
        String text = source.htmlContent() ? htmlToText(raw) : plainText(raw);
        if (text.isBlank()) throw invalid();
        return new WorkspaceTextDocument(partId, source, source.sourceKey(), text, hashText(text));
    }

    public VerifiedSelection verify(
            Map<String, Object> snapshot,
            int partId,
            WorkspaceTextSource source,
            String selectedText,
            String contextText
    ) {
        validateSelection(selectedText, contextText);
        WorkspaceTextDocument document = read(snapshot, partId, source);
        ContextProjection projection = contextProjection(document.text());
        String normalizedContext = contextProjection(contextText).text();
        for (int contextStart = indexOfIgnoreCase(projection.text(), normalizedContext, 0);
             contextStart >= 0;
             contextStart = indexOfIgnoreCase(projection.text(), normalizedContext, contextStart + 1)) {
            String canonicalContext = projection.text().substring(
                    contextStart, contextStart + normalizedContext.length());
            for (int selectedInContext = findSelection(canonicalContext, selectedText, 0);
                 selectedInContext >= 0;
                 selectedInContext = findSelection(canonicalContext, selectedText, selectedInContext + 1)) {
                int selectedStart = contextStart + selectedInContext;
                int start = projection.starts().get(selectedStart);
                int end = projection.ends().get(selectedStart + selectedText.length() - 1);
                if (!validRange(document.text(), start, end)) continue;
                String canonicalSelection = document.text().substring(start, end);
                if (!canonicalSelection.equalsIgnoreCase(selectedText)) continue;
                return new VerifiedSelection(
                        document,
                        canonicalSelection,
                        canonicalContext,
                        start,
                        end
                );
            }
        }
        throw invalid();
    }

    private record ContextProjection(String text, List<Integer> starts, List<Integer> ends) { }

    /** Mirrors frontend contextAround's ECMAScript whitespace collapse, retaining source UTF-16 offsets. */
    private static ContextProjection contextProjection(String source) {
        StringBuilder text = new StringBuilder();
        List<Integer> starts = new ArrayList<>();
        List<Integer> ends = new ArrayList<>();
        for (int index = 0; index < source.length();) {
            int start = index++;
            char value = source.charAt(start);
            if (contextWhitespace(value)) {
                while (index < source.length() && contextWhitespace(source.charAt(index))) index++;
                if (text.isEmpty() || index == source.length()) continue;
                value = ' ';
            }
            text.append(value);
            starts.add(start);
            ends.add(index);
        }
        return new ContextProjection(text.toString(), starts, ends);
    }

    private static boolean contextWhitespace(char value) {
        return (value >= '\t' && value <= '\r') || value == ' ' || value == '\u00a0'
                || value == '\u1680' || (value >= '\u2000' && value <= '\u200a')
                || value == '\u2028' || value == '\u2029' || value == '\u202f'
                || value == '\u205f' || value == '\u3000' || value == '\ufeff';
    }

    private static PartContext findPart(Map<String, Object> snapshot, int partId) {
        Object sectionsValue = snapshot.get("sections");
        if (!(sectionsValue instanceof List<?> sections)) throw invalid();
        PartContext found = null;
        for (Object sectionValue : sections) {
            if (!(sectionValue instanceof Map<?, ?> section)) continue;
            Object partsValue = section.get("parts");
            if (!(partsValue instanceof List<?> parts)) continue;
            for (Object partValue : parts) {
                if (!(partValue instanceof Map<?, ?> part)) continue;
                Integer id = positiveInt(first(part, "id", "part_id", "partId"));
                if (!Objects.equals(id, partId)) continue;
                if (found != null) throw invalid();
                found = new PartContext(part);
            }
        }
        if (found == null) throw invalid();
        return found;
    }

    private static Map<?, ?> findGroup(Map<?, ?> part, String groupId) {
        if (groupId == null) throw invalid();
        Map<?, ?> found = null;
        for (Object rawGroup : listAt(part, "question_groups", "questionGroups", "content.question_groups", "content.questionGroups")) {
            if (!(rawGroup instanceof Map<?, ?> group)) continue;
            if (!Objects.equals(groupId, id(first(group, "group_id", "groupId")))) continue;
            if (found != null) throw invalid();
            found = group;
        }
        if (found == null) throw invalid();
        return found;
    }

    private static QuestionContext findQuestion(Map<?, ?> part, String questionId) {
        if (questionId == null) throw invalid();
        for (QuestionContext question : collectQuestions(part)) {
            if (Objects.equals(questionId, question.questionId())) return question;
        }
        throw invalid();
    }

    private static List<QuestionContext> collectQuestions(Map<?, ?> part) {
        List<QuestionContext> result = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        List<?> groups = listAt(part, "question_groups", "questionGroups", "content.question_groups", "content.questionGroups");
        for (Object rawGroup : groups) {
            if (!(rawGroup instanceof Map<?, ?> group)) continue;
            List<?> groupOptions = listAt(group, "options", "content.options");
            for (Object rawQuestion : listAt(group, "questions", "content.questions")) {
                addQuestion(result, seen, rawQuestion, groupOptions);
            }
        }
        for (Object rawQuestion : listAt(part, "questions", "content.questions")) {
            addQuestion(result, seen, rawQuestion, List.of());
        }
        return result;
    }

    private static void addQuestion(
            List<QuestionContext> result,
            Set<String> seen,
            Object rawQuestion,
            List<?> groupOptions
    ) {
        if (!(rawQuestion instanceof Map<?, ?> question)) return;
        String questionId = id(first(question, "question_id", "questionId"));
        if (!validId(questionId) || !seen.add(questionId)) return;
        result.add(new QuestionContext(questionId, question, groupOptions));
    }

    private static String findOptionText(Map<?, ?> part, String questionId, String optionId) {
        if (optionId == null) throw invalid();
        QuestionContext question = findQuestion(part, questionId);
        String type = Objects.toString(question.node().get("type"), "");
        List<String> canonicalTokens = switch (type) {
            case "TRUE_FALSE_NOT_GIVEN" -> List.of("TRUE", "FALSE", "NOT GIVEN");
            case "YES_NO_NOT_GIVEN" -> List.of("YES", "NO", "NOT GIVEN");
            default -> null;
        };
        if (canonicalTokens != null) {
            if (!canonicalTokens.contains(optionId)) throw invalid();
            return optionId;
        }
        List<?> options = listAt(question.node(), "options", "content.options");
        if (options.isEmpty()) options = question.groupOptions();
        if ("MATCHING_INFORMATION".equals(type)) {
            return matchingInformationOptionText(options, optionId);
        }
        for (Object rawOption : options) {
            if (!(rawOption instanceof Map<?, ?> option)) continue;
            if (!Objects.equals(optionId, id(first(option, "id", "option_id", "optionId")))) continue;
            String text = requiredText(option, List.of("text", "content", "option_text", "optionText"));
            return text;
        }
        throw invalid();
    }

    /** Mirrors WorkspacePage: string options receive positional ids before control rendering. */
    private static String matchingInformationOptionText(List<?> options, String optionId) {
        List<?> choices = options.isEmpty() ? List.of("A", "B", "C", "D", "E", "F", "G") : options;
        for (int index = 0; index < choices.size(); index++) {
            Object option = choices.get(index);
            String fallback = String.valueOf((char) ('A' + index));
            String sourceId = fallback;
            String letter = fallback;
            if (option instanceof Map<?, ?> node) {
                String authoredId = id(first(node, "id", "option_id", "optionId"));
                sourceId = authoredId == null || authoredId.isEmpty() ? fallback : authoredId;
                letter = sourceId.trim().toUpperCase(Locale.ROOT);
            }
            if (Objects.equals(optionId, sourceId)) return letter;
        }
        throw invalid();
    }

    private static String requiredText(Map<?, ?> node, List<String> paths) {
        for (String path : paths) {
            Object value = pathValue(node, path);
            if (value instanceof String text && !text.isBlank()) return text;
        }
        throw invalid();
    }

    private static String plainText(String raw) {
        String text = raw.replace("\r\n", "\n").replace('\r', '\n');
        if (text.isBlank()) throw invalid();
        return text;
    }

    /**
     * Canonical HTML text contract shared with the frontend catalog:
     * parse markup the way an HTML5 document parser does (void elements, raw-text elements such
     * as script/style, comments ignored, a trailing slash on non-void elements ignored), remove
     * non-display subtrees whole, keep every remaining text node in document order, decode full
     * HTML5 character references (including legacy semicolon-less names) and normalize line
     * endings. The frontend applies the same rules by parsing raw HTML, removing the same
     * non-display tags and reading {@code body.textContent}.
     */
    private static String htmlToText(String rawHtml) {
        StringBuilder text = new StringBuilder();
        String ignoredTag = null;
        int ignoredDepth = 0;
        int index = 0;
        while (index < rawHtml.length()) {
            if (ignoredTag != null && RAWTEXT_HTML_TAGS.contains(ignoredTag)) {
                int closingEnd = findRawTextEnd(rawHtml, ignoredTag, index);
                if (closingEnd < 0) break;
                index = closingEnd + 1;
                ignoredTag = null;
                ignoredDepth = 0;
                continue;
            }
            if (rawHtml.startsWith("<!--", index)) {
                int commentEnd = rawHtml.indexOf("-->", index + 4);
                if (commentEnd < 0) break;
                index = commentEnd + 3;
                continue;
            }
            if (rawHtml.charAt(index) != '<') {
                int nextTag = rawHtml.indexOf('<', index);
                if (nextTag < 0) nextTag = rawHtml.length();
                if (ignoredTag == null) {
                    text.append(HtmlEscape.unescapeHtml(rawHtml.substring(index, nextTag)));
                }
                index = nextTag;
                continue;
            }
            char marker = index + 1 < rawHtml.length() ? rawHtml.charAt(index + 1) : '\0';
            if (marker == '!' || marker == '?') {
                int declarationEnd = findTagEnd(rawHtml, index + 1);
                if (declarationEnd < 0) break;
                index = declarationEnd + 1;
                continue;
            }
            TagToken tag = readTag(rawHtml, index);
            if (tag == null) {
                if (ignoredTag == null) text.append('<');
                index++;
                continue;
            }
            if (!tag.closing() && !tag.selfClosing() && "plaintext".equals(tag.name())) {
                break;
            }
            if (ignoredTag != null) {
                if (tag.name().equals(ignoredTag)) {
                    if (tag.closing()) {
                        ignoredDepth--;
                        if (ignoredDepth == 0) ignoredTag = null;
                    } else if (!tag.selfClosing()) {
                        ignoredDepth++;
                    }
                }
                index = tag.end();
                continue;
            }
            if (!tag.closing() && !tag.selfClosing() && IGNORED_HTML_TAGS.contains(tag.name())) {
                ignoredTag = tag.name();
                ignoredDepth = 1;
            }
            index = tag.end();
            if (ignoredTag == null && !tag.closing() && !tag.selfClosing()
                    && LEADING_NEWLINE_HTML_TAGS.contains(tag.name())) {
                if (index < rawHtml.length()) {
                    if (rawHtml.startsWith("\r\n", index)) {
                        index += 2;
                    } else if (rawHtml.charAt(index) == '\n' || rawHtml.charAt(index) == '\r') {
                        index++;
                    }
                }
            }
        }
        String normalized = text.toString().replace("\r\n", "\n").replace('\r', '\n');
        if (normalized.isBlank()) throw invalid();
        return normalized;
    }

    private static TagToken readTag(String rawHtml, int start) {
        int index = start + 1;
        if (index >= rawHtml.length()) return null;
        boolean closing = rawHtml.charAt(index) == '/';
        if (closing) index++;
        if (index >= rawHtml.length() || !isAsciiAlpha(rawHtml.charAt(index))) return null;
        int nameStart = index;
        while (index < rawHtml.length()) {
            char value = rawHtml.charAt(index);
            if (!isTagNameChar(value)) break;
            index++;
        }
        if (nameStart == index) return null;
        String name = rawHtml.substring(nameStart, index).toLowerCase(Locale.ROOT);
        int end = findTagEnd(rawHtml, index);
        if (end < 0) return null;
        boolean hasSlash = hasTrailingSlash(rawHtml, index, end);
        // HTML ignores a self-closing slash on non-void elements, except foreign elements (svg, math).
        // Void elements are always self-closing.
        boolean selfClosing = VOID_HTML_TAGS.contains(name) || (hasSlash && FOREIGN_HTML_TAGS.contains(name));
        return new TagToken(name, closing, selfClosing, end + 1);
    }

    private static boolean isAsciiAlpha(char ch) {
        return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
    }

    private static boolean isTagNameChar(char ch) {
        return Character.isLetterOrDigit(ch) || ch == ':' || ch == '-' || ch == '_';
    }

    private static boolean hasTrailingSlash(String rawHtml, int start, int end) {
        char quote = '\0';
        char lastChar = '\0';
        for (int i = start; i < end; i++) {
            char c = rawHtml.charAt(i);
            if (quote != '\0') {
                if (c == quote) quote = '\0';
            } else if (c == '"' || c == '\'') {
                quote = c;
                lastChar = c;
            } else if (!Character.isWhitespace(c)) {
                lastChar = c;
            }
        }
        return quote == '\0' && lastChar == '/';
    }

    private static int findRawTextEnd(String rawHtml, String tag, int startIndex) {
        String prefix = "</" + tag;
        int search = startIndex;
        while (search < rawHtml.length()) {
            int closing = indexOfIgnoreCase(rawHtml, prefix, search);
            if (closing < 0) return -1;
            int afterName = closing + prefix.length();
            if (afterName < rawHtml.length()) {
                char ch = rawHtml.charAt(afterName);
                if (isTagNameChar(ch)) {
                    search = closing + 1;
                    continue;
                }
            }
            int closingEnd = findTagEnd(rawHtml, afterName);
            if (closingEnd < 0) return -1;
            return closingEnd;
        }
        return -1;
    }

    private static int findTagEnd(String rawHtml, int start) {
        char quote = '\0';
        for (int index = start; index < rawHtml.length(); index++) {
            char value = rawHtml.charAt(index);
            if (quote != '\0') {
                if (value == quote) quote = '\0';
            } else if (value == '"' || value == '\'') {
                quote = value;
            } else if (value == '>') {
                return index;
            }
        }
        return -1;
    }

    private static int findSelection(String context, String selectedText, int from) {
        boolean cjk = selectedText.codePoints().anyMatch(WorkspaceTextSourceReader::isCjkCodePoint);
        for (int index = indexOfIgnoreCase(context, selectedText, from);
             index >= 0;
             index = indexOfIgnoreCase(context, selectedText, index + 1)) {
            if (cjk) return index;
            int before = index - 1;
            int after = index + selectedText.length();
            boolean leftBoundary = before < 0 || !isWord(context.codePointBefore(index));
            boolean rightBoundary = after >= context.length() || !isWord(context.codePointAt(after));
            if (leftBoundary && rightBoundary) return index;
        }
        return -1;
    }

    private static void validateSelection(String selectedText, String contextText) {
        if (selectedText == null || contextText == null) throw invalid();
        int selectedLength = selectedText.codePointCount(0, selectedText.length());
        int contextLength = contextText.codePointCount(0, contextText.length());
        if (selectedText.isBlank() || !selectedText.equals(selectedText.strip())
                || selectedLength > 80 || hasControl(selectedText)) throw invalid();
        if (contextText.isBlank() || !contextText.equals(contextText.strip())
                || contextLength > 1000 || hasControl(contextText)) throw invalid();
    }

    private static boolean validRange(String text, int start, int end) {
        if (start < 0 || end <= start || end > text.length()) return false;
        return !splitsSurrogate(text, start) && !splitsSurrogate(text, end);
    }

    private static boolean splitsSurrogate(String text, int offset) {
        if (offset <= 0 || offset >= text.length()) return false;
        char before = text.charAt(offset - 1);
        char after = text.charAt(offset);
        return Character.isHighSurrogate(before) && Character.isLowSurrogate(after);
    }

    private static int indexOfIgnoreCase(String text, String needle, int from) {
        if (needle.isEmpty()) return -1;
        int last = text.length() - needle.length();
        for (int index = Math.max(0, from); index <= last; index++) {
            if (text.regionMatches(true, index, needle, 0, needle.length())) return index;
        }
        return -1;
    }

    private static boolean hasControl(String value) {
        return value.codePoints().anyMatch(Character::isISOControl);
    }

    private static boolean isWord(int codePoint) {
        int type = Character.getType(codePoint);
        return Character.isLetterOrDigit(codePoint) || type == Character.NON_SPACING_MARK
                || type == Character.COMBINING_SPACING_MARK || type == Character.ENCLOSING_MARK;
    }

    private static boolean isCjkCodePoint(int codePoint) {
        Character.UnicodeScript script = Character.UnicodeScript.of(codePoint);
        return script == Character.UnicodeScript.HAN
                || script == Character.UnicodeScript.HIRAGANA
                || script == Character.UnicodeScript.KATAKANA
                || script == Character.UnicodeScript.BOPOMOFO;
    }

    static String hashText(String text) {
        int hash = 0x811c9dc5;
        for (int index = 0; index < text.length(); index++) {
            hash ^= text.charAt(index);
            hash *= 0x01000193;
        }
        return Integer.toUnsignedString(hash, 36);
    }

    private static Object first(Map<?, ?> node, String... keys) {
        for (String key : keys) {
            if (node.containsKey(key)) return node.get(key);
        }
        return null;
    }

    private static Object pathValue(Map<?, ?> node, String path) {
        Object current = node;
        for (String segment : path.split("\\.")) {
            if (!(current instanceof Map<?, ?> map)) return null;
            current = map.get(segment);
        }
        return current;
    }

    private static List<?> listAt(Map<?, ?> node, String... paths) {
        for (String path : paths) {
            Object value = pathValue(node, path);
            if (value instanceof List<?> list) return list;
        }
        return List.of();
    }

    private static String id(Object value) {
        if (value instanceof String text) return text;
        if (value instanceof Number number) {
            int parsed = number.intValue();
            return number.doubleValue() == parsed ? String.valueOf(parsed) : null;
        }
        return null;
    }

    private static boolean validId(String value) {
        return value != null && !value.isBlank() && value.length() <= 128
                && value.equals(value.strip()) && !hasControl(value);
    }

    private static Integer positiveInt(Object value) {
        if (value instanceof Number number) {
            int parsed = number.intValue();
            return parsed > 0 && number.doubleValue() == parsed ? parsed : null;
        }
        if (value instanceof String text) {
            try {
                int parsed = Integer.parseInt(text);
                return parsed > 0 ? parsed : null;
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private static List<String> questionTextPaths() {
        return List.of("question_text", "questionText", "prompt", "content.question_text", "content.prompt");
    }

    private static AppException invalid() {
        return new AppException(ErrorCode.VALIDATION_FAILED, "Workspace text source is invalid");
    }

    private record PartContext(Map<?, ?> node) { }

    private record QuestionContext(String questionId, Map<?, ?> node, List<?> groupOptions) { }

    private record TagToken(String name, boolean closing, boolean selfClosing, int end) { }
}
