package com.multilingo.backend.modules.exam.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.exam.dto.request.*;
import com.multilingo.backend.modules.exam.dto.response.ExamImportPreviewResponse;
import com.multilingo.backend.modules.exam.dto.response.ExamImportPreviewResponse.*;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellReference;
import java.net.URI;
import java.util.*;
import java.util.regex.*;

/** Parses the builder's v2 workbook without evaluating formulas or fetching URLs. */
public final class ExcelV2ExamParser {
    private static final String SHEET = "Exam Template";
    private static final Pattern PART = Pattern.compile("^Part\\s+(\\d+)\\s*:", Pattern.CASE_INSENSITIVE);
    private static final Pattern NUMBER = Pattern.compile("^Question\\s+(\\d+)(?:\\s|$)", Pattern.CASE_INSENSITIVE);
    private static final String[] HEADERS = {"Phần (Part)", "Hướng dẫn chung (Phần)", "Nhóm (Group)",
        "Loại câu hỏi (Type)", "Hướng dẫn riêng (Nhóm)", "Nội dung nhóm (Văn bản đọc/nghe)",
        "Câu hỏi (Question Text)", "Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D",
        "Đáp án đúng", "Giải thích", "Audio/File chung (Phần)", "Đính kèm chung (Nhóm)", "Đính kèm riêng (Câu hỏi)"};

    public boolean supports(Workbook workbook) { return workbook.getSheet(SHEET) != null; }

