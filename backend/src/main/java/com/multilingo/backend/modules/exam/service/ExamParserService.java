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

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.security.MessageDigest;
import java.util.HexFormat;
import com.multilingo.backend.modules.exam.dto.response.ExamImportPreviewResponse;

@Service
@RequiredArgsConstructor
public class ExamParserService {

    private final ObjectMapper objectMapper;

    public ExamImportPreviewResponse previewExamFile(MultipartFile file) {
        if(file == null || file.isEmpty() || file.getSize()>10*1024*1024) throw new AppException(ErrorCode.INVALID_IMPORT_FILE);
        try {
            byte[] bytes = file.getBytes();
            String hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
            try (Workbook workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
                ExamImportPreviewResponse parsed = parseWorkbook(workbook, hash);
                var issues = new java.util.ArrayList<>(parsed.issues());
                OfficialExamSourceProfile sourceProfile = OfficialExamSourceProfile.forSha256(hash);
                if ("TOEIC_LR".equals(parsed.request().getType()))
                    issues.addAll(new ExamPublicationValidator().issues(parsed.request()));
                else if ("IELTS_ACADEMIC".equals(parsed.request().getType())
                        && sourceProfile.isCambridgeIelts20()) {
                    issues.addAll(new IeltsAcademicPublicationValidator()
                            .issues(parsed.request(), sourceProfile.isCambridgeIelts20V2()).stream()
                            .filter(issue -> !"SOURCE_CONTENT_UNVERIFIED".equals(issue.code())).toList());
                }
                return new ExamImportPreviewResponse(parsed.request(),java.util.List.copyOf(issues),parsed.counts(),hash,issues.isEmpty());
            }
        } catch(Exception e) {throw new AppException(ErrorCode.INVALID_IMPORT_FILE);}
    }

    public ExamBuilderRequest parseExamFile(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > 10 * 1024 * 1024) {
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
        try {
            byte[] bytes = file.getBytes();
            String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
            try (Workbook workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
                ExamImportPreviewResponse parsed = parseWorkbook(workbook, hash);
                if (parsed != null) return parsed.request();
            }
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
                String optA = getStringValue(row.getCell(6));
                String optB = getStringValue(row.getCell(7));
                String optC = getStringValue(row.getCell(8));
                String optD = getStringValue(row.getCell(9));
                
                boolean hasD = optD != null && !optD.isEmpty();
                boolean hasC = optC != null && !optC.isEmpty();
                boolean hasB = optB != null && !optB.isEmpty();
                boolean hasA = optA != null && !optA.isEmpty();
                
                if (hasD) {
                    options.add(optA != null ? optA : "");
                    options.add(optB != null ? optB : "");
                    options.add(optC != null ? optC : "");
                    options.add(optD);
                } else if (hasC) {
                    options.add(optA != null ? optA : "");
                    options.add(optB != null ? optB : "");
                    options.add(optC);
                } else if (hasB) {
                    options.add(optA != null ? optA : "");
                    options.add(optB);
                } else if (hasA) {
                    options.add(optA);
                } else if ("MULTIPLE_CHOICE".equalsIgnoreCase(type) || "MULTIPLE_CHOICE_MULTI".equalsIgnoreCase(type)) {
                    options.add("");
                    options.add("");
                    options.add("");
                    options.add("");
                }
                
                if (!options.isEmpty()) {
                    question.put("options", options);
                }
                
                String correctAnswerStr = getStringValue(row.getCell(10));
                if (correctAnswerStr != null && !correctAnswerStr.isEmpty()) {
                    if ("MULTIPLE_CHOICE".equalsIgnoreCase(type) || "MULTIPLE_CHOICE_MULTI".equalsIgnoreCase(type)) {
                        String[] answers = correctAnswerStr.split(",");
                        List<String> ansList = new ArrayList<>();
                        for (String ans : answers) {
                            ans = ans.trim();
                            int idx = -1;
                            if ("A".equalsIgnoreCase(ans)) idx = 0;
                            else if ("B".equalsIgnoreCase(ans)) idx = 1;
                            else if ("C".equalsIgnoreCase(ans)) idx = 2;
                            else if ("D".equalsIgnoreCase(ans)) idx = 3;
                            
                            if (idx >= 0 && idx < options.size()) {
                                ansList.add(options.get(idx));
                            } else {
                                ansList.add(ans);
                            }
                        }
                        if ("MULTIPLE_CHOICE_MULTI".equalsIgnoreCase(type)) {
                            question.put("correct_answer", ansList);
                        } else {
                            question.put("correct_answer", ansList.isEmpty() ? "" : ansList.get(0));
                        }
                    } else if ("FILL_BLANK".equalsIgnoreCase(type)) {
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
            }
        } catch (Exception e) {
            throw new AppException(ErrorCode.INVALID_IMPORT_FILE);
        }
    }

    private ExamImportPreviewResponse parseWorkbook(Workbook workbook, String sha256) {
        IeltsExcelV2ExamParser ieltsParser = new IeltsExcelV2ExamParser();
        if (ieltsParser.supports(workbook)) return ieltsParser.parse(workbook, sha256);
        ExcelV2ExamParser toeicParser = new ExcelV2ExamParser();
        if (toeicParser.supports(workbook)) return toeicParser.parse(workbook, sha256);
        return null;
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
