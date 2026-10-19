package com.multilingo.backend.modules.exam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.modules.exam.entity.*;
import com.multilingo.backend.modules.exam.repository.*;
import com.multilingo.backend.modules.exam.dto.response.ExamDatasetBundle;
import com.multilingo.backend.modules.exam.service.impl.AdminExamServiceImpl;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.InputStream;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ExamPublicationFlowTest {
    private final ExamRepository exams=mock(ExamRepository.class);
    private final ExamSectionRepository sections=mock(ExamSectionRepository.class);
    private final ExamPartRepository parts=mock(ExamPartRepository.class);
    private final AdminExamServiceImpl service=new AdminExamServiceImpl(exams,sections,parts);
    private final ExamParserService parser=new ExamParserService(new ObjectMapper());

    @Test void publishedCreateRejectsInvalidKeyBeforeWriting() throws Exception {
        try(var wb=ExcelV2Fixture.workbook()) {
            wb.getSheet("Exam Template").getRow(1).getCell(11).setCellValue("44");
            var req=parser.parseExamFile(ExcelV2Fixture.file(wb)); req.setPublished(true);
            when(exams.save(any())).thenAnswer(i->i.getArgument(0)); when(sections.save(any())).thenAnswer(i->i.getArgument(0));
            assertThatThrownBy(()->service.createExam(req)).isInstanceOf(AppException.class);
            verify(exams,never()).save(any());
        }
    }
    @Test void draftStoresCanonicalBuilderAnswersAndCorrectDurationOrder() {
        var q=new LinkedHashMap<String,Object>(Map.of("question_id","q_101","type","MULTIPLE_CHOICE","question_text","Sentence",
            "metadata",Map.of("options",List.of("first","second","third","fourth"),"correct_option_index",1,"correct_answer","second","explanation","Vì vậy.")));
        var req=com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest.builder().title("Draft").type("TOEIC_LR").examLanguage("ENGLISH").isPublished(false)
            .sections(List.of(com.multilingo.backend.modules.exam.dto.request.SectionBuilderRequest.builder().skillType("READING").durationMinutes(75)
            .parts(List.of(com.multilingo.backend.modules.exam.dto.request.PartBuilderRequest.builder().partNumber(5)
                .contentData(Map.of("part_title","Part 5","question_groups",List.of(Map.of("group_id","g1","questions",List.of(q))))).build())).build())).build();
        when(exams.save(any())).thenAnswer(i->{Exam e=i.getArgument(0);e.setId(1);return e;});
        when(sections.save(any())).thenAnswer(i->i.getArgument(0));
        service.createExam(req);
        var exam=org.mockito.ArgumentCaptor.forClass(Exam.class);verify(exams).save(exam.capture());
        assertThat(exam.getValue().getExamLanguage()).isEqualTo("en");assertThat(exam.getValue().getDurationMinutes()).isEqualTo(75);
        var part=org.mockito.ArgumentCaptor.forClass(ExamPart.class);verify(parts).save(part.capture());
        var groups=(List<Map<String,Object>>)part.getValue().getContentData().get("question_groups");
        var saved=(List<Map<String,Object>>)groups.get(0).get("questions");
        assertThat(saved.get(0)).containsEntry("type","SINGLE_CHOICE").containsEntry("correct_answer","B").containsEntry("explanation","Vì vậy.");
        assertThat(saved.get(0)).doesNotContainKey("metadata");
        assertThat(q).containsKey("metadata"); // source must not be mutated
    }
    @Test void statusPublishCannotBypassContentValidation() {
        Exam exam=Exam.builder().type("TOEIC_LR").title("Draft").examLanguage("en").isPublished(false).build();exam.setId(1);
        when(exams.findById(1)).thenReturn(Optional.of(exam)); when(sections.findByExam_Id(1)).thenReturn(List.of());
        assertThatThrownBy(()->service.updateExamStatus(1,true)).isInstanceOf(AppException.class);
        assertThat(exam.getIsPublished()).isFalse();verify(exams,never()).save(any());
    }
    @Test void previewLocatesInvalidAnswerAndDoesNotExposeItInIssueMessage() throws Exception {
        try(var wb=ExcelV2Fixture.workbook()) {
            wb.getSheet("Exam Template").getRow(1).getCell(11).setCellValue("bad-key");
            var preview=parser.previewExamFile(ExcelV2Fixture.file(wb));
            assertThat(preview.counts().questions()).isEqualTo(200);
            assertThat(preview.issues()).anySatisfy(i->{assertThat(i.cell()).isEqualTo("L2");assertThat(i.questionId()).isEqualTo("q_001");assertThat(i.message()).doesNotContain("BAD-KEY");});
            assertThat(preview.canPublish()).isFalse();
        }
    }

    @Test void structurallyInvalidDraftCannotBeSaved() throws Exception {
        try (var workbook = ExcelV2Fixture.workbook()) {
            var request = parser.parseExamFile(ExcelV2Fixture.file(workbook));
            var group = (Map<String,Object>) ((List<?>) request.getSections().getFirst().getParts().getFirst().getContentData().get("question_groups")).getFirst();
            var question = (Map<String,Object>) ((List<?>) group.get("questions")).getFirst();
            question.remove("question_id");
            assertThatThrownBy(() -> service.createExam(request)).isInstanceOf(AppException.class);
            verify(exams, never()).save(any());
        }
    }

    @Test void publishedIeltsAllowsMissingExplanationsButRequiresCompleteAnswerKeys() {
        var request = OfficialExamTestData.ieltsRequest();
        request.setPublished(true);
        when(exams.save(any())).thenAnswer(i -> {
            Exam exam = i.getArgument(0);
            exam.setId(81);
            return exam;
        });
        when(sections.save(any())).thenAnswer(i -> i.getArgument(0));
        when(parts.save(any())).thenAnswer(i -> i.getArgument(0));

        assertThat(service.createExamWithCode(request, "IELTS-CAMBRIDGE-20-T1-V1")).isEqualTo(81);

        var savedExam = org.mockito.ArgumentCaptor.forClass(Exam.class);
        verify(exams).save(savedExam.capture());
        assertThat(savedExam.getValue().getIsPublished()).isTrue();
        assertThat(savedExam.getValue().getDurationMinutes()).isEqualTo(150);
        verify(parts, times(9)).save(any());

        reset(exams, sections, parts);
        var invalid = OfficialExamTestData.ieltsRequest();
        invalid.setPublished(true);
        OfficialExamTestData.questions(invalid).stream().filter(question -> "r_001".equals(question.get("question_id")))
                .findFirst().orElseThrow().remove("correct_answer");

        assertThatThrownBy(() -> service.createExamWithCode(invalid, "IELTS-CAMBRIDGE-20-T1-V1"))
                .isInstanceOf(AppException.class);
        verify(exams, never()).save(any());
    }

    @Test void publishedIeltsV2RequiresEveryExplanationBeforeAnyWrite() throws Exception {
        try (InputStream input = getClass().getResourceAsStream(
                "/datasets/official-source/cambridge-ielts-20-test-1-full.v2.xlsx")) {
            assertThat(input).isNotNull();
            var request = parser.parseExamFile(new MockMultipartFile("file", "Cambridge-full.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", input.readAllBytes()));
            request.setPublished(true);
            OfficialExamTestData.questions(request).stream()
                    .filter(question -> "w_002".equals(question.get("question_id")))
                    .findFirst().orElseThrow().put("explanation", " ");

            assertThatThrownBy(() -> service.createExamWithCode(request, "IELTS-CAMBRIDGE-20-T1-V2"))
                    .isInstanceOf(AppException.class);
            verifyNoInteractions(exams, sections, parts);
        }
    }

    @Test void registeredToeicCodeCannotBeSavedOrPublishedWithAnIeltsIdentity() {
        var wrongIdentity = com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest.builder()
                .title("ETS 2024 Test 1").type("IELTS_ACADEMIC").examLanguage("en")
                .isPublished(false).sections(List.of()).build();
        assertThatThrownBy(() -> service.createExamWithCode(wrongIdentity, "TOEIC-ETS-2024-T1-V2"))
                .isInstanceOf(AppException.class);

        Exam existing = Exam.builder().code("TOEIC-ETS-2024-T1-V2").title("ETS 2024 Test 1")
                .type("IELTS_ACADEMIC").examLanguage("en").isPublished(false).build();
        existing.setId(82);
        when(exams.findById(82)).thenReturn(Optional.of(existing));
        when(sections.findByExam_Id(82)).thenReturn(List.of());

        assertThatThrownBy(() -> service.updateExamStatus(82, true)).isInstanceOf(AppException.class);
        assertThat(existing.getIsPublished()).isFalse();
        verify(exams, never()).save(any());
    }

    @Test void registeredToeicCodeCannotPublishARequestMissingAQuestion() throws Exception {
        try (InputStream input = getClass().getResourceAsStream(
                "/datasets/official-source/ets-2024-test-1-completed.xlsx")) {
            assertThat(input).isNotNull();
            var request = parser.parseExamFile(new MockMultipartFile("file", "ETS_2024_Test_1_completed.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", input.readAllBytes()));
            var registeredDataset = OfficialExamDatasetRegistry.require(OfficialExamDatasetRegistry.ETS_TOEIC_KEY, 2);
            assertThatCode(() -> ExamDatasetBundle.requireRegisteredShape(registeredDataset, request))
                    .doesNotThrowAnyException();

            var partSeven = request.getSections().stream().flatMap(section -> section.getParts().stream())
                    .filter(part -> Integer.valueOf(7).equals(part.getPartNumber())).findFirst().orElseThrow();
            @SuppressWarnings("unchecked")
            var groups = (List<Map<String, Object>>) (List<?>) partSeven.getContentData().get("question_groups");
            boolean removed = false;
            for (Map<String, Object> group : groups) {
                @SuppressWarnings("unchecked")
                var questions = (List<Map<String, Object>>) (List<?>) group.get("questions");
                removed |= questions.removeIf(question -> "q_200".equals(question.get("question_id")));
            }
            assertThat(removed).isTrue();
            assertThatCode(() -> new ExamPublicationValidator().requirePublishable(request))
                    .as("the generic validator accepts this otherwise valid, one-question-short request")
                    .doesNotThrowAnyException();
            assertThatThrownBy(() -> ExamDatasetBundle.requireRegisteredShape(registeredDataset, request))
                    .isInstanceOf(AppException.class);
            request.setPublished(true);
            when(exams.save(any())).thenAnswer(invocation -> {
                Exam exam = invocation.getArgument(0);
                exam.setId(83);
                return exam;
            });
            when(sections.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
            when(parts.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

            assertThatThrownBy(() -> service.createExamWithCode(request, "TOEIC-ETS-2024-T1-V2"))
                    .isInstanceOf(AppException.class);
            verify(exams, never()).save(any());
        }
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"replacement", "cross-part-swap"})
    void registeredToeicCannotPublishNoncanonicalQuestionIdsBeforeWriting(String mutation) throws Exception {
        try (InputStream input = getClass().getResourceAsStream(
                "/datasets/official-source/ets-2024-test-1-completed.xlsx")) {
            var request = parser.parseExamFile(new MockMultipartFile("file", "upload.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", input.readAllBytes()));
            var definition = OfficialExamDatasetRegistry.require(OfficialExamDatasetRegistry.ETS_TOEIC_KEY, 2);
            ExamDatasetBundle.requireRegisteredShape(definition, request);
            var questions = new ArrayList<Map<String, Object>>();
            for (var section : request.getSections()) for (var part : section.getParts())
                for (Object raw : (List<?>) part.getContentData().get("question_groups"))
                    for (Object question : (List<?>) ((Map<?, ?>) raw).get("questions"))
                        questions.add((Map<String, Object>) question);
            if (mutation.equals("replacement")) questions.getLast().put("question_id", "noncanonical_replacement");
            else {
                questions.getFirst().put("question_id", "q_200");
                questions.getLast().put("question_id", "q_001");
            }
            new ExamPublicationValidator().requirePublishable(request);
            request.setPublished(true);
            when(exams.save(any())).thenAnswer(invocation -> {
                Exam exam = invocation.getArgument(0); exam.setId(83); return exam;
            });
            when(sections.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
            when(parts.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
            assertThatThrownBy(() -> service.createExamWithCode(request, "TOEIC-ETS-2024-T1-V2"))
                    .isInstanceOf(AppException.class);
            verify(exams, never()).save(any());
            verifyNoInteractions(sections, parts);
        }
    }

    @Test
    void adminExportRejectsRegisteredV2WithoutApprovalReferenceAndExportsValidBundleWithReference() throws Exception {
        try (InputStream input = getClass().getResourceAsStream(
                "/datasets/official-source/cambridge-ielts-20-test-1-full.v2.xlsx")) {
            assertThat(input).isNotNull();
            var parsed = parser.parseExamFile(new MockMultipartFile("file", "Cambridge-full.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", input.readAllBytes()));

            Exam exam = Exam.builder().code("IELTS-CAMBRIDGE-20-T1-V2").title("Cambridge Ielts 20 Test 1")
                    .type("IELTS_ACADEMIC").examLanguage("en").isPublished(false).build();
            exam.setId(88);
            when(exams.findById(88)).thenReturn(Optional.of(exam));

            List<ExamSection> sectionEntities = new ArrayList<>();
            int sectionIdSeq = 100;
            int partIdSeq = 200;
            for (var sectionReq : parsed.getSections()) {
                int secId = sectionIdSeq++;
                ExamSection sec = new ExamSection();
                sec.setId(secId);
                sec.setExam(exam);
                sec.setSkillType(sectionReq.getSkillType());
                sec.setDurationMinutes(sectionReq.getDurationMinutes());
                sec.setOrderIndex(secId - 99);
                sectionEntities.add(sec);

                List<ExamPart> partEntities = new ArrayList<>();
                for (var partReq : sectionReq.getParts()) {
                    ExamPart part = new ExamPart();
                    part.setId(partIdSeq++);
                    part.setSection(sec);
                    part.setPartNumber(partReq.getPartNumber());
                    part.setContentData(partReq.getContentData());
                    partEntities.add(part);
                }
                when(parts.findBySection_Id(secId)).thenReturn(partEntities);
            }
            when(sections.findByExam_Id(88)).thenReturn(sectionEntities);

            // 1. Calling exportDataset on registered V2 uses server-side certified reference without caller self-declaration
            ExamDatasetBundle bundle = service.exportDataset(88);
            assertThat(bundle.schemaVersion()).isEqualTo(2);
            assertThat(bundle.version()).isEqualTo(2);
            assertThat(bundle.examCode()).isEqualTo("IELTS-CAMBRIDGE-20-T1-V2");
            assertThat(bundle.explanationStatus()).isEqualTo("COMPLETE");
            assertThat(bundle.source().approvalReference()).isEqualTo("OWNER_RIGHTS_CONFIRMED_CHAT_2026-10-19");
            bundle.validate();

            // 2. Caller attempting to provide an arbitrary forged reference is rejected
            assertThatThrownBy(() -> service.exportDataset(88, "FORGED-CALLER-REF"))
                    .isInstanceOf(AppException.class)
                    .hasMessageContaining("Caller không thể tự khai approval reference");

            // 3. Passing exact matching server reference is also accepted
            ExamDatasetBundle bundleWithRef = service.exportDataset(88, "OWNER_RIGHTS_CONFIRMED_CHAT_2026-10-19");
            assertThat(bundleWithRef.source().approvalReference()).isEqualTo("OWNER_RIGHTS_CONFIRMED_CHAT_2026-10-19");
            bundleWithRef.validate();

            // 4. Round-trip Jackson succeeds and validates
            var mapper = new ObjectMapper();
            ExamDatasetBundle roundTripped = mapper.readValue(mapper.writeValueAsBytes(bundle), ExamDatasetBundle.class);
            roundTripped.validate();
            assertThat(roundTripped.checksum()).isEqualTo(bundle.checksum());

            // 5. Calling exportDataset on an unapproved exam code (V1) fails closed
            Exam unapprovedExam = Exam.builder().code("IELTS-CAMBRIDGE-20-T1-V1").title("Cambridge Ielts 20 Test 1")
                    .type("IELTS_ACADEMIC").examLanguage("en").isPublished(false).build();
            unapprovedExam.setId(89);
            when(exams.findById(89)).thenReturn(Optional.of(unapprovedExam));
            when(sections.findByExam_Id(89)).thenReturn(sectionEntities);
            assertThatThrownBy(() -> service.exportDataset(89))
                    .isInstanceOf(AppException.class)
                    .hasMessageContaining("approval reference");
        }
    }
}