    public ExamImportPreviewResponse parse(Workbook wb, String sha256) {
        Sheet sheet = wb.getSheet(SHEET), info = wb.getSheet("Thông Tin Đề Thi");
        if (sheet == null || info == null || sheet.getLastRowNum() > 10000) invalid();
        for (Sheet s : wb) for (Row r : s) for (Cell c : r) {
            if (c.getCellType() == CellType.FORMULA || c.getCellType() == CellType.ERROR) invalid();
        }
        Map<String,String> metadata = new HashMap<>();
        for (Row r : info) metadata.put(text(r.getCell(0)), text(r.getCell(1)));
        String title = metadata.get("Tên đề thi");
        if (title == null || title.isBlank() || !"TOEIC_LR".equals(metadata.get("Mã loại chứng chỉ"))) invalid();
        Map<String,Integer> columns = new HashMap<>();
        if (sheet.getRow(0) == null) invalid();
        for (Cell c : sheet.getRow(0)) {
            String name = text(c);
            if (!name.isEmpty() && columns.put(name, c.getColumnIndex()) != null) invalid();
        }
        for (String h : HEADERS) if (!columns.containsKey(h)) invalid();
        boolean sourcePlaceholders = "5d0a4415c3c1d49dc55d8150e6454e7144eda843d1a7c3aacb20efbc095699ce".equals(sha256)
            || "ETS 2024 Test 1".equals(title) && hasPlaceholderMarkers(sheet, columns);
        List<Issue> issues = new ArrayList<>();
        Map<Integer,PartBuilderRequest> parts = new LinkedHashMap<>();
        Map<String,Map<String,Object>> groups = new LinkedHashMap<>();
        Set<String> ids = new HashSet<>();
        int currentPart=0, currentNumber=0; String currentGroup="";
        for (int r=1;r<=sheet.getLastRowNum();r++) {
            Row row=sheet.getRow(r); if(row==null || empty(row)) continue;
            String partName=value(sheet,r,columns,0), groupName=value(sheet,r,columns,2);
            if (!partName.isBlank()) {
                Matcher match=PART.matcher(partName); if(!match.find()) invalid();
                int p=Integer.parseInt(match.group(1));
                if(p<1 || p>7 || p<currentPart) invalid();
                if(p!=currentPart) {currentGroup="";currentPart=p;}
                if (!parts.containsKey(p)) {
                    Map<String,Object> data=new LinkedHashMap<>();
                    // Remove only the duplicated export prefix, not user content.
                    data.put("part_title",partName.replaceFirst("(?i)^Part\\s+\\d+:\\s*(?=Part\\s+\\d+:)",""));
                    data.put("instruction",value(sheet,r,columns,1)); data.put("question_groups",new ArrayList<>());
                    if(sourcePlaceholders) data.put("import_profile","ETS_2024_TEMPLATE_44");
                    if (sha256 != null) data.put("import_source_sha256", sha256);
                    putMedia(data,"shared_audio",value(sheet,r,columns,13),"audio",issues,r,columns.get(HEADERS[13]),null);
                    parts.put(p,PartBuilderRequest.builder().partNumber(p).contentData(data).build());
                }
            }
            if(currentPart==0) invalid();
            if(!groupName.isBlank()) currentGroup=groupName;
            if(currentGroup.isBlank()) invalid();
            String groupKey=currentPart+":"+currentGroup;
            Map<String,Object> group=groups.get(groupKey);
            if(group==null) {
                group=new LinkedHashMap<>();
                int groupIndex=(int)groups.keySet().stream().filter(k->k.startsWith(currentPartPrefix(parts))).count()+1;
                group.put("group_id","toeic-p"+currentPart+"-g"+groupIndex);
                group.put("instruction",value(sheet,r,columns,4)); group.put("content_html",value(sheet,r,columns,5));
                group.put("questions",new ArrayList<>());
                putMedia(group,"shared_media",value(sheet,r,columns,14),"image",issues,r,columns.get(HEADERS[14]),null);
                groups.put(groupKey,group);
                ((List<Map<String,Object>>)parts.get(currentPart).getContentData().get("question_groups")).add(group);
            } else {
                mergeText(group,"instruction",value(sheet,r,columns,4));
                mergeText(group,"content_html",value(sheet,r,columns,5));
            }
            String prompt=value(sheet,r,columns,6); Matcher num=NUMBER.matcher(prompt);
            if(!num.find()) invalid();
            int number=Integer.parseInt(num.group(1));
            String id="q_"+String.format(Locale.ROOT,"%03d",number);
            if(number<=currentNumber || number>200 || !ids.add(id)) invalid();
            currentNumber=number;
            if(!"MULTIPLE_CHOICE".equals(value(sheet,r,columns,3))) invalid();
            Map<String,Object> question=new LinkedHashMap<>();
            question.put("question_id",id); question.put("type","SINGLE_CHOICE"); question.put("question_text",prompt);
            List<Map<String,Object>> options=new ArrayList<>();
            int optionCount = currentPart == 2 && value(sheet,r,columns,10).isBlank() ? 3 : 4;
            for(int o=0;o<optionCount;o++) {
                String option=value(sheet,r,columns,7+o);
                options.add(Map.of("id",String.valueOf((char)('A'+o)),"text",option));
            }
            question.put("options",options);
            String answer=value(sheet,r,columns,11).toUpperCase(Locale.ROOT);
            question.put("correct_answer",answer.isBlank()?null:answer);
            question.put("explanation",value(sheet,r,columns,12));
            if (value(sheet,r,columns,12).isBlank())
                issue(issues,"EXPLANATION_REQUIRED",r,columns.get(HEADERS[12]),id,"Thiếu giải thích; cần người biên tập bổ sung.");
            if (currentPart >= 3) for (int c = 7; c <= 10; c++)
                if (value(sheet,r,columns,c).isBlank())
                    issue(issues,"OPTIONS_INVALID",r,columns.get(HEADERS[c]),id,"Thiếu nội dung lựa chọn.");
            if (currentPart >= 6 && value(sheet,r,columns,5).isBlank())
                issue(issues,"CONTEXT_REQUIRED",r,columns.get(HEADERS[5]),id,"Thiếu đoạn đọc của nhóm.");
            if(options.stream().noneMatch(o->answer.equals(o.get("id"))))
                issue(issues,"ANSWER_INVALID",r,columns.get(HEADERS[11]),id,"Đáp án chưa khớp lựa chọn.");
            if(currentPart==2 && options.size()!=3)
                issue(issues,"OPTIONS_INVALID",r,columns.get(HEADERS[10]),id,"Part 2 cần ba lựa chọn.");
            putMedia(question,"media",value(sheet,r,columns,15),"image",issues,r,columns.get(HEADERS[15]),id);
            if(sourcePlaceholders) for(int c : new int[]{4,5,7,8,9,10,11,12,13,14,15}) {
                if("44".equals(value(sheet,r,columns,c)))
                    issue(issues,"SOURCE_PLACEHOLDER",r,columns.get(HEADERS[c]),id,"Ô mẫu cần được biên tập xác nhận.");
            }
            ((List<Map<String,Object>>)group.get("questions")).add(question);
        }
        if(parts.isEmpty() || ids.isEmpty()) invalid();
        List<SectionBuilderRequest> sections=new ArrayList<>();
        for(String skill:List.of("LISTENING","READING")) {
            List<PartBuilderRequest> selected=parts.values().stream().filter(p->(p.getPartNumber()<=4)=="LISTENING".equals(skill)).toList();
            if(!selected.isEmpty()) sections.add(SectionBuilderRequest.builder().skillType(skill).durationMinutes("LISTENING".equals(skill)?45:75).parts(selected).build());
        }
        ExamBuilderRequest request=ExamBuilderRequest.builder().title(title).type("TOEIC_LR").examLanguage("en").isPublished(false).sections(sections).build();
        return new ExamImportPreviewResponse(request,List.copyOf(issues),new Counts(parts.size(),groups.size(),ids.size()),sha256,false);
    }

