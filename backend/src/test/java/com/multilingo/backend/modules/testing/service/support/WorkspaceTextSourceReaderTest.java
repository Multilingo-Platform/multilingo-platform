package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.modules.testing.dto.request.WorkspaceTextSource;
import com.multilingo.backend.modules.testing.dto.request.WorkspaceTextSource.Kind;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WorkspaceTextSourceReaderTest {
    private static final String CONTENT_HTML =
            "<p>Hello <b>world</b> &amp; friends.<script>alert(\"secret\")</script></p>\n"
                    + "<p><em>Second</em> line 前😀</p>";
    private static final String GROUP_HTML =
            "<p>Inline <b>bold</b> end</p>\n"
                    + "<table><tbody><tr><td>Cell 1</td><td>Cell 2</td></tr></tbody></table>";
    // Shared canonical-text fixtures; the frontend suite asserts the same literal text and hash.
    private static final String ENTITY_HTML = "<p>one &apos;two&apos; &NoBreak; &NotEqualTilde;</p>";
    private static final String LEGACY_ENTITY_HTML = "<p>&amp;amp; &#65; &notanentity;</p>";
    private static final String STYLE_HTML =
            "<p>before</p><style>.secret {color:red}</style><p>after</p>";
    private static final String RAWTEXT_HTML =
            "<p>before</p><script>const s = \"</style>\";</script><p>after</p>";
    private static final String AUDIO_HTML = "<p>before</p><audio/>after";
    private static final String PRE_HTML = "<pre>\nHello world</pre>";
    private static final String SCRIPT_DELIMITER_HTML =
            "<p>before</p><script>const x=\"</scriptx>\"; hidden words;</script><p>after</p>";
    private static final String SVG_SELF_CLOSING_HTML = "<svg/><p>visible</p>";
    private static final String LESS_THAN_DIGIT_HTML = "<p>2 <3</p>";
    private static final String PLAINTEXT_HTML = "<p>before</p><plaintext>hidden</plaintext>public";

    private final WorkspaceTextSourceReader reader = new WorkspaceTextSourceReader();

    @Test
    void r2F01FindsLaterVerbatimSelectionWithinTheSameNormalizedContext() {
        for (boolean html : List.of(false, true)) {
            for (String whitespace : List.of("  ", "\u00a0")) {
                String text = "chosen" + whitespace + "words; later chosen words.";
                String raw = html ? "<p>chosen" + (whitespace.equals("\u00a0") ? "&nbsp;" : whitespace)
                        + "words; later <b>chosen words</b>.</p>" : text;
                var snapshot = map("sections", List.of(section("READING", List.of(
                        map("id", 7, html ? "content_html" : "instruction", raw)))));
                var source = source(html ? Kind.PART_CONTENT : Kind.PART_INSTRUCTION);
                // Same literal context/selection as the production frontend builder regression.
                var selection = reader.verify(snapshot, 7, source, "chosen words", "chosen words; later chosen words.");
                assertThat(selection.start()).isEqualTo(text.lastIndexOf("chosen words"));
                assertThat(selection.end()).isEqualTo(text.lastIndexOf("chosen words") + 12);
                assertThat(selection.selectedText()).isEqualTo("chosen words");
                assertThat(selection.document().text().substring(selection.start(), selection.end())).isEqualTo("chosen words");
                assertThat(selection.sourceContext()).isEqualTo("chosen words; later chosen words.");
            }
        }
    }

    @Test
    void r2F01MapsCollapsedFrontendContextBackToCanonicalUtf16Source() {
        for (boolean html : List.of(false, true)) {
            String text = "😀 First line\nchosen  words\u00a0after.";
            var part = map("id", 7, html ? "content_html" : "instruction",
                    html ? "<p>😀 First line</p>\n<p>chosen  words&nbsp;after.</p>" : text);
            var snapshot = map("sections", List.of(section("READING", List.of(part))));
            var source = source(html ? Kind.PART_CONTENT : Kind.PART_INSTRUCTION);
            // Literal shared with the frontend production-builder regression.
            var selection = reader.verify(snapshot, 7, source, "chosen", "😀 First line chosen words after.");
            assertThat(selection.start()).isEqualTo(text.indexOf("chosen"));
            assertThat(selection.end()).isEqualTo(text.indexOf("chosen") + 6);
            assertThat(selection.document().text().substring(selection.start(), selection.end())).isEqualTo("chosen");
            assertThat(selection.sourceContext()).isEqualTo("😀 First line chosen words after.");
            assertThatThrownBy(() -> reader.verify(snapshot, 7, source, "chosen", "forged chosen context"))
                    .isInstanceOf(AppException.class);
            assertThatThrownBy(() -> reader.verify(snapshot, 7, source, "chosen words", "😀 First line chosen words after."))
                    .isInstanceOf(AppException.class);
        }
    }

    @Test
    void rd05R04VerifiesOnlyCanonicalPublicTokensForTheQuestionType() {
        for (String type : List.of("TRUE_FALSE_NOT_GIVEN", "YES_NO_NOT_GIVEN")) {
            List<String> tokens = type.equals("TRUE_FALSE_NOT_GIVEN")
                    ? List.of("TRUE", "FALSE", "NOT GIVEN") : List.of("YES", "NO", "NOT GIVEN");
            for (Object options : new Object[] {null, List.of(), List.of(map("id", "private", "text", "private option"))}) {
                Map<String, Object> question = map("question_id", "q1", "type", type, "options", options,
                        "correct_answer", "private answer", "explanation", "private explanation");
                Map<String, Object> snapshot = map("sections", List.of(section("READING", List.of(map("id", 7, "questions", List.of(question))))));
                for (String token : tokens) {
                    var verified = reader.verify(snapshot, 7, optionSource("q1", token), token, token);
                    assertThat(verified.document().text()).isEqualTo(token);
                    assertThat(verified.selectedText()).isEqualTo(token);
                    assertThat(verified.start()).isZero();
                    assertThat(verified.end()).isEqualTo(token.length());
                }
                for (String forged : List.of("private", type.equals("TRUE_FALSE_NOT_GIVEN") ? "YES" : "TRUE")) {
                    assertThatThrownBy(() -> reader.read(snapshot, 7, optionSource("q1", forged))).isInstanceOf(AppException.class);
                }
            }
        }
    }

    @Test
    void rd05R05VerifiesTheVisibleMatchingInformationLetterAndRejectsTooltipAsContext() {
        for (Object options : new Object[] {null, List.of(), List.of("A", "B"), List.of("Paragraph C", "Paragraph E"), List.of(map("id", "A", "text", "Paragraph alpha"))}) {
            Map<String, Object> question = map("question_id", "q1", "type", "MATCHING_INFORMATION", "options", options,
                    "correct_answer", "private answer");
            Map<String, Object> snapshot = map("sections", List.of(section("READING", List.of(map("id", 7, "questions", List.of(question))))));
            var verified = reader.verify(snapshot, 7, optionSource("q1", "A"), "A", "A");
            assertThat(verified.document().text()).isEqualTo("A");
            assertThat(verified.document().sourceKey()).isEqualTo("OPTION_TEXT:2:q1:1:A");
            assertThatThrownBy(() -> reader.verify(snapshot, 7, optionSource("q1", "A"), "alpha", "Paragraph alpha"))
                    .isInstanceOf(AppException.class);
            assertThatThrownBy(() -> reader.read(snapshot, 7, optionSource("q1", "Z"))).isInstanceOf(AppException.class);
        }
    }

    @Test
    void readsOnlyPublicPartGroupQuestionAndOptionSourcesWithSharedTextAndHash() {
        Map<String, Object> snapshot = snapshot();

        assertThat(reader.read(snapshot, 7, source(Kind.PART_TITLE)).text()).isEqualTo("Reading Part 1");
        assertThat(reader.read(snapshot, 7, source(Kind.PART_INSTRUCTION)).text())
                .isEqualTo("Read the passage.");

        var partContent = reader.read(snapshot, 7, source(Kind.PART_CONTENT));
        assertThat(partContent.text()).isEqualTo("Hello world & friends.\nSecond line 前😀");
        assertThat(partContent.contentHash()).isEqualTo("4zqk5o");
        assertThat(partContent.sourceKey()).isEqualTo("PART_CONTENT");
        assertThat(partContent.text()).doesNotContain("secret", "alert");

        var groupContent = reader.read(snapshot, 7, groupSource(Kind.GROUP_CONTENT, "g1"));
        assertThat(groupContent.text()).isEqualTo("Inline bold end\nCell 1Cell 2");
        assertThat(groupContent.contentHash()).isEqualTo("1wrnvfl");
        assertThat(groupContent.sourceKey()).isEqualTo("GROUP_CONTENT:2:g1");

        var question = reader.read(snapshot, 7, questionSource("q1"));
        assertThat(question.text()).isEqualTo("What is <b>literal</b> &amp; safe?");
        assertThat(question.contentHash()).isEqualTo("1x5j9qy");
        assertThat(question.sourceKey()).isEqualTo("QUESTION_TEXT:2:q1");

        var option = reader.read(snapshot, 7, optionSource("q1", "A"));
        assertThat(option.text()).isEqualTo("Authored <i>option</i> &amp; text");
        assertThat(option.contentHash()).isEqualTo("9qyx1");
        assertThat(option.sourceKey()).isEqualTo("OPTION_TEXT:2:q1:1:A");
        assertThat(List.of(partContent, groupContent, question, option))
                .allSatisfy(document -> assertThat(document.text())
                        .doesNotContain("private explanation", "private learner answer", "private feedback"));
    }

    @Test
    void rejectsMissingSourcesSourcesFromAnotherPartAndUnknownOptions() {
        Map<String, Object> snapshot = snapshot();

        assertThatThrownBy(() -> reader.read(snapshot, 99, source(Kind.PART_TITLE)))
                .isInstanceOf(AppException.class);
        assertThatThrownBy(() -> reader.read(snapshot, 7, groupSource(Kind.GROUP_CONTENT, "missing")))
                .isInstanceOf(AppException.class);
        assertThatThrownBy(() -> reader.read(snapshot, 7, groupSource(Kind.GROUP_CONTENT, "other-group")))
                .isInstanceOf(AppException.class);
        assertThatThrownBy(() -> reader.read(snapshot, 7, questionSource("other-question")))
                .isInstanceOf(AppException.class);
        assertThatThrownBy(() -> reader.read(snapshot, 7, optionSource("q1", "Z")))
                .isInstanceOf(AppException.class);
        assertThatThrownBy(() -> new WorkspaceTextSource(Kind.QUESTION_TEXT, null, "q1", "A"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void verifiesContextAndSelectedRangeWithoutCrossingAnotherSource() {
        Map<String, Object> snapshot = snapshot();
        var verified = reader.verify(snapshot, 7, questionSource("q-context"),
                "kākāpō", "The rare kākāpō lives near 😀 island.");

        assertThat(verified.selectedText()).isEqualTo("kākāpō");
        assertThat(verified.sourceContext()).isEqualTo("The rare kākāpō lives near 😀 island.");
        assertThat(verified.start()).isEqualTo(9);
        assertThat(verified.end()).isEqualTo(15);

        var emoji = reader.verify(snapshot, 7, questionSource("q-context"),
                "😀", "The rare kākāpō lives near 😀 island.");
        assertThat(emoji.end() - emoji.start()).isEqualTo(2);

        assertThatThrownBy(() -> reader.verify(snapshot, 7, questionSource("q-context"),
                "kākāpō", "A client invented passage.")).isInstanceOf(AppException.class);
        assertThatThrownBy(() -> reader.verify(snapshot, 7, questionSource("q-context"),
                "\uD83D", "The rare kākāpō lives near 😀 island.")).isInstanceOf(AppException.class);
        assertThatThrownBy(() -> reader.verify(snapshot, 7, optionSource("q1", "A"),
                "What is <b>literal</b> &amp; safe?", "What is <b>literal</b> &amp; safe?"))
                .isInstanceOf(AppException.class);
    }

    @Test
    void rejectsAnOutOfPartQuestionEvenWhenItsIdExistsInAnotherPart() {
        Map<String, Object> wrongQuestion = map(
                "question_id", "q-other",
                "question_text", "Other part prompt");
        Map<String, Object> otherPart = map(
                "id", 8,
                "partTitle", "Other Part",
                "questionGroups", List.of(map("group_id", "other-group", "questions", List.of(wrongQuestion))));
        Map<String, Object> snapshot = snapshot();
        snapshot.put("sections", List.of(
                section("READING", List.of(part())),
                section("READING", List.of(otherPart))));

        assertThatThrownBy(() -> reader.read(snapshot, 7, questionSource("q-other")))
                .isInstanceOf(AppException.class);
        assertThat(reader.read(snapshot, 8, questionSource("q-other")).text()).isEqualTo("Other part prompt");
    }

    @Test
    void keepsPlainQuestionTextLiteralAndDoesNotExposePrivateGradingFields() {
        Map<String, Object> snapshot = snapshot();
        var question = reader.read(snapshot, 7, questionSource("q1"));
        assertThat(question.text()).isEqualTo("What is <b>literal</b> &amp; safe?");
        assertThat(question.text()).doesNotContain("private explanation", "private learner answer", "private feedback");
    }

    @Test
    void jsonMappingRejectsUnknownFieldsUnsupportedKindsAndInvalidIds() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        WorkspaceTextSource parsed = mapper.readValue(
                "{\"kind\":\"OPTION_TEXT\",\"questionId\":\"q1\",\"optionId\":\"A\"}",
                WorkspaceTextSource.class);
        assertThat(parsed.optionId()).isEqualTo("A");
        assertThat(parsed.sourceKey()).isEqualTo("OPTION_TEXT:2:q1:1:A");

        assertThatThrownBy(() -> mapper.readValue(
                "{\"kind\":\"OPTION_TEXT\",\"questionId\":\"q1\",\"optionId\":\"A\",\"partId\":7}",
                WorkspaceTextSource.class)).isInstanceOf(JsonProcessingException.class);
        assertThatThrownBy(() -> mapper.readValue(
                "{\"kind\":\"option_text\",\"questionId\":\"q1\",\"optionId\":\"A\"}",
                WorkspaceTextSource.class)).isInstanceOf(JsonProcessingException.class);
        assertThatThrownBy(() -> mapper.readValue(
                "{\"kind\":\"PART_TITLE\",\"groupId\":\"g1\"}",
                WorkspaceTextSource.class)).isInstanceOf(JsonProcessingException.class);
        assertThatThrownBy(() -> new WorkspaceTextSource(Kind.QUESTION_TEXT, null, " ", null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new WorkspaceTextSource(Kind.QUESTION_TEXT, null, "q".repeat(129), null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void canonicalHtmlTextAndHashMatchFrontendForEntitiesAndHiddenContent() {
        Map<String, Object> entitySnapshot = snapshotWithContent(ENTITY_HTML);
        var entity = reader.read(entitySnapshot, 7, source(Kind.PART_CONTENT));
        assertThat(entity.text()).isEqualTo("one 'two' \u2060 \u2242\u0338");
        assertThat(entity.contentHash()).isEqualTo("12h39ft");
        var verifiedEntity = reader.verify(
                entitySnapshot, 7, source(Kind.PART_CONTENT), "two",
                "one 'two' \u2060 \u2242\u0338");
        assertThat(verifiedEntity.start()).isEqualTo(5);
        assertThat(verifiedEntity.end()).isEqualTo(8);

        Map<String, Object> legacyEntitySnapshot = snapshotWithContent(LEGACY_ENTITY_HTML);
        var legacyEntity = reader.read(legacyEntitySnapshot, 7, source(Kind.PART_CONTENT));
        assertThat(legacyEntity.text()).isEqualTo("&amp; A \u00acanentity;");
        assertThat(legacyEntity.contentHash()).isEqualTo("152h2ce");

        Map<String, Object> styleSnapshot = snapshotWithContent(STYLE_HTML);
        var style = reader.read(styleSnapshot, 7, source(Kind.PART_CONTENT));
        assertThat(style.text()).isEqualTo("beforeafter");
        assertThat(style.contentHash()).isEqualTo("cy95dg");

        Map<String, Object> rawtextSnapshot = snapshotWithContent(RAWTEXT_HTML);
        var rawtext = reader.read(rawtextSnapshot, 7, source(Kind.PART_CONTENT));
        assertThat(rawtext.text()).isEqualTo("beforeafter");
        assertThat(rawtext.contentHash()).isEqualTo("cy95dg");

        Map<String, Object> visibleSnapshot = snapshotWithContent(
                "<p>keep visible text</p><style>.secret {color:red}</style><p>tail</p>");
        var verifiedVisible = reader.verify(
                visibleSnapshot, 7, source(Kind.PART_CONTENT), "visible", "keep visible texttail");
        assertThat(verifiedVisible.start()).isEqualTo(5);
        assertThat(verifiedVisible.end()).isEqualTo(12);
        assertThatThrownBy(() -> reader.verify(
                visibleSnapshot, 7, source(Kind.PART_CONTENT), "secret", "keep visible texttail"))
                .isInstanceOf(AppException.class);

        Map<String, Object> audioSnapshot = snapshotWithContent(AUDIO_HTML);
        var audio = reader.read(audioSnapshot, 7, source(Kind.PART_CONTENT));
        assertThat(audio.text()).isEqualTo("before");
        assertThat(audio.contentHash()).isEqualTo("fm3l1a");
        assertThatThrownBy(() -> reader.verify(
                audioSnapshot, 7, source(Kind.PART_CONTENT), "after", "before"))
                .isInstanceOf(AppException.class);

        Map<String, Object> preSnapshot = snapshotWithContent(PRE_HTML);
        var pre = reader.read(preSnapshot, 7, source(Kind.PART_CONTENT));
        assertThat(pre.text()).isEqualTo("Hello world");
        assertThat(pre.contentHash()).isEqualTo("os091j");
        var verifiedPre = reader.verify(
                preSnapshot, 7, source(Kind.PART_CONTENT), "world", "Hello world");
        assertThat(verifiedPre.start()).isEqualTo(6);
        assertThat(verifiedPre.end()).isEqualTo(11);

        Map<String, Object> scriptDelimiterSnapshot = snapshotWithContent(SCRIPT_DELIMITER_HTML);
        var scriptDelimiter = reader.read(scriptDelimiterSnapshot, 7, source(Kind.PART_CONTENT));
        assertThat(scriptDelimiter.text()).isEqualTo("beforeafter");
        assertThat(scriptDelimiter.contentHash()).isEqualTo("cy95dg");
        assertThatThrownBy(() -> reader.verify(
                scriptDelimiterSnapshot, 7, source(Kind.PART_CONTENT), "hidden words", "beforeafter"))
                .isInstanceOf(AppException.class);

        Map<String, Object> svgSnapshot = snapshotWithContent(SVG_SELF_CLOSING_HTML);
        var svg = reader.read(svgSnapshot, 7, source(Kind.PART_CONTENT));
        assertThat(svg.text()).isEqualTo("visible");
        assertThat(svg.contentHash()).isEqualTo("nktwgx");
        var verifiedSvg = reader.verify(
                svgSnapshot, 7, source(Kind.PART_CONTENT), "visible", "visible");
        assertThat(verifiedSvg.start()).isEqualTo(0);
        assertThat(verifiedSvg.end()).isEqualTo(7);

        Map<String, Object> lessThanDigitSnapshot = snapshotWithContent(LESS_THAN_DIGIT_HTML);
        var lessThanDigit = reader.read(lessThanDigitSnapshot, 7, source(Kind.PART_CONTENT));
        assertThat(lessThanDigit.text()).isEqualTo("2 <3");
        assertThat(lessThanDigit.contentHash()).isEqualTo("16o7b8u");
        var verifiedLessThanDigit = reader.verify(
                lessThanDigitSnapshot, 7, source(Kind.PART_CONTENT), "<3", "2 <3");
        assertThat(verifiedLessThanDigit.start()).isEqualTo(2);
        assertThat(verifiedLessThanDigit.end()).isEqualTo(4);

        Map<String, Object> plaintextSnapshot = snapshotWithContent(PLAINTEXT_HTML);
        var plaintext = reader.read(plaintextSnapshot, 7, source(Kind.PART_CONTENT));
        assertThat(plaintext.text()).isEqualTo("before");
        assertThat(plaintext.contentHash()).isEqualTo("fm3l1a");
        assertThatThrownBy(() -> reader.verify(
                plaintextSnapshot, 7, source(Kind.PART_CONTENT), "public", "before"))
                .isInstanceOf(AppException.class);
    }

    @Test
    void rejectsUnknownFieldsWithSpringDefaultMapperConfiguration() throws Exception {
        ObjectMapper springMapper = Jackson2ObjectMapperBuilder.json().build();
        assertThat(springMapper.isEnabled(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)).isFalse();

        WorkspaceTextSource parsed = springMapper.readValue(
                "{\"kind\":\"OPTION_TEXT\",\"questionId\":\"q1\",\"optionId\":\"A\"}",
                WorkspaceTextSource.class);
        assertThat(parsed.sourceKey()).isEqualTo("OPTION_TEXT:2:q1:1:A");

        for (String payload : List.of(
                "{\"kind\":\"PART_TITLE\",\"answer\":\"private\"}",
                "{\"kind\":\"PART_TITLE\",\"partId\":7}",
                "{\"kind\":\"PART_TITLE\",\"language\":\"vi\"}",
                "{\"kind\":\"PART_TITLE\",\"arbitrary\":\"value\"}")) {
            assertThatThrownBy(() -> springMapper.readValue(payload, WorkspaceTextSource.class))
                    .as(payload)
                    .isInstanceOf(JsonProcessingException.class);
        }
    }

    private static Map<String, Object> snapshot() {
        return map(
                "examLanguage", "en",
                "sections", List.of(section("READING", List.of(part()))));
    }

    private static Map<String, Object> snapshotWithContent(String contentHtml) {
        Map<String, Object> part = part();
        part.put("contentHtml", contentHtml);
        return map("sections", List.of(section("READING", List.of(part))));
    }

    private static Map<String, Object> part() {
        Map<String, Object> question = map(
                "question_id", "q1",
                "type", "SINGLE_CHOICE",
                "question_text", "What is <b>literal</b> &amp; safe?",
                "options", List.of(
                        map("id", "A", "text", "Authored <i>option</i> &amp; text"),
                        map("id", "B", "text", "Second option")),
                "correct_answer", "A",
                "explanation", "private explanation",
                "answer", "private learner answer",
                "ai_feedback", "private feedback");
        question.put("accepted_answers", List.of("private accepted answer"));

        Map<String, Object> contextQuestion = map(
                "question_id", "q-context",
                "question_text", "The rare kākāpō lives near 😀 island.");
        Map<String, Object> group = map(
                "group_id", "g1",
                "instruction", "Choose the best answer.",
                "context_html", GROUP_HTML,
                "questions", List.of(question, contextQuestion));
        group.put("correct_answer", "private group answer");

        return map(
                "id", 7,
                "partTitle", "Reading Part 1",
                "instruction", "Read the passage.",
                "contentHtml", CONTENT_HTML,
                "questionGroups", List.of(group));
    }

    private static Map<String, Object> section(String name, List<Map<String, Object>> parts) {
        return map("name", name, "parts", parts);
    }

    private static WorkspaceTextSource source(Kind kind) {
        return new WorkspaceTextSource(kind, null, null, null);
    }

    private static WorkspaceTextSource groupSource(Kind kind, String groupId) {
        return new WorkspaceTextSource(kind, groupId, null, null);
    }

    private static WorkspaceTextSource questionSource(String questionId) {
        return new WorkspaceTextSource(Kind.QUESTION_TEXT, null, questionId, null);
    }

    private static WorkspaceTextSource optionSource(String questionId, String optionId) {
        return new WorkspaceTextSource(Kind.OPTION_TEXT, null, questionId, optionId);
    }

    private static Map<String, Object> map(Object... pairs) {
        if (pairs.length % 2 != 0) throw new IllegalArgumentException("pairs");
        Map<String, Object> result = new LinkedHashMap<>();
        for (int index = 0; index < pairs.length; index += 2) {
            result.put(String.valueOf(pairs[index]), pairs[index + 1]);
        }
        return result;
    }
}
