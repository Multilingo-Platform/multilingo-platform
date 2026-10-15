package com.multilingo.backend.modules.exam.service;

import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.springframework.mock.web.MockMultipartFile;
import java.io.ByteArrayOutputStream;

final class ExcelV2Fixture {
    static final String[] HEADERS = {"Phần (Part)", "Hướng dẫn chung (Phần)", "Nhóm (Group)",
        "Loại câu hỏi (Type)", "Hướng dẫn riêng (Nhóm)", "Nội dung nhóm (Văn bản đọc/nghe)",
        "Câu hỏi (Question Text)", "Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D",
        "Đáp án đúng", "Giải thích", "Audio/File chung (Phần)", "Đính kèm chung (Nhóm)", "Đính kèm riêng (Câu hỏi)"};

    static XSSFWorkbook workbook() {
        XSSFWorkbook wb = new XSSFWorkbook();
        Sheet info = wb.createSheet("Thông Tin Đề Thi");
        info.createRow(0).createCell(0).setCellValue("Thông tin");
        Row title = info.createRow(1); title.createCell(0).setCellValue("Tên đề thi"); title.createCell(1).setCellValue("ETS 2024 Test 1");
        Row type = info.createRow(2); type.createCell(0).setCellValue("Mã loại chứng chỉ"); type.createCell(1).setCellValue("TOEIC_LR");
        Sheet qs = wb.createSheet("Exam Template"); Row header = qs.createRow(0);
        for (int c=0;c<HEADERS.length;c++) header.createCell(c).setCellValue(HEADERS[c]);
        int[] sizes = {6,25,39,30,30,16,54}; int number = 1;
        for (int p=1;p<=7;p++) {
            int start = number;
            for (int q=0;q<sizes[p-1];q++,number++) {
                Row row = qs.createRow(number);
                for (int c=0;c<16;c++) row.createCell(c).setCellValue("");
                if (q==0) {
                    row.getCell(0).setCellValue("Part " + p + ": Part " + p + ": Test");
                    row.getCell(1).setCellValue("Instructions " + p);
                    row.getCell(2).setCellValue("Group 1");
                    row.getCell(5).setCellValue(p>=6?"<p>Read this complete passage.</p>":"");
                    row.getCell(13).setCellValue(p<=4?"https://cdn.example.com/p"+p+".mp3":"");
                }
                row.getCell(3).setCellValue("MULTIPLE_CHOICE");
                row.getCell(6).setCellValue("Question " + number + " What is correct?");
                row.getCell(7).setCellValue("First"); row.getCell(8).setCellValue("Second"); row.getCell(9).setCellValue("Third");
                if(p!=2) row.getCell(10).setCellValue("Fourth");
                row.getCell(11).setCellValue("B"); row.getCell(12).setCellValue("Giải thích đã kiểm tra.");
                if(p==1) row.getCell(15).setCellValue("https://cdn.example.com/q"+number+".png");
            }
            qs.addMergedRegion(new CellRangeAddress(start,number-1,0,0));
            qs.addMergedRegion(new CellRangeAddress(start,number-1,2,2));
            qs.addMergedRegion(new CellRangeAddress(start,number-1,5,5));
        }
        return wb;
    }
    static MockMultipartFile file(XSSFWorkbook wb) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream(); wb.write(out);
        return new MockMultipartFile("file","ETS.xlsx","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",out.toByteArray());
    }
}
