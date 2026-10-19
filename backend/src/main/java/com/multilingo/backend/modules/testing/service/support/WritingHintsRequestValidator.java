package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.dto.request.WritingHintsRequest;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Iterator;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Xác thực và phân tích cú pháp nghiêm ngặt cho WritingHintsRequest và path ID.
 * Giới hạn payload 16 KiB, từ chối duplicate key, trailing JSON, unknown fields và types không hợp lệ.
 */
@Component
public class WritingHintsRequestValidator {

    public static final int MAX_REQUEST_BODY_BYTES = 16 * 1024; // 16 KiB = 16,384 bytes
    private static final Pattern ATTEMPT_ID_PATTERN = Pattern.compile("^[1-9][0-9]{0,9}$");
    private static final Pattern UUID_PATTERN = Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
    private static final Set<String> ALLOWED_FIELDS = Set.of(
            "partId",
            "questionId",
            "requestId",
            "learningLanguage",
            "hintLanguage"
    );

    private final ObjectMapper objectMapper;

    public WritingHintsRequestValidator() {
        this.objectMapper = JsonMapper.builder()
                .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
                .build();
    }

    /**
     * Phân tích và kiểm tra tính hợp lệ của path attempt ID.
     * Chỉ chấp nhận số nguyên dương decimal chuẩn, không leading zero, suffix, exponent, whitespace hoặc overflow.
     *
     * @param raw chuỗi attempt ID từ path
     * @return số nguyên attempt ID
     */
    public Integer parseAttemptId(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "attemptId must not be blank");
        }
        if (!ATTEMPT_ID_PATTERN.matcher(raw).matches()) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "attemptId must be a positive decimal integer");
        }
        try {
            long value = Long.parseLong(raw);
            if (value > Integer.MAX_VALUE) {
                throw new AppException(ErrorCode.VALIDATION_FAILED, "attemptId exceeds integer range");
            }
            return (int) value;
        } catch (NumberFormatException e) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "attemptId is invalid");
        }
    }

    /**
     * Đọc và phân tích cú pháp JSON payload từ InputStream với giới hạn 16 KiB.
     *
     * @param body InputStream của request body
     * @return WritingHintsRequest đã được chuẩn hóa và kiểm tra hợp lệ
     */
    public WritingHintsRequest read(InputStream body) {
        if (body == null) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "Request body must not be null");
        }

        byte[] rawBytes = readBoundedBody(body);
        if (rawBytes.length == 0) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "Request body must not be empty");
        }

        JsonNode root;
        try (JsonParser parser = objectMapper.createParser(rawBytes)) {
            root = objectMapper.readTree(parser);
            if (root == null || parser.nextToken() != null) {
                throw new AppException(ErrorCode.VALIDATION_FAILED, "Trailing JSON content is not allowed");
            }
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "Invalid request JSON payload");
        }

        if (!root.isObject()) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "Request body must be a JSON object");
        }

        // Kiểm tra unknown fields
        Iterator<String> fieldNames = root.fieldNames();
        while (fieldNames.hasNext()) {
            String field = fieldNames.next();
            if (!ALLOWED_FIELDS.contains(field)) {
                throw new AppException(ErrorCode.VALIDATION_FAILED, "Unknown property in request body");
            }
        }

        // 1. partId: integer 1..2147483647 (nghiêm ngặt kiểu int, không ép kiểu string/float)
        JsonNode partIdNode = root.get("partId");
        if (partIdNode == null || !partIdNode.isInt() || partIdNode.intValue() <= 0) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "partId must be a positive integer");
        }
        int partId = partIdNode.intValue();

        // 2. questionId: string không blank, không whitespace đầu/cuối, tối đa 128 ký tự
        JsonNode qIdNode = root.get("questionId");
        if (qIdNode == null || !qIdNode.isTextual()) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "questionId must be a string");
        }
        String questionId = qIdNode.textValue();
        if (questionId.isBlank()) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "questionId must not be blank");
        }
        char firstChar = questionId.charAt(0);
        char lastChar = questionId.charAt(questionId.length() - 1);
        if (Character.isWhitespace(firstChar) || Character.isSpaceChar(firstChar)
                || Character.isWhitespace(lastChar) || Character.isSpaceChar(lastChar)
                || !questionId.strip().equals(questionId)) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "questionId must not have leading or trailing whitespace");
        }
        if (questionId.length() > 128) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "questionId must not exceed 128 characters");
        }

        // 3. requestId: UUID chuẩn, normalize lowercase
        JsonNode reqIdNode = root.get("requestId");
        if (reqIdNode == null || !reqIdNode.isTextual()) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "requestId must be a string");
        }
        String trimmedReqId = reqIdNode.textValue().trim();
        if (!UUID_PATTERN.matcher(trimmedReqId).matches()) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "requestId must be a valid UUID format");
        }
        String normalizedRequestId;
        try {
            normalizedRequestId = UUID.fromString(trimmedReqId).toString().toLowerCase(Locale.ROOT);
        } catch (IllegalArgumentException e) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "requestId must be a valid UUID");
        }

        // 4. learningLanguage & hintLanguage: optional hoặc null; sai kiểu bị từ chối
        String learningLang = null;
        JsonNode learnNode = root.get("learningLanguage");
        if (learnNode != null && !learnNode.isNull()) {
            if (!learnNode.isTextual()) {
                throw new AppException(ErrorCode.VALIDATION_FAILED, "learningLanguage must be a string");
            }
            learningLang = learnNode.textValue();
        }

        String hintLang = null;
        JsonNode hintNode = root.get("hintLanguage");
        if (hintNode != null && !hintNode.isNull()) {
            if (!hintNode.isTextual()) {
                throw new AppException(ErrorCode.VALIDATION_FAILED, "hintLanguage must be a string");
            }
            hintLang = hintNode.textValue();
        }

        return new WritingHintsRequest(
                partId,
                questionId,
                normalizedRequestId,
                learningLang,
                hintLang
        );
    }

    private byte[] readBoundedBody(InputStream body) {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] chunk = new byte[4096];
        int totalBytes = 0;
        int read;

        try {
            while ((read = body.read(chunk)) != -1) {
                totalBytes += read;
                if (totalBytes > MAX_REQUEST_BODY_BYTES) {
                    throw new AppException(ErrorCode.WRITING_HINTS_REQUEST_TOO_LARGE);
                }
                buffer.write(chunk, 0, read);
            }
        } catch (AppException e) {
            throw e;
        } catch (IOException e) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "Failed to read request body stream");
        }

        return buffer.toByteArray();
    }
}
