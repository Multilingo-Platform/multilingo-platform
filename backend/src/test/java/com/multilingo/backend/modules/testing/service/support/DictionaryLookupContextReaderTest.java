package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupRequest;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DictionaryLookupContextReaderTest {
    private final DictionaryLookupContextReader reader = new DictionaryLookupContextReader(new DictionaryLookupRequestValidator());

    @Test
    void readsIeltsPartPassageAndVerifiesSelectionAndContext() {
        var request = request(4, "part", "kākāpō", "The rare kākāpō lives on the island.");
        var result = reader.read(ieltsSnapshot(), request);
        assertThat(result.sourceContext()).isEqualTo("The rare kākāpō lives on the island.");
        assertThat(result.selectedText()).isEqualTo("kākāpō");
    }

    @Test
    void readsToeicGroupPassageAndDoesNotReadOtherGroups() {
        var snapshot = snapshot("READING", 5, List.of(
                Map.of("group_id", "passage-a", "content_html", "<p>The elms grow in Britain.</p>"),
                Map.of("group_id", "passage-b", "content_html", "<p>A private-scope sentence.</p>")));
        var request = request(5, "passage-a", "elms", "The elms grow in Britain.");
        assertThat(reader.read(snapshot, request).sourceContext()).contains("elms").doesNotContain("private-scope");
    }

    @Test
    void stripsScriptStyleCommentsAndMediaAndDecodesEntities() {
        var snapshot = snapshot("READING", 3, List.of(Map.of("group_id", "g1", "content_html",
                "<p>Tom &amp; Jerry read <b>carefully</b>.</p><!-- ignored --><script>secret()</script><style>.x{}</style><img src='x'>")));
        var request = request(3, "g1", "carefully", "Tom & Jerry read carefully.");
        var result = reader.read(snapshot, request);
        assertThat(result.sourceContext()).isEqualTo("Tom & Jerry read carefully.");
        assertThat(result.sourceContext()).doesNotContain("secret", "ignored", "src");
    }

    @Test
    void rejectsWrongPartUnknownDocumentAndUnverifiedContextOrTerm() {
        var snapshot = ieltsSnapshot();
        assertRejected(snapshot, request(99, "part", "kākāpō", "The rare kākāpō lives on the island."));
        assertRejected(snapshot, request(4, "missing", "kākāpō", "The rare kākāpō lives on the island."));
        assertRejected(snapshot, request(4, "part", "volcano", "The rare kākāpō lives on the island."));
        assertRejected(snapshot, request(4, "part", "kākāpō", "A client invented passage."));
    }

    private void assertRejected(Map<String, Object> snapshot, DictionaryLookupRequest request) {
        assertThatThrownBy(() -> reader.read(snapshot, request)).isInstanceOf(AppException.class);
    }

    private DictionaryLookupRequest request(int partId, String documentId, String word, String context) {
        return new DictionaryLookupRequest(UUID.randomUUID().toString(), partId, documentId, word, context);
    }

    private Map<String, Object> ieltsSnapshot() {
        return snapshot("READING", 4, List.of());
    }

    private Map<String, Object> snapshot(String skill, int partId, List<Map<String, Object>> groups) {
        Map<String, Object> part = new LinkedHashMap<>();
        part.put("id", partId);
        part.put("content_html", "<p>The rare kākāpō lives on the island.</p>");
        if (!groups.isEmpty()) part.put("question_groups", groups);
        return Map.of("sections", List.of(Map.of("name", skill, "parts", List.of(part))));
    }
}
