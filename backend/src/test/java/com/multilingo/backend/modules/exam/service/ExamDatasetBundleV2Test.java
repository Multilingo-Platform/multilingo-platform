package com.multilingo.backend.modules.exam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.dto.response.ExamDatasetBundle;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.InputStream;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ExamDatasetBundleV2Test {
    private static final String TOEIC_RESOURCE = "/datasets/official-source/ets-2024-test-1-completed.xlsx";
    private static final String IELTS_RESOURCE = "/datasets/official-source/cambridge-ielts-20-test-1.xlsx";
    private static final String FULL_IELTS_RESOURCE =
            "/datasets/official-source/cambridge-ielts-20-test-1-full.v2.xlsx";
    private static final String IELTS_V2_APPROVAL = "OWNER_RIGHTS_CONFIRMED_CHAT_2026-10-19";
    private static final String TOEIC_APPROVAL = "OWNER_RIGHTS_CONFIRMED_CHAT_2026-10-17";

    @Test
    void rejectsRegisteredIeltsV1WithoutServerApprovalReference() {
        assertThatThrownBy(() -> ExamDatasetBundle.exportOfficial(OfficialExamTestData.ieltsRequest(),
                OfficialExamDatasetRegistry.CAMBRIDGE_IELTS_KEY, 1, "TEST-APPROVAL"))
                .isInstanceOf(com.multilingo.backend.common.exception.AppException.class)
                .hasMessageContaining("chưa được phê duyệt");
    }

    @Test
    void exportsAndValidatesRegisteredIeltsV2CompleteExplanationBundle() throws Exception {
        ExamDatasetBundle bundle = ExamDatasetBundle.exportOfficial(parseFullIelts(),
                OfficialExamDatasetRegistry.CAMBRIDGE_IELTS_KEY, 2, IELTS_V2_APPROVAL);

        assertThat(bundle.schemaVersion()).isEqualTo(2);
        assertThat(bundle.datasetKey()).isEqualTo("cambridge-ielts-20-test-1");
        assertThat(bundle.version()).isEqualTo(2);
        assertThat(bundle.examCode()).isEqualTo("IELTS-CAMBRIDGE-20-T1-V2");
        assertThat(bundle.explanationStatus()).isEqualTo("COMPLETE");
        assertThat(bundle.source()).isEqualTo(new ExamDatasetBundle.Source(
                "Cambridge_Ielts_20_Test_1_(Full_giải_thích).xlsx",
                OfficialExamSourceProfile.CAMBRIDGE_IELTS_20_V2_SHA256, IELTS_V2_APPROVAL));
        assertThat(bundle.additionalSources()).isEmpty();
        assertThat(bundle.request().isPublished()).isFalse();
        bundle.validate();

        var mapper = new ObjectMapper();
        var roundTripped = mapper.readValue(mapper.writeValueAsBytes(bundle), ExamDatasetBundle.class);
        roundTripped.validate();
        assertThat(mapper.writeValueAsString(roundTripped))
                .doesNotContain("sectionId", "partId", "attemptId", "token", "correct_option_index",
                        "metadata.options");
    }

    @Test
    void exportForCodeUsesTheRegisteredDefinitionVersionAndFailsClosedForUnapprovedV1() throws Exception {
        assertThatThrownBy(() -> ExamDatasetBundle.exportForCode(OfficialExamTestData.ieltsRequest(),
                "IELTS-CAMBRIDGE-20-T1-V1"))
                .isInstanceOf(com.multilingo.backend.common.exception.AppException.class)
                .hasMessageContaining("approval reference");

        ExamDatasetBundle v2 = ExamDatasetBundle.exportForCode(parseFullIelts(), "IELTS-CAMBRIDGE-20-T1-V2");

        assertThat(v2.version()).isEqualTo(2);
        assertThat(v2.examCode()).isEqualTo("IELTS-CAMBRIDGE-20-T1-V2");
        assertThat(v2.explanationStatus()).isEqualTo("COMPLETE");
        assertThat(v2.source().approvalReference()).isEqualTo(IELTS_V2_APPROVAL);
        v2.validate();

        var mapper = new ObjectMapper();
        var roundTrippedV2 = mapper.readValue(mapper.writeValueAsBytes(v2), ExamDatasetBundle.class);
        roundTrippedV2.validate();
        assertThat(roundTrippedV2.checksum()).isEqualTo(v2.checksum());
    }

    @Test
    void exportForCodeFailsClosedForUnapprovedExamAndRejectsArbitraryCallerSuppliedApprovalReference() throws Exception {
        var request = parseFullIelts();
        // 1. Unapproved official code (V1) has no server approval reference -> fails closed
        assertThatThrownBy(() -> ExamDatasetBundle.exportForCode(OfficialExamTestData.ieltsRequest(),
                "IELTS-CAMBRIDGE-20-T1-V1"))
                .isInstanceOf(com.multilingo.backend.common.exception.AppException.class)
                .hasMessageContaining("approval reference");

        assertThatThrownBy(() -> ExamDatasetBundle.exportForCode(OfficialExamTestData.ieltsRequest(),
                "IELTS-CAMBRIDGE-20-T1-V1", "ANY-CALLER-STRING"))
                .isInstanceOf(com.multilingo.backend.common.exception.AppException.class)
                .hasMessageContaining("approval reference");

        // 2. Caller cannot forge or override approval reference with an arbitrary string
        assertThatThrownBy(() -> ExamDatasetBundle.exportForCode(request, "IELTS-CAMBRIDGE-20-T1-V2",
                "FORGED-OR-ARBITRARY-REF"))
                .isInstanceOf(com.multilingo.backend.common.exception.AppException.class)
                .hasMessageContaining("Caller không thể tự khai approval reference");

        assertThatThrownBy(() -> ExamDatasetBundle.exportForCode(request, "IELTS-CAMBRIDGE-20-T1-V2",
                "CONFIRMED-RIGHTS-2026-10-19"))
                .isInstanceOf(com.multilingo.backend.common.exception.AppException.class)
                .hasMessageContaining("Caller không thể tự khai approval reference");
    }

    @Test
    void exportForCodeWithServerCertifiedReferenceProducesValidRoundTrippableV2Bundle() throws Exception {
        var request = parseFullIelts();
        ExamDatasetBundle bundle = ExamDatasetBundle.exportForCode(request, "IELTS-CAMBRIDGE-20-T1-V2");

        assertThat(bundle.schemaVersion()).isEqualTo(2);
        assertThat(bundle.version()).isEqualTo(2);
        assertThat(bundle.examCode()).isEqualTo("IELTS-CAMBRIDGE-20-T1-V2");
        assertThat(bundle.explanationStatus()).isEqualTo("COMPLETE");
        assertThat(bundle.source().approvalReference()).isEqualTo(IELTS_V2_APPROVAL);
        bundle.validate();

        // Also valid when caller explicitly provides the matching certified reference
        ExamDatasetBundle bundleWithRef = ExamDatasetBundle.exportForCode(request, "IELTS-CAMBRIDGE-20-T1-V2",
                IELTS_V2_APPROVAL);
        assertThat(bundleWithRef.source().approvalReference()).isEqualTo(IELTS_V2_APPROVAL);
        bundleWithRef.validate();

        var mapper = new ObjectMapper();
        byte[] bytes = mapper.writeValueAsBytes(bundle);
        ExamDatasetBundle roundTripped = mapper.readValue(bytes, ExamDatasetBundle.class);
        roundTripped.validate();
        assertThat(roundTripped.checksum()).isEqualTo(bundle.checksum());
    }

    @Test
    void rejectsV2ExportWhenOneExplanationIsMissing() throws Exception {
        var request = parseFullIelts();
        questions(request).stream().filter(question -> "r_005".equals(question.get("question_id")))
                .findFirst().orElseThrow().put("explanation", "");

        assertThatThrownBy(() -> ExamDatasetBundle.exportOfficial(request,
                OfficialExamDatasetRegistry.CAMBRIDGE_IELTS_KEY, 2, IELTS_V2_APPROVAL))
                .isInstanceOf(com.multilingo.backend.common.exception.AppException.class);
    }

    @Test
    void rejectsV2BundleWithWrongSourceHashOrUnknownVersion() throws Exception {
        ExamDatasetBundle approved = ExamDatasetBundle.exportOfficial(parseFullIelts(),
                OfficialExamDatasetRegistry.CAMBRIDGE_IELTS_KEY, 2, IELTS_V2_APPROVAL);
        ExamDatasetBundle wrongHash = new ExamDatasetBundle(2, approved.datasetKey(), approved.version(),
                approved.examCode(), new ExamDatasetBundle.Source(approved.source().fileName(), "0".repeat(64),
                        IELTS_V2_APPROVAL), approved.checksum(), approved.request(),
                approved.additionalSources(), approved.explanationStatus());
        ExamDatasetBundle unknownVersion = new ExamDatasetBundle(2, approved.datasetKey(), 3,
                approved.examCode(), approved.source(), approved.checksum(), approved.request(),
                approved.additionalSources(), approved.explanationStatus());

        assertThatThrownBy(wrongHash::validate).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(unknownVersion::validate).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> ExamDatasetBundle.exportOfficial(parseFullIelts(),
                OfficialExamDatasetRegistry.CAMBRIDGE_IELTS_KEY, 3, IELTS_V2_APPROVAL))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsV2BundleWithWrongPairMetadataEvenWhenTheChecksumMatches() throws Exception {
        ExamDatasetBundle approved = ExamDatasetBundle.exportOfficial(parseFullIelts(),
                OfficialExamDatasetRegistry.CAMBRIDGE_IELTS_KEY, 2, IELTS_V2_APPROVAL);
        questions(approved.request()).stream().filter(question -> "l_018".equals(question.get("question_id")))
                .findFirst().orElseThrow().put("answer_group", Map.of("id", "wrong-pair",
                        "mode", "DISTINCT_UNORDERED", "question_ids", java.util.List.of("l_017", "l_020")));
        ExamDatasetBundle tampered = new ExamDatasetBundle(2, approved.datasetKey(), approved.version(),
                approved.examCode(), approved.source(), ExamDatasetBundle.digest(approved.request()),
                approved.request(), approved.additionalSources(), approved.explanationStatus());

        assertThatThrownBy(tampered::validate)
                .isInstanceOf(com.multilingo.backend.common.exception.AppException.class);
    }

    @Test
    void exportsToeicSupplementAsAnAdditionalRegisteredSource() throws Exception {
        var request = parseToeic();
        ExamDatasetBundle bundle = ExamDatasetBundle.exportOfficial(request,
                OfficialExamDatasetRegistry.ETS_TOEIC_KEY, TOEIC_APPROVAL);

        assertThat(bundle.schemaVersion()).isEqualTo(2);
        assertThat(bundle.examCode()).isEqualTo("TOEIC-ETS-2024-T1-V2");
        assertThat(bundle.additionalSources()).containsExactly(new ExamDatasetBundle.Source(
                "ETS_2024_Test_1 (có giải thích).xlsx", OfficialExamSourceProfile.ETS_2024_SUPPLEMENT_SHA256,
                TOEIC_APPROVAL));
        bundle.validate();
    }

    @Test
    void rejectsRegisteredToeicBundleWhenQuestion165CrossesTheGroupBoundary() throws Exception {
        ExamDatasetBundle approved = ExamDatasetBundle.exportOfficial(parseToeic(),
                OfficialExamDatasetRegistry.ETS_TOEIC_KEY, TOEIC_APPROVAL);
        var partSeven = approved.request().getSections().stream().flatMap(section -> section.getParts().stream())
                .filter(part -> Integer.valueOf(7).equals(part.getPartNumber())).findFirst().orElseThrow();
        @SuppressWarnings("unchecked")
        var groups = (java.util.List<java.util.Map<String, Object>>) (java.util.List<?>) partSeven.getContentData()
                .get("question_groups");
        var groupSeven = groups.stream().filter(group -> "toeic-p7-g7".equals(group.get("group_id")))
                .findFirst().orElseThrow();
        var groupEight = groups.stream().filter(group -> "toeic-p7-g8".equals(group.get("group_id")))
                .findFirst().orElseThrow();
        @SuppressWarnings("unchecked")
        var groupSevenQuestions = (java.util.List<java.util.Map<String, Object>>) (java.util.List<?>) groupSeven.get("questions");
        @SuppressWarnings("unchecked")
        var groupEightQuestions = (java.util.List<java.util.Map<String, Object>>) (java.util.List<?>) groupEight.get("questions");
        var question165 = groupEightQuestions.stream().filter(question -> "q_165".equals(question.get("question_id")))
                .findFirst().orElseThrow();
        groupEightQuestions.remove(question165);
        groupSevenQuestions.add(question165);

        ExamDatasetBundle boundaryChanged = new ExamDatasetBundle(2, approved.datasetKey(), approved.version(),
                approved.examCode(), approved.source(), ExamDatasetBundle.digest(approved.request()), approved.request(),
                approved.additionalSources(), approved.explanationStatus());

        assertThatThrownBy(boundaryChanged::validate).isInstanceOf(RuntimeException.class);
    }

    @Test
    void rejectsRegisteredToeicBundleWithAnUnregisteredGroupCount() throws Exception {
        ExamDatasetBundle approved = ExamDatasetBundle.exportOfficial(parseToeic(),
                OfficialExamDatasetRegistry.ETS_TOEIC_KEY, TOEIC_APPROVAL);
        var partFive = approved.request().getSections().stream().flatMap(section -> section.getParts().stream())
                .filter(part -> Integer.valueOf(5).equals(part.getPartNumber())).findFirst().orElseThrow();
        @SuppressWarnings("unchecked")
        var groups = (java.util.List<java.util.Map<String, Object>>) (java.util.List<?>) partFive.getContentData()
                .get("question_groups");
        var original = groups.getFirst();
        @SuppressWarnings("unchecked")
        var originalQuestions = (java.util.List<java.util.Map<String, Object>>) (java.util.List<?>) original.get("questions");
        var splitQuestions = new java.util.ArrayList<>(originalQuestions.subList(1, originalQuestions.size()));
        originalQuestions.subList(1, originalQuestions.size()).clear();
        var split = new java.util.LinkedHashMap<String, Object>(original);
        split.put("group_id", "toeic-p5-g-extra");
        split.put("questions", splitQuestions);
        groups.add(1, split);
        ExamDatasetBundle extraGroup = new ExamDatasetBundle(2, approved.datasetKey(), approved.version(),
                approved.examCode(), approved.source(), ExamDatasetBundle.digest(approved.request()), approved.request(),
                approved.additionalSources(), approved.explanationStatus());

        assertThatThrownBy(extraGroup::validate).isInstanceOf(RuntimeException.class);
    }

    @Test
    void rejectsUnapprovedTamperedAndUnverifiedIeltsBundles() throws Exception {
        ExamDatasetBundle approved = ExamDatasetBundle.exportOfficial(parseFullIelts(),
                OfficialExamDatasetRegistry.CAMBRIDGE_IELTS_KEY, 2, IELTS_V2_APPROVAL);
        ExamDatasetBundle unapproved = new ExamDatasetBundle(2, approved.datasetKey(), approved.version(),
                approved.examCode(), new ExamDatasetBundle.Source(approved.source().fileName(),
                        approved.source().sha256(), null), approved.checksum(), approved.request(),
                approved.additionalSources(), approved.explanationStatus());
        assertThatThrownBy(unapproved::validate).isInstanceOf(RuntimeException.class);

        ExamDatasetBundle forged = new ExamDatasetBundle(2, approved.datasetKey(), approved.version(),
                approved.examCode(), new ExamDatasetBundle.Source(approved.source().fileName(),
                        approved.source().sha256(), "ARBITRARY-FORGED-REF"), approved.checksum(), approved.request(),
                approved.additionalSources(), approved.explanationStatus());
        assertThatThrownBy(forged::validate).isInstanceOf(RuntimeException.class);

        ExamDatasetBundle tampered = new ExamDatasetBundle(2, approved.datasetKey(), approved.version(),
                approved.examCode(), approved.source(), "0".repeat(64), approved.request(),
                approved.additionalSources(), approved.explanationStatus());
        assertThatThrownBy(tampered::validate).isInstanceOf(RuntimeException.class);

        assertThatThrownBy(() -> ExamDatasetBundle.exportOfficial(parseIelts(),
                OfficialExamDatasetRegistry.CAMBRIDGE_IELTS_KEY, 1, IELTS_V2_APPROVAL))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void currentCambridgeWorkbookIsOtherwiseCanonicalButQuarantinedForInsertedText() throws Exception {
        var request = parseIelts();
        var issues = new IeltsAcademicPublicationValidator().issues(request);
        assertThat(issues).extracting(issue -> issue.code()).containsOnly("SOURCE_CONTENT_UNVERIFIED");
    }

    @Test
    void legacySchemaOneBundleRemainsReadableAndValidatable() throws Exception {
        var workbook = ExcelV2Fixture.workbook();
        try (workbook) {
            var request = new ExamParserService(new ObjectMapper()).parseExamFile(ExcelV2Fixture.file(workbook));
            var exported = ExamDatasetBundle.export(request);
            var legacy = new ExamDatasetBundle(1, exported.datasetKey(), exported.version(), exported.examCode(),
                    new ExamDatasetBundle.Source("synthetic.xlsx", "a".repeat(64), "TEST-APPROVAL"),
                    exported.checksum(), exported.request());
            legacy.validate();
            assertThat(new ObjectMapper().readValue(new ObjectMapper().writeValueAsBytes(legacy),
                    ExamDatasetBundle.class).schemaVersion()).isEqualTo(1);
        }
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"replacement", "cross-part-swap", "within-part-swap"})
    void rejectsNoncanonicalToeicIdentityAtExportAndValidation(String mutation) throws Exception {
        var approved = ExamDatasetBundle.exportOfficial(parseToeic(),
                OfficialExamDatasetRegistry.ETS_TOEIC_KEY, TOEIC_APPROVAL);
        approved.validate();
        var questions = new java.util.ArrayList<java.util.Map<String, Object>>();
        for (var section : approved.request().getSections()) for (var part : section.getParts())
            for (Object raw : (java.util.List<?>) part.getContentData().get("question_groups"))
                for (Object question : (java.util.List<?>) ((java.util.Map<?, ?>) raw).get("questions"))
                    questions.add((java.util.Map<String, Object>) question);
        if (mutation.equals("replacement")) questions.getLast().put("question_id", "noncanonical_replacement");
        else {
            int other = mutation.equals("cross-part-swap") ? 0 : 198;
            Object lastId = questions.getLast().get("question_id");
            questions.getLast().put("question_id", questions.get(other).get("question_id"));
            questions.get(other).put("question_id", lastId);
        }
        new ExamPublicationValidator().requirePublishable(approved.request());
        var tampered = new ExamDatasetBundle(2, approved.datasetKey(), approved.version(), approved.examCode(),
                approved.source(), ExamDatasetBundle.digest(approved.request()), approved.request(),
                approved.additionalSources(), approved.explanationStatus());
        assertThatThrownBy(tampered::validate).isInstanceOf(com.multilingo.backend.common.exception.AppException.class);
        assertThatThrownBy(() -> ExamDatasetBundle.exportOfficial(approved.request(),
                OfficialExamDatasetRegistry.ETS_TOEIC_KEY, TOEIC_APPROVAL))
                .isInstanceOf(com.multilingo.backend.common.exception.AppException.class);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(booleans = {false, true})
    void legacyExportPreservesUploadedChecksumAndValidatesAfterApproval(boolean syntheticSource) throws Exception {
        byte[] upload;
        try (InputStream input = getClass().getResourceAsStream(TOEIC_RESOURCE)) {
            upload = input.readAllBytes();
        }
        if (syntheticSource) {
            try (var workbook = ExcelV2Fixture.workbook();
                    var output = new java.io.ByteArrayOutputStream()) {
                workbook.write(output);
                upload = output.toByteArray();
            }
        }
        String actualHash = java.util.HexFormat.of().formatHex(
                java.security.MessageDigest.getInstance("SHA-256").digest(upload));
        var request = new ExamParserService(new ObjectMapper()).parseExamFile(new MockMultipartFile("file",
                "upload.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", upload));
        var exported = ExamDatasetBundle.exportForCode(request, "TOEIC-RANDOM");
        assertThat(exported.schemaVersion()).isEqualTo(1);
        assertThat(exported.source().sha256()).isEqualTo(actualHash);
        var approved = new ExamDatasetBundle(1, exported.datasetKey(), exported.version(), exported.examCode(),
                new ExamDatasetBundle.Source(exported.source().fileName(), exported.source().sha256(), "TEST-APPROVAL"),
                exported.checksum(), exported.request());
        var mapper = new ObjectMapper();
        mapper.readValue(mapper.writeValueAsBytes(approved), ExamDatasetBundle.class).validate();
    }

    private com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest parseIelts() throws Exception {
        return parse(IELTS_RESOURCE, "Cambridge.xlsx");
    }

    private com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest parseFullIelts() throws Exception {
        return parse(FULL_IELTS_RESOURCE, "Cambridge-full.xlsx");
    }

    private com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest parseToeic() throws Exception {
        return parse(TOEIC_RESOURCE, "ETS_2024_Test_1_completed.xlsx");
    }

    private com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest parse(String resource, String filename) throws Exception {
        try (InputStream input = getClass().getResourceAsStream(resource)) {
            if (input == null) throw new IllegalStateException("Missing test source " + resource);
            return new ExamParserService(new ObjectMapper()).parseExamFile(new MockMultipartFile("file", filename,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", input.readAllBytes()));
        }
    }

    @SuppressWarnings("unchecked")
    private java.util.List<java.util.Map<String, Object>> questions(
            com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest request) {
        var result = new java.util.ArrayList<java.util.Map<String, Object>>();
        for (var section : request.getSections()) for (var part : section.getParts()) {
            Object rawGroups = part.getContentData().get("question_groups");
            if (!(rawGroups instanceof java.util.List<?> groups)) continue;
            for (Object rawGroup : groups) if (rawGroup instanceof java.util.Map<?, ?> group
                    && group.get("questions") instanceof java.util.List<?> items)
                for (Object rawQuestion : items) if (rawQuestion instanceof java.util.Map<?, ?> question)
                    result.add((java.util.Map<String, Object>) question);
        }
        return result;
    }
}
