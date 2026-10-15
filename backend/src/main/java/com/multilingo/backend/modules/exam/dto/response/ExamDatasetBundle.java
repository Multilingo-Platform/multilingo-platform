package com.multilingo.backend.modules.exam.dto.response;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.multilingo.backend.common.exception.*;
import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import com.multilingo.backend.modules.exam.service.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/** Portable content only: no database IDs, attempt data or external resource paths. */
public record ExamDatasetBundle(int schemaVersion, String datasetKey, int version, String examCode,
                                Source source, String checksum, ExamBuilderRequest request) {
    public record Source(String fileName, String sha256, String approvalReference) {}
    public static final String KEY = "ets-2024-test-1";

    public static ExamDatasetBundle export(ExamBuilderRequest input) {
        ExamBuilderRequest request = canonical(input);
        requireComplete(request);
        String sourceHash = request.getSections().getFirst().getParts().getFirst().getContentData()
            .get("import_source_sha256") instanceof String hash ? hash : null;
        return new ExamDatasetBundle(1, KEY, 1, "TOEIC-ETS-2024-T1-V1",
            new Source("ETS_2024_Test_1.xlsx", sourceHash, null), digest(request), request);
    }

    public void validate() {
        if (schemaVersion != 1 || !KEY.equals(datasetKey) || version < 1
                || !("TOEIC-ETS-2024-T1-V" + version).equals(examCode)
                || source == null || source.sha256() == null || !source.sha256().matches("[a-f0-9]{64}")
                || source.approvalReference() == null || source.approvalReference().isBlank()
                || request == null || request.isPublished()) invalid();
        requireComplete(request);
        if (!Objects.equals(checksum, digest(request))) invalid();
    }

    public static ExamBuilderRequest canonical(ExamBuilderRequest input) {
        if (input == null) { invalid(); }
        var copy = new ExamContentNormalizer().normalize(input);
        copy.setPublished(false);
        return copy;
    }

    public static String digest(ExamBuilderRequest input) {
        try {
            var tree = new ObjectMapper().valueToTree(canonical(input));
            byte[] bytes = new ObjectMapper().writeValueAsString(sorted(tree)).getBytes(StandardCharsets.UTF_8);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception e) { throw new AppException(ErrorCode.VALIDATION_FAILED); }
    }

    private static JsonNode sorted(JsonNode node) {
        if (node.isObject()) {
            ObjectNode result = JsonNodeFactory.instance.objectNode();
            var fields = new TreeSet<String>(); node.fieldNames().forEachRemaining(fields::add);
            fields.forEach(key -> result.set(key, sorted(node.get(key))));
            return result;
        }
        if (node.isArray()) {
            ArrayNode result = JsonNodeFactory.instance.arrayNode();
            node.forEach(value -> result.add(sorted(value)));
            return result;
        }
        return node;
    }

    private static void requireComplete(ExamBuilderRequest request) {
        if (!"TOEIC_LR".equals(request.getType()) || !"en".equals(request.getExamLanguage())
                || !"ETS 2024 Test 1".equals(request.getTitle())) invalid();
        new ExamPublicationValidator().requirePublishable(request);
        if (request.getSections().size() != 2
                || !"LISTENING".equals(request.getSections().get(0).getSkillType())
                || !"READING".equals(request.getSections().get(1).getSkillType())
                || request.getSections().get(0).getDurationMinutes() != 45
                || request.getSections().get(1).getDurationMinutes() != 75) invalid();
        int[] counts = {6, 25, 39, 30, 30, 16, 54};
        int partNumber = 1, questionNumber = 1;
        for (var section : request.getSections()) for (var part : section.getParts()) {
            if (partNumber > 7 || part.getPartNumber() != partNumber) invalid();
            int count = 0;
            for (Object raw : (List<?>) part.getContentData().get("question_groups")) {
                Map<?, ?> group = (Map<?, ?>) raw;
                for (Object q : (List<?>) group.get("questions")) {
                    if (!String.format(Locale.ROOT, "q_%03d", questionNumber++).equals(((Map<?, ?>) q).get("question_id"))) invalid();
                    count++;
                }
            }
            if (count != counts[partNumber++ - 1]) invalid();
        }
        if (partNumber != 8 || questionNumber != 201) invalid();
    }

    private static void invalid() {
        throw new AppException(ErrorCode.VALIDATION_FAILED, "Bộ dữ liệu chưa hợp lệ hoặc chưa được phê duyệt.");
    }
}