    private static String currentPartPrefix(Map<Integer,PartBuilderRequest> parts) {
        return parts.keySet().stream().reduce((a,b)->b).orElseThrow()+":";
    }
    private static void mergeText(Map<String,Object> group,String key,String text) {
        if(text.isEmpty()) return;
        Object old=group.get(key);
        if(old==null || old.equals("")) group.put(key,text); else if(!old.equals(text)) invalid();
    }
    private static boolean hasPlaceholderMarkers(Sheet sheet,Map<String,Integer> columns) {
        int count=0;
        for(Row row:sheet) if("44".equals(text(row.getCell(columns.get(HEADERS[15]))))) count++;
        return count>=50;
    }
    private static boolean empty(Row row) {for(Cell c:row) if(!text(c).isBlank()) return false;return true;}
    private static String value(Sheet sheet,int r,Map<String,Integer> columns,int field) {
        int c=columns.get(HEADERS[field]);
        for(var merged:sheet.getMergedRegions()) if(merged.isInRange(r,c)) {r=merged.getFirstRow();c=merged.getFirstColumn();break;}
        Row row=sheet.getRow(r);return row==null?"":text(row.getCell(c));
    }
    private static String text(Cell cell) {
        if(cell==null || cell.getCellType()==CellType.BLANK) return "";
        if(cell.getCellType()!=CellType.STRING && cell.getCellType()!=CellType.NUMERIC) {invalid();return "";}
        return new DataFormatter(Locale.ROOT).formatCellValue(cell).trim();
    }
    public static boolean safeUrl(Object raw) {
        if(!(raw instanceof String value) || value.length()>2000) return false;
        try {URI uri=URI.create(value);return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost()!=null && uri.getUserInfo()==null;}
        catch(IllegalArgumentException e) {return false;}
    }
    private static void putMedia(Map<String,Object> target,String key,String value,String type,List<Issue> issues,int row,int col,String id) {
        if(value.isBlank()) return;
        if(!safeUrl(value)) {issue(issues,"MEDIA_INVALID",row,col,id,"Đường dẫn media không hợp lệ.");return;}
        target.put(key,"audio".equals(type)?Map.of("url",value):Map.of("type",type,"url",value));
    }
    private static void issue(List<Issue> issues,String code,int row,int col,String id,String message) {
        issues.add(new Issue(code,SHEET,new CellReference(row,col).formatAsString(),id,message));
    }
    private static void invalid() {throw new AppException(ErrorCode.INVALID_IMPORT_FILE);}
}
