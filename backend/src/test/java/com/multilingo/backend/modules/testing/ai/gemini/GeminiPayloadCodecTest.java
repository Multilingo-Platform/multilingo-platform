package com.multilingo.backend.modules.testing.ai.gemini;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GeminiPayloadCodecTest {

    private GeminiPayloadCodec codec;
    private ObjectMapper testMapper;

    @BeforeEach
    void setUp() {
        codec = new GeminiPayloadCodec();
        testMapper = new ObjectMapper();
    }

    @Test
    @DisplayName("encode TEXT request without systemInstruction produces exact JSON envelope")
    void encodeTextRequestWithoutSystemInstruction() throws Exception {
        String userText = "Viết bài luận về giáo dục: \"học đi đôi với hành\" & <script>alert(1)</script> 📚\nĐoạn 2.";
        GeminiGenerationRequest request = new GeminiGenerationRequest(
                null,
                userText,
                1024,
                GeminiGenerationRequest.OutputFormat.TEXT
        );

        byte[] encoded = codec.encode(request);
        assertThat(encoded).isNotNull();

        JsonNode root = testMapper.readTree(encoded);
        assertThat(root.has("systemInstruction")).isFalse();

        JsonNode contents = root.get("contents");
        assertThat(contents.isArray()).isTrue();
        assertThat(contents.size()).isEqualTo(1);
        assertThat(contents.get(0).get("role").asText()).isEqualTo("user");

        JsonNode parts = contents.get(0).get("parts");
        assertThat(parts.isArray()).isTrue();
        assertThat(parts.size()).isEqualTo(1);
        assertThat(parts.get(0).get("text").asText()).isEqualTo(userText);

        JsonNode genConfig = root.get("generationConfig");
        assertThat(genConfig.get("candidateCount").asInt()).isEqualTo(1);
        assertThat(genConfig.get("maxOutputTokens").asInt()).isEqualTo(1024);
        assertThat(genConfig.get("responseMimeType").asText()).isEqualTo("text/plain");
    }

    @Test
    @DisplayName("encode JSON request with systemInstruction produces exact JSON envelope")
    void encodeJsonRequestWithSystemInstruction() throws Exception {
        String systemInstruction = "Bạn là trợ lý chấm thi IELTS chuyên nghiệp.";
        String userText = "Đánh giá bài viết sau.";
        GeminiGenerationRequest request = new GeminiGenerationRequest(
                systemInstruction,
                userText,
                2048,
                GeminiGenerationRequest.OutputFormat.JSON
        );

        byte[] encoded = codec.encode(request);
        JsonNode root = testMapper.readTree(encoded);

        JsonNode sysNode = root.get("systemInstruction");
        assertThat(sysNode).isNotNull();
        assertThat(sysNode.get("parts").get(0).get("text").asText()).isEqualTo(systemInstruction);

        JsonNode genConfig = root.get("generationConfig");
        assertThat(genConfig.get("candidateCount").asInt()).isEqualTo(1);
        assertThat(genConfig.get("maxOutputTokens").asInt()).isEqualTo(2048);
        assertThat(genConfig.get("responseMimeType").asText()).isEqualTo("application/json");
    }

    @Test
    @DisplayName("encode rejects null request")
    void encodeRejectsNullRequest() {
        assertThatThrownBy(() -> codec.encode(null))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.INVALID_INPUT);
                    assertThat(ex.isRetryable()).isFalse();
                });
    }

    @Test
    @DisplayName("encode rejects payload exceeding MAX_REQUEST_BYTES (131,072 bytes)")
    void encodeRejectsOversizeRequest() {
        // Create user text that forces the payload over 131,072 bytes
        String hugeText = "a".repeat(131_100);
        GeminiGenerationRequest request = new GeminiGenerationRequest(
                null,
                hugeText,
                1024,
                GeminiGenerationRequest.OutputFormat.TEXT
        );

        assertThatThrownBy(() -> codec.encode(request))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.INVALID_INPUT);
                    assertThat(ex.getMessage()).contains("131072");
                });
    }

    @Test
    @DisplayName("decode successful STOP candidate with single text part and usageMetadata")
    void decodeSuccessfulStopCandidate() {
        String json = """
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [
                          { "text": "Kết quả phân tích bài viết thành công." }
                        ],
                        "role": "model"
                      },
                      "finishReason": "STOP",
                      "index": 0
                    }
                  ],
                  "usageMetadata": {
                    "promptTokenCount": 120,
                    "candidatesTokenCount": 45,
                    "totalTokenCount": 165
                  }
                }
                """;

        GeminiGenerationResult result = codec.decode(json.getBytes(StandardCharsets.UTF_8));
        assertThat(result.text()).isEqualTo("Kết quả phân tích bài viết thành công.");
        assertThat(result.usage()).isNotNull();
        assertThat(result.usage().promptTokens()).isEqualTo(120);
        assertThat(result.usage().candidateTokens()).isEqualTo(45);
        assertThat(result.usage().totalTokens()).isEqualTo(165);
    }

    @Test
    @DisplayName("decode skips thought parts and preserves exact Vietnamese final text (Plan Assertion)")
    void decodeSkipsThoughtPartsAndPreservesText() {
        String json = """
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [
                          { "thought": true, "text": "PRIVATE_THOUGHT" },
                          { "text": "Kết quả tiếng Việt" }
                        ],
                        "role": "model"
                      },
                      "finishReason": "STOP"
                    }
                  ]
                }
                """;

        GeminiGenerationResult result = codec.decode(json.getBytes(StandardCharsets.UTF_8));
        assertThat(result.text()).isEqualTo("Kết quả tiếng Việt");
        assertThat(result.text()).doesNotContain("PRIVATE_THOUGHT");
        assertThat(result.usage()).isNull();
    }

    @Test
    @DisplayName("decode joins multiple text parts in order")
    void decodeJoinsMultipleTextParts() {
        String json = """
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [
                          { "text": "Phần mở đầu. " },
                          { "text": "Phần thân bài. " },
                          { "text": "Phần kết luận." }
                        ]
                      },
                      "finishReason": "STOP"
                    }
                  ]
                }
                """;

        GeminiGenerationResult result = codec.decode(json.getBytes(StandardCharsets.UTF_8));
        assertThat(result.text()).isEqualTo("Phần mở đầu. Phần thân bài. Phần kết luận.");
    }

    @Test
    @DisplayName("decode rejects candidate with tool/file output")
    void decodeRejectsToolOutput() {
        String json = """
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [
                          {
                            "functionCall": {
                              "name": "lookupDictionary",
                              "args": { "word": "example" }
                            }
                          }
                        ]
                      },
                      "finishReason": "STOP"
                    }
                  ]
                }
                """;

        assertThatThrownBy(() -> codec.decode(json.getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> assertThat(((GeminiClientException) e).getKind())
                        .isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE));
    }

    @Test
    @DisplayName("decode rejects candidate when text parts are empty or only thought")
    void decodeRejectsEmptyText() {
        String onlyThoughtJson = """
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [
                          { "thought": true, "text": "Thinking only..." }
                        ]
                      },
                      "finishReason": "STOP"
                    }
                  ]
                }
                """;

        assertThatThrownBy(() -> codec.decode(onlyThoughtJson.getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> assertThat(((GeminiClientException) e).getKind())
                        .isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE));

        String blankTextJson = """
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [
                          { "text": "    " }
                        ]
                      },
                      "finishReason": "STOP"
                    }
                  ]
                }
                """;

        assertThatThrownBy(() -> codec.decode(blankTextJson.getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> assertThat(((GeminiClientException) e).getKind())
                        .isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE));
    }

    @Test
    @DisplayName("decode handles promptFeedback blocked reason as BLOCKED")
    void decodeHandlesPromptFeedbackBlocked() {
        String json = """
                {
                  "promptFeedback": {
                    "blockReason": "SAFETY"
                  }
                }
                """;

        assertThatThrownBy(() -> codec.decode(json.getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.BLOCKED);
                    assertThat(ex.isRetryable()).isFalse();
                });
    }

    @ParameterizedTest
    @ValueSource(strings = {"SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"})
    @DisplayName("decode candidate blocked finishReason mapped to BLOCKED")
    void decodeCandidateBlockedFinishReasons(String finishReason) {
        String json = String.format("""
                {
                  "candidates": [
                    {
                      "finishReason": "%s"
                    }
                  ]
                }
                """, finishReason);

        assertThatThrownBy(() -> codec.decode(json.getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.BLOCKED);
                    assertThat(ex.isRetryable()).isFalse();
                });
    }

    @Test
    @DisplayName("decode candidate MAX_TOKENS mapped to INCOMPLETE")
    void decodeMaxTokensMappedToIncomplete() {
        String json = """
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [ { "text": "Bị cắt ngang..." } ]
                      },
                      "finishReason": "MAX_TOKENS"
                    }
                  ]
                }
                """;

        assertThatThrownBy(() -> codec.decode(json.getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.INCOMPLETE);
                    assertThat(ex.isRetryable()).isFalse();
                });
    }

    @ParameterizedTest
    @ValueSource(strings = {"OTHER", "UNKNOWN", "FINISH_REASON_UNSPECIFIED"})
    @DisplayName("decode candidate unknown finishReason mapped to INVALID_RESPONSE")
    void decodeUnknownFinishReason(String finishReason) {
        String json = String.format("""
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [ { "text": "Nội dung" } ]
                      },
                      "finishReason": "%s"
                    }
                  ]
                }
                """, finishReason);

        assertThatThrownBy(() -> codec.decode(json.getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> assertThat(((GeminiClientException) e).getKind())
                        .isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE));
    }

    @Test
    @DisplayName("decode missing or multiple candidates mapped to INVALID_RESPONSE")
    void decodeMissingOrMultipleCandidates() {
        String emptyCandidates = """
                { "candidates": [] }
                """;

        assertThatThrownBy(() -> codec.decode(emptyCandidates.getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> assertThat(((GeminiClientException) e).getKind())
                        .isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE));

        String multipleCandidates = """
                {
                  "candidates": [
                    { "content": { "parts": [ { "text": "1" } ] }, "finishReason": "STOP" },
                    { "content": { "parts": [ { "text": "2" } ] }, "finishReason": "STOP" }
                  ]
                }
                """;

        assertThatThrownBy(() -> codec.decode(multipleCandidates.getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> assertThat(((GeminiClientException) e).getKind())
                        .isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE));
    }

    @Test
    @DisplayName("decode malformed or trailing JSON throws safe INVALID_RESPONSE without Jackson cause")
    void decodeMalformedJsonThrowsSafeException() {
        String malformedJson = "{\"candidates\": [{\"fin";

        assertThatThrownBy(() -> codec.decode(malformedJson.getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE);
                    assertThat(ex.getCause()).isNull();

                    StringWriter sw = new StringWriter();
                    ex.printStackTrace(new PrintWriter(sw));
                    assertThat(sw.toString()).doesNotContain("Jackson");
                });
    }

    @Test
    @DisplayName("decode invalid UTF-8 bytes throws safe INVALID_RESPONSE")
    void decodeInvalidUtf8Bytes() {
        byte[] invalidUtf8 = new byte[]{(byte) 0xC0, (byte) 0xAF};

        assertThatThrownBy(() -> codec.decode(invalidUtf8))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> assertThat(((GeminiClientException) e).getKind())
                        .isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE));
    }

    private static byte[] buildValidEnvelopeWithCustomTextBytes(byte[] textBytes) {
        byte[] prefix = "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"".getBytes(StandardCharsets.UTF_8);
        byte[] suffix = "\"}],\"role\":\"model\"},\"finishReason\":\"STOP\"}]}".getBytes(StandardCharsets.UTF_8);
        byte[] combined = new byte[prefix.length + textBytes.length + suffix.length];
        System.arraycopy(prefix, 0, combined, 0, prefix.length);
        System.arraycopy(textBytes, 0, combined, prefix.length, textBytes.length);
        System.arraycopy(suffix, 0, combined, prefix.length + textBytes.length, suffix.length);
        return combined;
    }

    @Test
    @DisplayName("decode rejects overlong UTF-8 bytes (C0 AF) embedded inside valid JSON text (P1)")
    void decodeRejectsOverlongUtf8InsideJsonString() {
        byte[] overlongPayload = buildValidEnvelopeWithCustomTextBytes(new byte[]{(byte) 0xC0, (byte) 0xAF});

        assertThatThrownBy(() -> codec.decode(overlongPayload))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE);
                    assertThat(ex.getCause()).isNull();

                    StringWriter sw = new StringWriter();
                    ex.printStackTrace(new PrintWriter(sw));
                    assertThat(sw.toString()).doesNotContain("C0").doesNotContain("AF");
                });
    }

    @Test
    @DisplayName("decode rejects UTF-16 surrogate sequence (ED A0 80) in UTF-8 inside valid JSON text (P1)")
    void decodeRejectsUtf16SurrogateInUtf8InsideJsonString() {
        byte[] surrogatePayload = buildValidEnvelopeWithCustomTextBytes(new byte[]{(byte) 0xED, (byte) 0xA0, (byte) 0x80});

        assertThatThrownBy(() -> codec.decode(surrogatePayload))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE);
                    assertThat(ex.getCause()).isNull();
                });
    }

    @Test
    @DisplayName("decode rejects out-of-range UTF-8 byte (FF) inside valid JSON text (P1)")
    void decodeRejectsOutOfRangeUtf8ByteInsideJsonString() {
        byte[] outOfRangePayload = buildValidEnvelopeWithCustomTextBytes(new byte[]{(byte) 0xFF});

        assertThatThrownBy(() -> codec.decode(outOfRangePayload))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE);
                    assertThat(ex.getCause()).isNull();
                });
    }

    @Test
    @DisplayName("decode rejects truncated multibyte UTF-8 sequence (C2) inside valid JSON text (P1)")
    void decodeRejectsTruncatedMultibyteUtf8InsideJsonString() {
        byte[] truncatedPayload = buildValidEnvelopeWithCustomTextBytes(new byte[]{(byte) 0xC2});

        assertThatThrownBy(() -> codec.decode(truncatedPayload))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE);
                    assertThat(ex.getCause()).isNull();
                });
    }

    @Test
    @DisplayName("decode preserves valid UTF-8 Vietnamese and emoji text inside valid JSON envelope (P1)")
    void decodePreservesValidUtf8VietnameseAndEmoji() {
        String expectedText = "Chào mừng bạn! Bài thi tiếng Việt: ă, â, đ, ê, ô, ơ, ư & biểu cảm: 📚✨🎉";
        byte[] validPayload = buildValidEnvelopeWithCustomTextBytes(expectedText.getBytes(StandardCharsets.UTF_8));

        GeminiGenerationResult result = codec.decode(validPayload);
        assertThat(result.text()).isEqualTo(expectedText);
    }

    @Test
    @DisplayName("decode response body exceeding MAX_RESPONSE_BYTES (524,288) throws RESPONSE_TOO_LARGE")
    void decodeResponseTooLarge() {
        byte[] oversize = new byte[GeminiProperties.MAX_RESPONSE_BYTES + 1];

        assertThatThrownBy(() -> codec.decode(oversize))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.RESPONSE_TOO_LARGE);
                    assertThat(ex.isRetryable()).isFalse();
                });
    }

    @Test
    @DisplayName("decode null or empty response body throws INVALID_RESPONSE")
    void decodeNullOrEmptyBody() {
        assertThatThrownBy(() -> codec.decode(null))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> assertThat(((GeminiClientException) e).getKind())
                        .isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE));

        assertThatThrownBy(() -> codec.decode(new byte[0]))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> assertThat(((GeminiClientException) e).getKind())
                        .isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE));
    }

    @Test
    @DisplayName("decode with unsupported finishReason uses fixed message and never leaks upstream finishReason (P1)")
    void decodeUnsupportedFinishReasonNeverLeaksSentinel() {
        String sentinelSecret = "SECRET_PROVIDER_BODY_SENTINEL_12345";
        String json = String.format("""
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [ { "text": "Nội dung" } ]
                      },
                      "finishReason": "%s"
                    }
                  ]
                }
                """, sentinelSecret);

        assertThatThrownBy(() -> codec.decode(json.getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE);
                    assertThat(ex.getMessage()).isEqualTo("Candidate finishReason is unsupported");
                    assertThat(ex.getMessage()).doesNotContain(sentinelSecret);
                    assertThat(ex.toString()).doesNotContain(sentinelSecret);

                    StringWriter sw = new StringWriter();
                    ex.printStackTrace(new PrintWriter(sw));
                    assertThat(sw.toString()).doesNotContain(sentinelSecret);
                    assertThat(ex.getCause()).isNull();
                });
    }

    @Test
    @DisplayName("encode at exact MAX_REQUEST_BYTES (131,072) succeeds; at cap + 1 fails with INVALID_INPUT (P1)")
    void encodeExactCapAndCapPlusOne() {
        GeminiGenerationRequest baselineReq = new GeminiGenerationRequest(
                null,
                "a",
                1024,
                GeminiGenerationRequest.OutputFormat.TEXT
        );
        int baselineLen = codec.encode(baselineReq).length;
        int overhead = baselineLen - 1;

        int exactTextLen = GeminiProperties.MAX_REQUEST_BYTES - overhead;
        GeminiGenerationRequest exactReq = new GeminiGenerationRequest(
                null,
                "a".repeat(exactTextLen),
                1024,
                GeminiGenerationRequest.OutputFormat.TEXT
        );
        byte[] exactBytes = codec.encode(exactReq);
        assertThat(exactBytes.length).isEqualTo(GeminiProperties.MAX_REQUEST_BYTES);

        GeminiGenerationRequest capPlusOneReq = new GeminiGenerationRequest(
                null,
                "a".repeat(exactTextLen + 1),
                1024,
                GeminiGenerationRequest.OutputFormat.TEXT
        );
        assertThatThrownBy(() -> codec.encode(capPlusOneReq))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.INVALID_INPUT);
                    assertThat(ex.getMessage()).contains("131072");
                });
    }

    @Test
    @DisplayName("encode with Unicode and JSON escaping expansion past MAX_REQUEST_BYTES fails with INVALID_INPUT (P1)")
    void encodeUnicodeAndEscapingExpansionPastCap() {
        String quotesText = "\"".repeat(70_000);
        GeminiGenerationRequest request = new GeminiGenerationRequest(
                null,
                quotesText,
                1024,
                GeminiGenerationRequest.OutputFormat.TEXT
        );

        assertThatThrownBy(() -> codec.encode(request))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.INVALID_INPUT);
                });
    }

    @ParameterizedTest
    @ValueSource(strings = {
            """
            { "promptTokenCount": 1.9 }
            """,
            """
            { "candidatesTokenCount": -0.5 }
            """,
            """
            { "promptTokenCount": "10" }
            """,
            """
            { "totalTokenCount": true }
            """,
            """
            { "promptTokenCount": 3000000000 }
            """,
            """
            { "promptTokenCount": -1 }
            """
    })
    @DisplayName("decode rejects fractional, negative, string, boolean, or out-of-range usage counters (P1)")
    void decodeRejectsInvalidUsageCounters(String usageJson) {
        String json = String.format("""
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [ { "text": "Valid text" } ]
                      },
                      "finishReason": "STOP"
                    }
                  ],
                  "usageMetadata": %s
                }
                """, usageJson);

        assertThatThrownBy(() -> codec.decode(json.getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> assertThat(((GeminiClientException) e).getKind())
                        .isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE));
    }

    @Test
    @DisplayName("decode accepts zero and valid non-negative integer usage counters (P1)")
    void decodeAcceptsZeroAndValidUsageCounters() {
        String json = """
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [ { "text": "Valid text" } ]
                      },
                      "finishReason": "STOP"
                    }
                  ],
                  "usageMetadata": {
                    "promptTokenCount": 0,
                    "candidatesTokenCount": 100,
                    "totalTokenCount": 100
                  }
                }
                """;

        GeminiGenerationResult result = codec.decode(json.getBytes(StandardCharsets.UTF_8));
        assertThat(result.usage()).isNotNull();
        assertThat(result.usage().promptTokens()).isEqualTo(0);
        assertThat(result.usage().candidateTokens()).isEqualTo(100);
        assertThat(result.usage().totalTokens()).isEqualTo(100);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            """
            { "text": 123 }
            """,
            """
            { "text": true }
            """,
            """
            { "text": null }
            """,
            """
            { "text": {} }
            """,
            """
            { "text": [] }
            """,
            """
            {}
            """
    })
    @DisplayName("decode rejects candidate when content part text is non-string or missing (P1)")
    void decodeRejectsNonStringOrMissingPartText(String partJson) {
        String json = String.format("""
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [ %s ]
                      },
                      "finishReason": "STOP"
                    }
                  ]
                }
                """, partJson);

        assertThatThrownBy(() -> codec.decode(json.getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> assertThat(((GeminiClientException) e).getKind())
                        .isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE));
    }

    @Test
    @DisplayName("decode rejects candidate with mixed valid and non-string text parts (P1)")
    void decodeRejectsMixedValidAndNonStringParts() {
        String json = """
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [
                          { "text": "Valid part 1" },
                          { "text": 456 }
                        ]
                      },
                      "finishReason": "STOP"
                    }
                  ]
                }
                """;

        assertThatThrownBy(() -> codec.decode(json.getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> assertThat(((GeminiClientException) e).getKind())
                        .isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE));
    }

    @Test
    @DisplayName("decode rejects JSON with trailing tokens (P1)")
    void decodeRejectsTrailingJsonTokens() {
        String validWithTrailing = """
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [ { "text": "Valid text" } ]
                      },
                      "finishReason": "STOP"
                    }
                  ]
                }
                {"extra": "trailing"}
                """;

        assertThatThrownBy(() -> codec.decode(validWithTrailing.getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> assertThat(((GeminiClientException) e).getKind())
                        .isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE));
    }
}
