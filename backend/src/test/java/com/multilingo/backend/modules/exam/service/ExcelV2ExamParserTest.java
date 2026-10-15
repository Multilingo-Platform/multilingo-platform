package com.multilingo.backend.modules.exam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

class ExcelV2ExamParserTest {
    private final ExamParserService parser = new ExamParserService(new ObjectMapper());

    @Test void readsAllQuestionsWithCanonicalKeysAndPreservesMergedContext() throws Exception {
        try(var wb=ExcelV2Fixture.workbook()) {
            var request=parser.parseExamFile(ExcelV2Fixture.file(wb));
            assertThat(request.getTitle()).isEqualTo("ETS 2024 Test 1");
            assertThat(request.getExamLanguage()).isEqualTo("en");
            assertThat(request.isPublished()).isFalse();
            assertThat(request.getSections()).extracting(s->s.getSkillType()).containsExactly("LISTENING","READING");
            assertThat(request.getSections()).extracting(s->s.getDurationMinutes()).containsExactly(45,75);
            var p=request.getSections().get(1).getParts().get(1);
            assertThat(p.getPartNumber()).isEqualTo(6);
            var groups=(List<Map<String,Object>>)p.getContentData().get("question_groups");
            assertThat(groups.get(0).get("content_html")).isEqualTo("<p>Read this complete passage.</p>");
            var questions=(List<Map<String,Object>>)groups.get(0).get("questions");
            assertThat(questions).hasSize(16);
            assertThat(questions.get(0)).containsEntry("question_id","q_131").containsEntry("type","SINGLE_CHOICE").containsEntry("correct_answer","B");
            assertThat((List<Map<String,Object>>)questions.get(0).get("options")).containsExactly(
                Map.of("id","A","text","First"),Map.of("id","B","text","Second"),Map.of("id","C","text","Third"),Map.of("id","D","text","Fourth"));
        }
    }
    @Test void rejectsFormulaWithoutEvaluatingIt() throws Exception {
        try(var wb=ExcelV2Fixture.workbook()) {
            wb.getSheet("Exam Template").getRow(1).getCell(11).setCellFormula("1+1");
            assertThatThrownBy(()->parser.parseExamFile(ExcelV2Fixture.file(wb))).isInstanceOf(AppException.class);
        }
    }
    @Test void rejectsDuplicateNumberRatherThanDroppingQuestion() throws Exception {
        try(var wb=ExcelV2Fixture.workbook()) {
            wb.getSheet("Exam Template").getRow(2).getCell(6).setCellValue("Question 1 duplicate");
            assertThatThrownBy(()->parser.parseExamFile(ExcelV2Fixture.file(wb))).isInstanceOf(AppException.class);
        }
    }
    @Test void rejectsMissingRequiredHeader() throws Exception {
        try(var wb=ExcelV2Fixture.workbook()) {
            wb.getSheet("Exam Template").getRow(0).getCell(11).setCellValue("");
            assertThatThrownBy(()->parser.parseExamFile(ExcelV2Fixture.file(wb))).isInstanceOf(AppException.class);
        }
    }
}
