package com.multilingo.backend.modules.exam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.multilingo.backend.modules.exam.dto.request.PartBuilderRequest;
import com.multilingo.backend.modules.exam.dto.request.SectionBuilderRequest;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ExamParserService {

    private final ObjectMapper objectMapper;

    public ExamBuilderRequest parseExamFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AppException(ErrorCode.INVALID_IMPORT_FILE);
        }

        String filename = file.getOriginalFilename();
        if (filename != null && filename.endsWith(".json")) {
            return parseJson(file);
        } else if (filename != null && (filename.endsWith(".xlsx") || filename.endsWith(".xls"))) {
            return parseExcel(file);
        } else {
            throw new AppException(ErrorCode.INVALID_IMPORT_FILE);
        }
    }

    private ExamBuilderRequest parseJson(MultipartFile file) {
        try {
            return objectMapper.readValue(file.getInputStream(), ExamBuilderRequest.class);
        } catch (Exception e) {
            throw new AppException(ErrorCode.INVALID_IMPORT_FILE);
        }
    }

    private ExamBuilderRequest parseExcel(MultipartFile file) {
        try (InputStream is = file.getInputStream(); Workbook workbook = new XSSFWorkbook(is)) {
            ExamBuilderRequest request = new ExamBuilderRequest();

            Sheet infoSheet = workbook.getSheet("ExamInfo");
            if (infoSheet == null || infoSheet.getLastRowNum() < 1) {
                throw new AppException(ErrorCode.INVALID_IMPORT_FILE);
            }
            Row infoRow = infoSheet.getRow(1); // row 0 is header
            if (infoRow != null) {
                request.setTitle(getStringValue(infoRow.getCell(0)));
                request.setType(getStringValue(infoRow.getCell(1)));
                request.setExamLanguage(getStringValue(infoRow.getCell(2)));
                request.setPublished(getBooleanValue(infoRow.getCell(3)));
            }

            Sheet questionsSheet = workbook.getSheet("Questions");
            if (questionsSheet == null || questionsSheet.getLastRowNum() < 1) {
                throw new AppException(ErrorCode.INVALID_IMPORT_FILE);
            }

            Map<String, SectionBuilderRequest> sectionMap = new HashMap<>();
            Map<String, Map<Integer, PartBuilderRequest>> partMap = new HashMap<>();
            Map<String, Map<Integer, List<Map<String, Object>>>> questionsMap = new HashMap<>();
            
            for (int i = 1; i <= questionsSheet.getLastRowNum(); i++) {
                Row row = questionsSheet.getRow(i);
                if (row == null) continue;
                
                String skillType = getStringValue(row.getCell(0));
                if (skillType == null || skillType.isEmpty()) continue;
                
                int durationMinutes = (int) getNumericValue(row.getCell(1));
                int partNumber = (int) getNumericValue(row.getCell(2));
                
                // Ensure section exists
                sectionMap.computeIfAbsent(skillType, k -> {
                    SectionBuilderRequest s = new SectionBuilderRequest();
                    s.setSkillType(skillType);
                    s.setDurationMinutes(durationMinutes);
                    s.setParts(new ArrayList<>());
                    return s;
                });
                
                // Ensure part exists
                partMap.computeIfAbsent(skillType, k -> new HashMap<>())
                       .computeIfAbsent(partNumber, k -> {
                           PartBuilderRequest p = new PartBuilderRequest();
                           p.setPartNumber(partNumber);
                           p.setContentData(new HashMap<>());
                           sectionMap.get(skillType).getParts().add(p);
                           return p;
                       });
                
                // Parse question
                Map<String, Object> question = new HashMap<>();
                question.put("question_id", getStringValue(row.getCell(3)));
                
                String type = getStringValue(row.getCell(4));
                question.put("type", type);
                question.put("content", getStringValue(row.getCell(5)));
                
                List<String> options = new ArrayList<>();
                String optA = getStringValue(row.getCell(6)); if (optA != null && !optA.isEmpty()) options.add(optA);
                String optB = getStringValue(row.getCell(7)); if (optB != null && !optB.isEmpty()) options.add(optB);
                String optC = getStringValue(row.getCell(8)); if (optC != null && !optC.isEmpty()) options.add(optC);
                String optD = getStringValue(row.getCell(9)); if (optD != null && !optD.isEmpty()) options.add(optD);
                
                if (!options.isEmpty()) {
                    question.put("options", options);
                }
                
                String correctAnswerStr = getStringValue(row.getCell(10));
                if (correctAnswerStr != null) {
                    if ("MULTIPLE_CHOICE".equalsIgnoreCase(type) || "FILL_BLANK".equalsIgnoreCase(type)) {
                        String[] answers = correctAnswerStr.split(",");
                        List<String> ansList = new ArrayList<>();
                        for (String ans : answers) {
                            ansList.add(ans.trim());
                        }
                        question.put("correct_answer", ansList);
                    } else {
                        question.put("correct_answer", correctAnswerStr.trim());
                    }
                }
                
                questionsMap.computeIfAbsent(skillType, k -> new HashMap<>())
                            .computeIfAbsent(partNumber, k -> new ArrayList<>())
                            .add(question);
            }
            
            // Set questions list into contentData of each part
            for (Map.Entry<String, Map<Integer, PartBuilderRequest>> skillEntry : partMap.entrySet()) {
                String skill = skillEntry.getKey();
                for (Map.Entry<Integer, PartBuilderRequest> partEntry : skillEntry.getValue().entrySet()) {
                    int partNum = partEntry.getKey();
                    PartBuilderRequest part = partEntry.getValue();
                    List<Map<String, Object>> questions = questionsMap.get(skill).get(partNum);
                    
                    Map<String, Object> contentData = new HashMap<>();
                    contentData.put("questions", questions);
                    part.setContentData(contentData);
                }
            }
            
            request.setSections(new ArrayList<>(sectionMap.values()));
            return request;
        } catch (Exception e) {
            throw new AppException(ErrorCode.INVALID_IMPORT_FILE);
        }
    }
    
    private String getStringValue(Cell cell) {
        if (cell == null) return null;
        if (cell.getCellType() == CellType.STRING) return cell.getStringCellValue();
        if (cell.getCellType() == CellType.NUMERIC) return String.valueOf(cell.getNumericCellValue());
        return null;
    }
    
    private double getNumericValue(Cell cell) {
        if (cell == null) return 0;
        if (cell.getCellType() == CellType.NUMERIC) return cell.getNumericCellValue();
        if (cell.getCellType() == CellType.STRING) {
            try { return Double.parseDouble(cell.getStringCellValue()); } catch (Exception e) { return 0; }
        }
        return 0;
    }
    
    private boolean getBooleanValue(Cell cell) {
        if (cell == null) return false;
        if (cell.getCellType() == CellType.BOOLEAN) return cell.getBooleanCellValue();
        if (cell.getCellType() == CellType.STRING) return Boolean.parseBoolean(cell.getStringCellValue());
        return false;
    }
}
