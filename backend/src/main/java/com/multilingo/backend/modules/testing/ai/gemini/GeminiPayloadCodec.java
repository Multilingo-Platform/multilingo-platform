package com.multilingo.backend.modules.testing.ai.gemini;

import com.fasterxml.jackson.core.json.JsonReadFeature;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.Base64;

/**
 * Encodes requests to Google Gemini generateContent wire format and normalizes responses.
 * Uses a dedicated, unshared Jackson ObjectMapper and enforces payload byte caps.
 */
public class GeminiPayloadCodec {

    private static final Set<String> SAFETY_BLOCKED_FINISH_REASONS = Set.of(
            "SAFETY",
            "RECITATION",
            "BLOCKLIST",
            "PROHIBITED_CONTENT",
            "SPII",
            "IMAGE_SAFETY",
            "IMAGE_PROHIBITED_CONTENT",
            "IMAGE_RECITATION"
    );

    private final ObjectMapper objectMapper;

    public GeminiPayloadCodec() {
        this.objectMapper = new ObjectMapper();
        this.objectMapper.configure(DeserializationFeature.FAIL_ON_TRAILING_TOKENS, true);
        this.objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    /**
     * Encodes a generation request to UTF-8 wire JSON bytes.
     *
     * @param request the generation request
     * @return serialized JSON byte array
     * @throws GeminiClientException on null request, oversize payload, or serialization error
     */
    public byte[] encode(GeminiGenerationRequest request) {
        if (request == null) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.INVALID_INPUT,
                    "request must not be null"
            );
        }

