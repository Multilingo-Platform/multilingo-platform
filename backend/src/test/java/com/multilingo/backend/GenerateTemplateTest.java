package com.multilingo.backend;

import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import java.io.FileOutputStream;

public class GenerateTemplateTest {

    @Test
    public void generateTemplate() throws Exception {
        Workbook workbook = new XSSFWorkbook();
        
        Sheet infoSheet = workbook.createSheet("ExamInfo");
        Row headerInfo = infoSheet.createRow(0);
        headerInfo.createCell(0).setCellValue("Title");
        headerInfo.createCell(1).setCellValue("Type (e.g. IELTS)");
        headerInfo.createCell(2).setCellValue("Language (e.g. en)");
        headerInfo.createCell(3).setCellValue("IsPublished (TRUE/FALSE)");
        
        Row dataInfo = infoSheet.createRow(1);
        dataInfo.createCell(0).setCellValue("Sample Exam");
        dataInfo.createCell(1).setCellValue("IELTS");
        dataInfo.createCell(2).setCellValue("en");
        dataInfo.createCell(3).setCellValue("TRUE");

        Sheet qSheet = workbook.createSheet("Questions");
        Row headerQ = qSheet.createRow(0);
        headerQ.createCell(0).setCellValue("SkillType");
        headerQ.createCell(1).setCellValue("DurationMinutes");
        headerQ.createCell(2).setCellValue("PartNumber");
        headerQ.createCell(3).setCellValue("QuestionID");
        headerQ.createCell(4).setCellValue("QuestionType");
        headerQ.createCell(5).setCellValue("Content");
        headerQ.createCell(6).setCellValue("OptionA");
        headerQ.createCell(7).setCellValue("OptionB");
        headerQ.createCell(8).setCellValue("OptionC");
        headerQ.createCell(9).setCellValue("OptionD");
        headerQ.createCell(10).setCellValue("CorrectAnswer");

        Row q1 = qSheet.createRow(1);
        q1.createCell(0).setCellValue("READING");
        q1.createCell(1).setCellValue(40);
        q1.createCell(2).setCellValue(1);
        q1.createCell(3).setCellValue("q1");
        q1.createCell(4).setCellValue("MULTIPLE_CHOICE");
        q1.createCell(5).setCellValue("What is 1+1?");
        q1.createCell(6).setCellValue("1");
        q1.createCell(7).setCellValue("2");
        q1.createCell(8).setCellValue("3");
        q1.createCell(9).setCellValue("4");
        q1.createCell(10).setCellValue("2");

        try (FileOutputStream fileOut = new FileOutputStream("Exam_Template.xlsx")) {
            workbook.write(fileOut);
        }
        workbook.close();
    }
}
