package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupRequest;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DictionaryLookupRequestValidatorTest {
    private final DictionaryLookupRequestValidator validator = new DictionaryLookupRequestValidator();
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void acceptsUnicodeSelectionAndNormalizesUuid() throws Exception {
        String requestId = UUID.randomUUID().toString().toUpperCase();
        var request = read("""
                {"requestId":"%s","partId":7,"documentId":"group-7-1",
                 "selectedText":"café's well-being","contextText":"The café's well-being matters."}
                """.formatted(requestId));

        assertThat(request.requestId()).isEqualTo(requestId.toLowerCase());
        assertThat(validator.validate(request)).isSameAs(request);
    }

    @Test
    void acceptsExactlyFiveWordsAndContextAtTheLimit() throws Exception {
        String selection = "one two three four five";
        var request = read(body(selection, "x".repeat(1000)));
        assertThat(validator.validate(request).selectedText()).hasSize(23);
        assertThat(validator.validate(read(body("x".repeat(80), "passage"))).selectedText()).hasSize(80);
    }

    @Test
    void rejectsInvalidUuidAndNonPositiveOrNonIntegerPartId() {
        assertInvalid("{\"requestId\":\"bad\",\"partId\":1,\"documentId\":\"part\",\"selectedText\":\"word\",\"contextText\":\"word\"}");
        assertInvalid("{\"requestId\":\"" + UUID.randomUUID() + "\",\"partId\":0,\"documentId\":\"part\",\"selectedText\":\"word\",\"contextText\":\"word\"}");
        assertInvalid("{\"requestId\":\"" + UUID.randomUUID() + "\",\"partId\":1.2,\"documentId\":\"part\",\"selectedText\":\"word\",\"contextText\":\"word\"}");
    }

    @Test
    void acceptsMaxJavaAttemptIdAndRejectsNonCanonicalOrOverflowIds() {
        assertThat(validator.parseAttemptId("2147483647")).isEqualTo(Integer.MAX_VALUE);
        for (String invalid : new String[]{"0", "01", "1.0", "1e2", " 1", "2147483648", "1x"}) {
            assertThatThrownBy(() -> validator.parseAttemptId(invalid)).isInstanceOf(AppException.class);
        }
    }

    @Test
    void rejectsMoreThanFiveWordsAndOversizedText() throws Exception {
        assertThatThrownBy(() -> validator.validate(read(body("one two three four five six", "passage"))))
                .isInstanceOf(AppException.class);
        assertThatThrownBy(() -> validator.validate(read(body("x".repeat(81), "passage"))))
                .isInstanceOf(AppException.class);
    }

    @Test
    void rejectsContextOver1000CodePointsAndUnknownFields() throws Exception {
        assertThatThrownBy(() -> validator.validate(read(body("word", "x".repeat(1001)))))
                .isInstanceOf(AppException.class);
        assertInvalid("{\"requestId\":\"" + UUID.randomUUID() + "\",\"partId\":1,\"documentId\":\"part\",\"selectedText\":\"word\",\"contextText\":\"word\",\"answer\":\"secret\"}");
    }

    @Test
    void rejectsOversizedBodyAndMalformedJson() {
        byte[] tooLarge = new byte[DictionaryLookupRequestValidator.MAX_REQUEST_BODY_BYTES + 1];
        assertThatThrownBy(() -> validator.read(new ByteArrayInputStream(tooLarge))).isInstanceOf(AppException.class);
        assertThatThrownBy(() -> validator.read(stream("{"))).isInstanceOf(AppException.class);
        String duplicate = "{\"requestId\":\"" + UUID.randomUUID() + "\",\"partId\":1,\"documentId\":\"part\",\"selectedText\":\"one\",\"selectedText\":\"two\",\"contextText\":\"one\"}";
        assertThatThrownBy(() -> validator.read(stream(duplicate))).isInstanceOf(AppException.class);
    }

    @Test
    void bodyBuilderProducesUtf8Json() throws Exception {
        assertThat(read(body("café", "A café appears here.")).selectedText()).isEqualTo("café");
    }

    private DictionaryLookupRequest read(String raw) throws Exception {
        return validator.read(stream(raw));
    }

    private String body(String selected, String context) throws Exception {
        return mapper.writeValueAsString(new DictionaryLookupRequest(UUID.randomUUID().toString(), 1, "part", selected, context));
    }

    private void assertInvalid(String body) {
        assertThatThrownBy(() -> validator.read(stream(body))).isInstanceOf(AppException.class);
    }

    private ByteArrayInputStream stream(String value) {
        return new ByteArrayInputStream(value.getBytes(StandardCharsets.UTF_8));
    }
}
