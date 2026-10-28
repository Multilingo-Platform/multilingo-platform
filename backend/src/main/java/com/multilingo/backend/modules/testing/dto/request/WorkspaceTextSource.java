package com.multilingo.backend.modules.testing.dto.request;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;

import java.io.IOException;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;

/**
 * Stable identity of one authored, selectable workspace text source.
 *
 * <p>The record is intentionally strict: every source kind has exactly the ids it needs, ids are
 * bounded, and unknown JSON fields are rejected by the deserializer below. A source never carries
 * text, answers, explanations or arbitrary snapshot fields.</p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonDeserialize(using = WorkspaceTextSource.StrictDeserializer.class)
public record WorkspaceTextSource(Kind kind, String groupId, String questionId, String optionId) {
    private static final Set<String> JSON_FIELDS = Set.of("kind", "groupId", "questionId", "optionId");

    public enum Kind {
        PART_TITLE,
        PART_INSTRUCTION,
        PART_CONTENT,
        GROUP_INSTRUCTION,
        GROUP_CONTENT,
        QUESTION_TEXT,
        OPTION_TEXT
    }

    public WorkspaceTextSource {
        if (kind == null) throw new IllegalArgumentException("kind is required");
        boolean groupSource = kind == Kind.GROUP_INSTRUCTION || kind == Kind.GROUP_CONTENT;
        boolean questionSource = kind == Kind.QUESTION_TEXT || kind == Kind.OPTION_TEXT;
        boolean optionSource = kind == Kind.OPTION_TEXT;
        groupId = id(groupId, groupSource, "groupId");
        questionId = id(questionId, questionSource, "questionId");
        optionId = id(optionId, optionSource, "optionId");
    }

    public String sourceKey() {
        return switch (kind) {
            case PART_TITLE, PART_INSTRUCTION, PART_CONTENT -> kind.name();
            case GROUP_INSTRUCTION, GROUP_CONTENT -> kind.name() + ":" + keyPart(groupId);
            case QUESTION_TEXT -> kind.name() + ":" + keyPart(questionId);
            case OPTION_TEXT -> kind.name() + ":" + keyPart(questionId) + ":" + keyPart(optionId);
        };
    }

    /**
     * Stable document id bounded to 128 characters for database columns.
     * When the full sourceKey exceeds 128 chars (e.g. with max-length ids),
     * a collision-resistant namespaced SHA-256 hash is used.
     */
    public String ledgerDocumentId() {
        String key = sourceKey();
        if (key.length() <= 128) {
            return key;
        }
        try {
            byte[] digest = java.security.MessageDigest.getInstance("SHA-256")
                    .digest(key.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return kind.name() + ":h:" + java.util.HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    public boolean htmlContent() {
        return kind == Kind.PART_CONTENT || kind == Kind.GROUP_CONTENT;
    }

    public static WorkspaceTextSource part(Kind kind) {
        return new WorkspaceTextSource(kind, null, null, null);
    }

    public static WorkspaceTextSource group(Kind kind, String groupId) {
        return new WorkspaceTextSource(kind, groupId, null, null);
    }

    public static WorkspaceTextSource question(String questionId) {
        return new WorkspaceTextSource(Kind.QUESTION_TEXT, null, questionId, null);
    }

    public static WorkspaceTextSource option(String questionId, String optionId) {
        return new WorkspaceTextSource(Kind.OPTION_TEXT, null, questionId, optionId);
    }

    private static String keyPart(String value) {
        return value == null ? "0" : value.length() + ":" + value;
    }

    private static String id(String value, boolean required, String name) {
        if (!required) {
            if (value != null) throw new IllegalArgumentException(name + " is not allowed for this source");
            return null;
        }
        if (value == null || value.isBlank() || value.length() > 128
                || !Objects.equals(value, value.strip())
                || value.codePoints().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException(name + " is invalid");
        }
        return value;
    }

    /**
     * Rejects unknown JSON fields inside the contract itself. Spring Boot disables
     * {@code FAIL_ON_UNKNOWN_PROPERTIES} globally, so relying on
     * {@code @JsonIgnoreProperties(ignoreUnknown = false)} would silently accept stray fields.
     */
    public static final class StrictDeserializer extends StdDeserializer<WorkspaceTextSource> {
        public StrictDeserializer() {
            super(WorkspaceTextSource.class);
        }

        @Override
        public WorkspaceTextSource deserialize(JsonParser parser, DeserializationContext context)
                throws IOException {
            if (!parser.isExpectedStartObjectToken()) {
                throw JsonMappingException.from(parser, "Workspace text source must be a JSON object");
            }
            Kind kind = null;
            String groupId = null;
            String questionId = null;
            String optionId = null;
            Set<String> seen = new HashSet<>();
            JsonToken token;
            while ((token = parser.nextToken()) != null && token != JsonToken.END_OBJECT) {
                String field = parser.getCurrentName();
                if (field == null || !JSON_FIELDS.contains(field)) {
                    throw JsonMappingException.from(
                            parser, "Unknown field '" + field + "' in workspace text source");
                }
                if (!seen.add(field)) {
                    throw JsonMappingException.from(
                            parser, "Duplicate field '" + field + "' in workspace text source");
                }
                JsonToken value = parser.nextToken();
                switch (field) {
                    case "kind" -> kind = readKind(parser, value);
                    case "groupId" -> groupId = readText(parser, value, field);
                    case "questionId" -> questionId = readText(parser, value, field);
                    case "optionId" -> optionId = readText(parser, value, field);
                    default -> throw new IllegalStateException("Unexpected field " + field);
                }
            }
            try {
                return new WorkspaceTextSource(kind, groupId, questionId, optionId);
            } catch (IllegalArgumentException exception) {
                throw JsonMappingException.from(parser, exception.getMessage());
            }
        }

        private static Kind readKind(JsonParser parser, JsonToken token) throws IOException {
            String value = readText(parser, token, "kind");
            if (value == null) return null;
            try {
                return Kind.valueOf(value);
            } catch (IllegalArgumentException exception) {
                throw JsonMappingException.from(parser, "kind is invalid");
            }
        }

        private static String readText(JsonParser parser, JsonToken token, String field)
                throws IOException {
            return switch (token) {
                case VALUE_STRING -> parser.getText();
                case VALUE_NULL -> null;
                default -> throw JsonMappingException.from(parser, field + " must be a string");
            };
        }
    }
}
