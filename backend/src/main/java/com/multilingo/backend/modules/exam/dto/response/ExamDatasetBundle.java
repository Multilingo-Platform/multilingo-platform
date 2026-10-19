package com.multilingo.backend.modules.exam.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import com.multilingo.backend.modules.exam.service.ExamContentNormalizer;
import com.multilingo.backend.modules.exam.service.ExamPublicationValidator;
import com.multilingo.backend.modules.exam.service.IeltsAcademicPublicationValidator;
import com.multilingo.backend.modules.exam.service.OfficialExamDatasetRegistry;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.TreeSet;

/** Portable canonical content only: no database IDs, attempt data or external resource paths. */
public record ExamDatasetBundle(int schemaVersion, String datasetKey, int version, String examCode,
        Source source, String checksum, ExamBuilderRequest request,
        @JsonInclude(JsonInclude.Include.NON_EMPTY) List<Source> additionalSources,
        @JsonInclude(JsonInclude.Include.NON_NULL) String explanationStatus) {
    public record Source(String fileName, String sha256, String approvalReference) {}

    public static final String KEY = "ets-2024-test-1";

    /** Backward-compatible constructor for schema v1 bundles. */
    public ExamDatasetBundle(int schemaVersion, String datasetKey, int version, String examCode,
            Source source, String checksum, ExamBuilderRequest request) {
        this(schemaVersion, datasetKey, version, examCode, source, checksum, request, List.of(), null);
    }

    public ExamDatasetBundle {
        additionalSources = additionalSources == null ? List.of() : List.copyOf(additionalSources);
    }

    /** Legacy ETS v1 exporter retained for old stored bundles and test fixtures. */
    public static ExamDatasetBundle export(ExamBuilderRequest input) {
        ExamBuilderRequest request = canonical(input);
        requireLegacyComplete(request);
        String sourceHash = request.getSections().getFirst().getParts().getFirst().getContentData()
            .get("import_source_sha256") instanceof String hash ? hash : null;
        return new ExamDatasetBundle(1, KEY, 1, "TOEIC-ETS-2024-T1-V1",
                new Source("ETS_2024_Test_1.xlsx", sourceHash, null), digest(request), request);
    }

    /** Creates the current registered version using certified server-side approval reference. */
    public static ExamDatasetBundle exportOfficial(ExamBuilderRequest input, String datasetKey) {
        return exportOfficial(input, datasetKey, currentVersion(datasetKey));
    }

    /** Creates an explicitly selected registered version using certified server-side approval reference. */
    public static ExamDatasetBundle exportOfficial(ExamBuilderRequest input, String datasetKey, int version) {
        OfficialExamDatasetRegistry.DatasetDefinition definition = OfficialExamDatasetRegistry
                .require(datasetKey, version);
        return exportOfficial(input, datasetKey, version, definition.sources().getFirst().approvalReference());
    }

    /** Creates the current registered version using only source metadata registered in code. */
    public static ExamDatasetBundle exportOfficial(ExamBuilderRequest input, String datasetKey,
            String approvalReference) {
        return exportOfficial(input, datasetKey, currentVersion(datasetKey), approvalReference);
    }

    /** Creates an explicitly selected registered version using only source metadata registered in code. */
    public static ExamDatasetBundle exportOfficial(ExamBuilderRequest input, String datasetKey, int version,
            String approvalReference) {
        OfficialExamDatasetRegistry.DatasetDefinition definition = OfficialExamDatasetRegistry
                .require(datasetKey, version);
        String registeredApprovalReference = definition.sources().getFirst().approvalReference();
        if (registeredApprovalReference == null || registeredApprovalReference.isBlank()
                || !registeredApprovalReference.equals(approvalReference)) invalid();
        ExamBuilderRequest request = canonical(input);
        requireOfficialPublishable(definition, request);
        requireRegisteredShape(definition, request);
        if (request.isPublished() || !definition.type().equals(request.getType())
                || !definition.title().equals(request.getTitle())
                || !definition.language().equals(request.getExamLanguage())) invalid();
        List<Source> sources = definition.sources().stream()
                .map(source -> new Source(source.fileName(), source.sha256(), approvalReference)).toList();
        return new ExamDatasetBundle(2, definition.datasetKey(), definition.version(), definition.examCode(),
                sources.getFirst(), digest(request), request, sources.subList(1, sources.size()),
                definition.explanationStatus());
    }

    /** Exports registry-backed codes as v2 using server-side certified approval reference; arbitrary admin-created exams retain the legacy exporter. */
    public static ExamDatasetBundle exportForCode(ExamBuilderRequest request, String examCode) {
        return exportForCode(request, examCode, null);
    }

    /** Exports registry-backed codes with verified approval provenance; fails closed when reference is missing or caller reference does not match server. */
    public static ExamDatasetBundle exportForCode(ExamBuilderRequest request, String examCode,
            String approvalReference) {
        return OfficialExamDatasetRegistry.findByExamCode(examCode)
                .map(definition -> {
                    String serverRef = definition.sources().getFirst().approvalReference();
                    if (serverRef == null || serverRef.isBlank()) {
                        throw new AppException(ErrorCode.VALIDATION_FAILED,
                                "Bộ đề chính thức chưa có approval reference được xác nhận phía server.");
                    }
                    if (approvalReference != null && !serverRef.equals(approvalReference)) {
                        throw new AppException(ErrorCode.VALIDATION_FAILED,
                                "Caller không thể tự khai approval reference khác với chứng thực phía server.");
                    }
                    return exportOfficial(request, definition.datasetKey(), definition.version(), serverRef);
                })
                .orElseGet(() -> export(request));
    }

    public void validate() {
        if (schemaVersion == 1) {
            validateLegacy();
            return;
        }
        if (schemaVersion != 2 || request == null || request.isPublished()) invalid();
        OfficialExamDatasetRegistry.DatasetDefinition definition;
        try {
            definition = OfficialExamDatasetRegistry.require(datasetKey, version);
        } catch (IllegalArgumentException e) {
            invalid();
            return;
        }
        if (!definition.examCode().equals(examCode) || !definition.title().equals(request.getTitle())
                || !definition.type().equals(request.getType()) || !definition.language().equals(request.getExamLanguage())
                || !definition.explanationStatus().equals(explanationStatus)) invalid();
        List<Source> allSources = new ArrayList<>();
        allSources.add(source);
        allSources.addAll(additionalSources);
        if (allSources.size() != definition.sources().size()) invalid();
        for (int index = 0; index < allSources.size(); index++) {
            Source actual = allSources.get(index);
            OfficialExamDatasetRegistry.SourceDefinition expected = definition.sources().get(index);
            if (actual == null || !expected.fileName().equals(actual.fileName())
                    || !expected.sha256().equals(actual.sha256()) || actual.approvalReference() == null
                    || actual.approvalReference().isBlank()
                    || expected.approvalReference() == null
                    || !expected.approvalReference().equals(actual.approvalReference())) invalid();
        }
        requireOfficialPublishable(definition, request);
        requireRegisteredShape(definition, request);
        if (!Objects.equals(checksum, digest(request))) invalid();
    }

    public static ExamBuilderRequest canonical(ExamBuilderRequest input) {
        if (input == null) invalid();
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

    private void validateLegacy() {
        if (!KEY.equals(datasetKey) || version < 1 || !("TOEIC-ETS-2024-T1-V" + version).equals(examCode)
                || source == null || source.sha256() == null || !source.sha256().matches("[a-f0-9]{64}")
                || source.approvalReference() == null || source.approvalReference().isBlank()
                || request == null || request.isPublished()) invalid();
        requireLegacyComplete(request);
        if (!Objects.equals(checksum, digest(request))) invalid();
    }

    private static void requireLegacyComplete(ExamBuilderRequest request) {
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
                var group = (java.util.Map<?, ?>) raw;
                for (Object q : (List<?>) group.get("questions")) {
                    if (!String.format(Locale.ROOT, "q_%03d", questionNumber++).equals(((java.util.Map<?, ?>) q).get("question_id"))) invalid();
                    count++;
                }
            }
            if (count != counts[partNumber++ - 1]) invalid();
        }
        if (partNumber != 8 || questionNumber != 201) invalid();
    }

    private static void validateRegisteredShape(OfficialExamDatasetRegistry.DatasetDefinition definition,
            ExamBuilderRequest request) {
        if (request.getSections() == null || request.getSections().size() != definition.sections().size()) invalid();
        int total = 0, groupTotal = 0, expectedPartIndex = 0;
        for (int sectionIndex = 0; sectionIndex < definition.sections().size(); sectionIndex++) {
            var expectedSection = definition.sections().get(sectionIndex);
            var actualSection = request.getSections().get(sectionIndex);
            if (!expectedSection.skill().equals(actualSection.getSkillType())
                    || expectedSection.durationMinutes() != actualSection.getDurationMinutes()) invalid();
            for (int partPosition = 0; partPosition < expectedSection.partNumbers().size(); partPosition++) {
                var partNumbers = expectedSection.partNumbers();
                if (actualSection.getParts() == null || actualSection.getParts().size() != partNumbers.size()) invalid();
                var actualPart = actualSection.getParts().get(partPosition);
                if (!partNumbers.get(partPosition).equals(actualPart.getPartNumber())) invalid();
                int count = questionCount(actualPart.getContentData());
                groupTotal += groupCount(actualPart.getContentData());
                if (expectedPartIndex >= definition.questionCountsByPart().size()
                        || count != definition.questionCountsByPart().get(expectedPartIndex++)) invalid();
                total += count;
            }
        }
        int expectedTotal = definition.objectiveQuestionCount() + definition.essayQuestionCount();
        if (total != expectedTotal || groupTotal != definition.groupCount()) invalid();
        if (OfficialExamDatasetRegistry.ETS_TOEIC_KEY.equals(definition.datasetKey())) {
            validateToeicQuestionIds(request);
            validateToeicGroupEightBoundary(request);
        }
    }

    /** Enforces registry-backed section, part, question and group shape at every official-data boundary. */
    public static void requireRegisteredShape(OfficialExamDatasetRegistry.DatasetDefinition definition,
            ExamBuilderRequest request) {
        if (definition == null || request == null) invalid();
        validateRegisteredShape(definition, request);
    }

    private static void validateToeicQuestionIds(ExamBuilderRequest request) {
        int expectedNumber = 1;
        for (var section : request.getSections()) for (var part : section.getParts()) {
            Object rawGroups = part.getContentData().get("question_groups");
            if (!(rawGroups instanceof List<?> groups)) { invalid(); return; }
            for (Object rawGroup : groups) {
                if (!(rawGroup instanceof java.util.Map<?, ?> group)
                        || !(group.get("questions") instanceof List<?> questions)) { invalid(); return; }
                for (Object rawQuestion : questions) {
                    if (!(rawQuestion instanceof java.util.Map<?, ?> question)
                            || !String.format(Locale.ROOT, "q_%03d", expectedNumber++)
                                    .equals(question.get("question_id"))) invalid();
                }
            }
        }
        if (expectedNumber != 201) invalid();
    }

    private static void validateToeicGroupEightBoundary(ExamBuilderRequest request) {
        var partSeven = request.getSections().stream().flatMap(section -> section.getParts().stream())
                .filter(part -> Integer.valueOf(7).equals(part.getPartNumber())).findFirst().orElseThrow();
        Object rawGroups = partSeven.getContentData().get("question_groups");
        if (!(rawGroups instanceof List<?> groups)) { invalid(); return; }
        String question164Group = null;
        java.util.Map<?, ?> groupEight = null;
        java.util.Map<String, String> questionGroups = new java.util.HashMap<>();
        for (Object rawGroup : groups) {
            if (!(rawGroup instanceof java.util.Map<?, ?> group)
                    || !(group.get("group_id") instanceof String groupId)
                    || !(group.get("questions") instanceof List<?> questions)) { invalid(); return; }
            if ("toeic-p7-g8".equals(groupId)) groupEight = group;
            for (Object rawQuestion : questions) {
                if (!(rawQuestion instanceof java.util.Map<?, ?> question)
                        || !(question.get("question_id") instanceof String questionId)) { invalid(); return; }
                questionGroups.put(questionId, groupId);
                if ("q_164".equals(questionId)) question164Group = groupId;
            }
        }
        if (!"toeic-p7-g7".equals(question164Group)
                || !"toeic-p7-g8".equals(questionGroups.get("q_165"))
                || !"toeic-p7-g8".equals(questionGroups.get("q_166"))
                || !"toeic-p7-g8".equals(questionGroups.get("q_167"))
                || groupEight == null || !(groupEight.get("content_html") instanceof String passage)
                || passage.isBlank()) invalid();
    }

    private static int groupCount(java.util.Map<String, Object> contentData) {
        Object rawGroups = contentData.get("question_groups");
        if (!(rawGroups instanceof List<?> groups)) { invalid(); return 0; }
        return groups.size();
    }

    private static int questionCount(java.util.Map<String, Object> contentData) {
        Object rawGroups = contentData.get("question_groups");
        if (!(rawGroups instanceof List<?>)) { invalid(); return 0; }
        List<?> groups = (List<?>) rawGroups;
        int count = 0;
        for (Object rawGroup : groups) {
            if (!(rawGroup instanceof java.util.Map<?, ?> group)) { invalid(); return 0; }
            Object rawQuestions = group.get("questions");
            if (!(rawQuestions instanceof List<?>)) { invalid(); return 0; }
            List<?> questions = (List<?>) rawQuestions;
            count += questions.size();
        }
        return count;
    }

    private static int currentVersion(String datasetKey) {
        return OfficialExamDatasetRegistry.find(datasetKey).map(OfficialExamDatasetRegistry.DatasetDefinition::version)
                .orElseThrow(() -> new IllegalArgumentException("Unknown official exam dataset."));
    }

    private static void requireOfficialPublishable(OfficialExamDatasetRegistry.DatasetDefinition definition,
            ExamBuilderRequest request) {
        if (OfficialExamDatasetRegistry.CAMBRIDGE_IELTS_KEY.equals(definition.datasetKey()))
            new IeltsAcademicPublicationValidator().requirePublishable(request,
                    "COMPLETE".equals(definition.explanationStatus()));
        else new ExamPublicationValidator().requirePublishable(request);
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

    private static void invalid() {
        throw new AppException(ErrorCode.VALIDATION_FAILED, "Bộ dữ liệu chưa hợp lệ hoặc chưa được phê duyệt.");
    }
}
