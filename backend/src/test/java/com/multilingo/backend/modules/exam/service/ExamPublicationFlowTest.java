package com.multilingo.backend.modules.exam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.modules.exam.entity.*;
import com.multilingo.backend.modules.exam.repository.*;
import com.multilingo.backend.modules.exam.service.impl.AdminExamServiceImpl;
import org.junit.jupiter.api.Test;
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
}