        try {
            ObjectNode root = objectMapper.createObjectNode();

            if (request.systemInstruction() != null) {
                ObjectNode sysInstruction = root.putObject("systemInstruction");
                ArrayNode sysParts = sysInstruction.putArray("parts");
                sysParts.addObject().put("text", request.systemInstruction());
            }

            ArrayNode contents = root.putArray("contents");
            ObjectNode userContent = contents.addObject();
            userContent.put("role", "user");
            ArrayNode userParts = userContent.putArray("parts");
            for (GeminiImagePart image : request.images()) {
                ObjectNode inline = userParts.addObject().putObject("inlineData");
                inline.put("mimeType", image.mimeType());
                inline.put("data", Base64.getEncoder().encodeToString(image.data()));
            }
            userParts.addObject().put("text", request.userText());

            ObjectNode genConfig = root.putObject("generationConfig");
            genConfig.put("candidateCount", 1);
            genConfig.put("maxOutputTokens", request.maxOutputTokens());
            String responseMimeType = request.outputFormat() == GeminiGenerationRequest.OutputFormat.JSON
                    ? "application/json"
                    : "text/plain";
            genConfig.put("responseMimeType", responseMimeType);

            int requestLimit = request.images().isEmpty() ? GeminiProperties.MAX_REQUEST_BYTES
                    : GeminiProperties.MAX_MULTIMODAL_REQUEST_BYTES;
            BoundedByteArrayOutputStream out = new BoundedByteArrayOutputStream(requestLimit);
            try {
                objectMapper.writeValue(out, root);
                return out.toByteArray();
            } catch (PayloadLimitExceededException e) {
                throw new GeminiClientException(
                        GeminiClientException.Kind.INVALID_INPUT,
                        "Request payload exceeds maximum allowed size of " + requestLimit + " bytes"
                );
            } catch (Exception e) {
                if (isPayloadLimitExceeded(e)) {
                    throw new GeminiClientException(
                            GeminiClientException.Kind.INVALID_INPUT,
                            "Request payload exceeds maximum allowed size of " + requestLimit + " bytes"
                    );
                }
                throw new GeminiClientException(
                        GeminiClientException.Kind.INVALID_INPUT,
                        "Failed to serialize request payload"
                );
            }
        } catch (GeminiClientException e) {
            throw e;
        } catch (Exception e) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.INVALID_INPUT,
                    "Failed to serialize request payload"
            );
        }
    }

    /**
     * Decodes and validates a raw provider response body into a normalized result.
     *
     * @param responseBody raw UTF-8 bytes from provider
     * @return normalized result
     * @throws GeminiClientException on malformed JSON, blocked, incomplete, or oversize responses
     */
    public GeminiGenerationResult decode(byte[] responseBody) {
        if (responseBody == null || responseBody.length == 0) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.INVALID_RESPONSE,
                    "Response body must not be null or empty"
            );
        }

        if (responseBody.length > GeminiProperties.MAX_RESPONSE_BYTES) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.RESPONSE_TOO_LARGE,
                    "Response body exceeds maximum allowed size of " + GeminiProperties.MAX_RESPONSE_BYTES + " bytes"
            );
        }

        String jsonText;
        try {
            CharsetDecoder decoder = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT);
            jsonText = decoder.decode(ByteBuffer.wrap(responseBody)).toString();
        } catch (CharacterCodingException e) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.INVALID_RESPONSE,
                    "Failed to parse provider response JSON"
            );
        }

        JsonNode root;
        try (var parser = objectMapper.createParser(jsonText)) {
            root = objectMapper.readTree(parser);
            if (root == null || parser.nextToken() != null) {
                throw new GeminiClientException(
                        GeminiClientException.Kind.INVALID_RESPONSE,
                        "Failed to parse provider response JSON"
                );
            }
        } catch (GeminiClientException e) {
            throw e;
        } catch (Exception e) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.INVALID_RESPONSE,
                    "Failed to parse provider response JSON"
            );
        }

        if (!root.isObject()) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.INVALID_RESPONSE,
                    "Response root must be a JSON object"
            );
        }

        // 1. Check prompt-level safety block
        if (root.has("promptFeedback")) {
            JsonNode promptFeedback = root.get("promptFeedback");
            if (!promptFeedback.isObject()
                    || (promptFeedback.hasNonNull("blockReason") && !promptFeedback.get("blockReason").isTextual())) {
                throw new GeminiClientException(GeminiClientException.Kind.INVALID_RESPONSE,
                        "Invalid prompt feedback in provider response");
            }
            if (promptFeedback.has("blockReason") && !promptFeedback.get("blockReason").isNull()
                    && !promptFeedback.get("blockReason").asText().isBlank()) {
                throw new GeminiClientException(
                        GeminiClientException.Kind.BLOCKED,
                        "Prompt was blocked by upstream provider safety filters"
                );
            }
        }

        // 2. Validate candidates array (must contain exactly 1 candidate)
        if (!root.has("candidates") || !root.get("candidates").isArray() || root.get("candidates").size() != 1) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.INVALID_RESPONSE,
                    "Expected exactly 1 candidate in provider response envelope"
            );
        }

        JsonNode candidate = root.get("candidates").get(0);
        if (!candidate.isObject()) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.INVALID_RESPONSE,
                    "Candidate must be a JSON object"
            );
        }

        // 3. Inspect candidate finishReason
        if (!candidate.has("finishReason") || candidate.get("finishReason").isNull()
                || candidate.get("finishReason").asText().isBlank()) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.INVALID_RESPONSE,
                    "Candidate finishReason is missing or blank"
            );
        }

        String finishReason = candidate.get("finishReason").asText();
        if ("MAX_TOKENS".equals(finishReason)) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.INCOMPLETE,
                    "Generation reached maximum output token limit"
            );
        }

        if (SAFETY_BLOCKED_FINISH_REASONS.contains(finishReason)) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.BLOCKED,
                    "Generation was blocked by upstream provider safety filters"
            );
        }

        if (!"STOP".equals(finishReason)) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.INVALID_RESPONSE,
                    "Candidate finishReason is unsupported"
            );
        }

        // 4. Extract content text parts (skip thought parts, reject tool outputs)
        if (!candidate.has("content") || !candidate.get("content").isObject()) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.INVALID_RESPONSE,
                    "Candidate content is missing or invalid"
            );
        }

        JsonNode content = candidate.get("content");
        if (!content.has("parts") || !content.get("parts").isArray() || content.get("parts").isEmpty()) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.INVALID_RESPONSE,
                    "Candidate content parts are missing or empty"
            );
        }

        StringBuilder textBuilder = new StringBuilder();
        for (JsonNode part : content.get("parts")) {
            if (!part.isObject()) {
                throw new GeminiClientException(
                        GeminiClientException.Kind.INVALID_RESPONSE,
                        "Content part must be a JSON object"
                );
            }

            // Skip thought parts
            if (part.has("thought") && part.get("thought").asBoolean(false)) {
                continue;
            }

            // Reject tool or file outputs
            if (part.has("functionCall") || part.has("functionResponse")
                    || part.has("inlineData") || part.has("fileData")) {
                throw new GeminiClientException(
                        GeminiClientException.Kind.INVALID_RESPONSE,
                        "Unsupported content part type in candidate"
                );
            }

            if (!part.has("text") || !part.get("text").isTextual()) {
                throw new GeminiClientException(
                        GeminiClientException.Kind.INVALID_RESPONSE,
                        "Candidate content part text must be a string"
                );
            }

            textBuilder.append(part.get("text").textValue());
        }

        String combinedText = textBuilder.toString();
        if (combinedText.isBlank()) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.INVALID_RESPONSE,
                    "Candidate text is empty or blank"
            );
        }

        // 5. Extract optional usage metadata
        GeminiGenerationResult.Usage usage = null;
        if (root.has("usageMetadata") && !root.get("usageMetadata").isNull()) {
            JsonNode usageNode = root.get("usageMetadata");
            if (!usageNode.isObject()) {
                throw new GeminiClientException(
                        GeminiClientException.Kind.INVALID_RESPONSE,
                        "usageMetadata must be an object"
                );
            }

            Integer promptTokens = parseTokenCount(usageNode, "promptTokenCount");
            Integer candidateTokens = parseTokenCount(usageNode, "candidatesTokenCount");
            Integer totalTokens = parseTokenCount(usageNode, "totalTokenCount");
            usage = new GeminiGenerationResult.Usage(promptTokens, candidateTokens, totalTokens);
        }

        return new GeminiGenerationResult(combinedText, usage);
    }

    private Integer parseTokenCount(JsonNode node, String fieldName) {
        if (!node.has(fieldName) || node.get(fieldName).isNull()) {
            return null;
        }
        JsonNode countNode = node.get(fieldName);
        if (!countNode.isIntegralNumber() || !countNode.canConvertToInt() || countNode.intValue() < 0) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.INVALID_RESPONSE,
                    "Invalid token count in usage metadata"
            );
        }
        return countNode.intValue();
    }

    private static boolean isPayloadLimitExceeded(Throwable t) {
        Throwable current = t;
        while (current != null) {
            if (current instanceof PayloadLimitExceededException) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private static final class PayloadLimitExceededException extends RuntimeException {
    }

    private static final class BoundedByteArrayOutputStream extends java.io.ByteArrayOutputStream {
        private final int maxBytes;

        BoundedByteArrayOutputStream(int maxBytes) {
            super(Math.min(maxBytes, 8192));
            this.maxBytes = maxBytes;
        }

        @Override
        public synchronized void write(int b) {
            if (count + 1 > maxBytes) {
                throw new PayloadLimitExceededException();
            }
            super.write(b);
        }

        @Override
        public synchronized void write(byte[] b, int off, int len) {
            if (len > 0 && count + len > maxBytes) {
                throw new PayloadLimitExceededException();
            }
            super.write(b, off, len);
        }
    }
}
