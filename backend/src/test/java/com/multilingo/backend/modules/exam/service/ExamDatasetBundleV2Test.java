package com.multilingo.backend.modules.exam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.dto.response.ExamDatasetBundle;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.InputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ExamDatasetBundleV2Test {
    private static final String TOEIC_RESOURCE = "/datasets/official-source/ets-2024-test-1-completed.xlsx";
    private static final String IELTS_RESOURCE = "/datasets/official-source/cambridge-ielts-20-test-1.xlsx";

    @Test
    void exportsAndValidatesRegisteredIeltsPartialExplanationBundle() {
        ExamDatasetBundle bundle = ExamDatasetBundle.exportOfficial(OfficialExamTestData.ieltsRequest(),
                OfficialExamDatasetRegistry.CAMBRIDGE_IELTS_KEY, "TEST-APPROVAL");

        assertThat(bundle.schemaVersion()).isEqualTo(2);
        assertThat(bundle.datasetKey()).isEqualTo("cambridge-ielts-20-test-1");
        assertThat(bundle.examCode()).isEqualTo("IELTS-CAMBRIDGE-20-T1-V1");
        assertThat(bundle.explanationStatus()).isEqualTo("PARTIAL");
        assertThat(bundle.additionalSources()).isEmpty();
        bundle.validate();
    }

    @Test
    void exportsToeicSupplementAsAnAdditionalRegisteredSource() throws Exception {
        var request = parseToeic();
        ExamDatasetBundle bundle = ExamDatasetBundle.exportOfficial(request,
                OfficialExamDatasetRegistry.ETS_TOEIC_KEY, "TEST-APPROVAL");

        assertThat(bundle.schemaVersion()).isEqualTo(2);
        assertThat(bundle.examCode()).isEqualTo("TOEIC-ETS-2024-T1-V2");
        assertThat(bundle.additionalSources()).containsExactly(new ExamDatasetBundle.Source(
                "ETS_2024_Test_1 (có giải thích).xlsx", OfficialExamSourceProfile.ETS_2024_SUPPLEMENT_SHA256,
                "TEST-APPROVAL"));
        bundle.validate();
    }

    @Test
    void rejectsRegisteredToeicBundleWhenQuestion165CrossesTheGroupBoundary() throws Exception {
        ExamDatasetBundle approved = ExamDatasetBundle.exportOfficial(parseToeic(),
                OfficialExamDatasetRegistry.ETS_TOEIC_KEY, "TEST-APPROVAL");
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
                OfficialExamDatasetRegistry.ETS_TOEIC_KEY, "TEST-APPROVAL");
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
        ExamDatasetBundle approved = ExamDatasetBundle.exportOfficial(OfficialExamTestData.ieltsRequest(),
                OfficialExamDatasetRegistry.CAMBRIDGE_IELTS_KEY, "TEST-APPROVAL");
        ExamDatasetBundle unapproved = ExamDatasetBundle.exportOfficial(OfficialExamTestData.ieltsRequest(),
                OfficialExamDatasetRegistry.CAMBRIDGE_IELTS_KEY, null);
        assertThatThrownBy(unapproved::validate).isInstanceOf(RuntimeException.class);
        ExamDatasetBundle tampered = new ExamDatasetBundle(2, approved.datasetKey(), approved.version(),
                approved.examCode(), approved.source(), "0".repeat(64), approved.request(),
                approved.additionalSources(), approved.explanationStatus());
        assertThatThrownBy(tampered::validate).isInstanceOf(RuntimeException.class);

        assertThatThrownBy(() -> ExamDatasetBundle.exportOfficial(parseIelts(),
                OfficialExamDatasetRegistry.CAMBRIDGE_IELTS_KEY, "TEST-APPROVAL"))
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
                OfficialExamDatasetRegistry.ETS_TOEIC_KEY, "TEST-APPROVAL");
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
                OfficialExamDatasetRegistry.ETS_TOEIC_KEY, "TEST-APPROVAL"))
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
}
