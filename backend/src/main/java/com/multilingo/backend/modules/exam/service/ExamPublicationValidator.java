package com.multilingo.backend.modules.exam.service;

import com.multilingo.backend.common.exception.*;
import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import com.multilingo.backend.modules.exam.dto.response.ExamImportPreviewResponse.Issue;
import java.util.*;

/** Structural/content readiness only. Human correctness and media availability are separate gates. */
public final class ExamPublicationValidator {
    public void requireStructure(ExamBuilderRequest request) {
        if (request != null && "NLTV".equals(request.getType())) {
            new NltvPublicationValidator().requireStructure(request);
            return;
        }
        if (request != null && "LANGUAGE_PRACTICE".equals(request.getType())) {
            new LanguagePracticePublicationValidator().requireStructure(request);
            return;
        }
        if (isManagedCertificate(request) && issues(request).stream().anyMatch(issue ->
                Set.of("STRUCTURE_INVALID", "ID_INVALID", "SKILL_INVALID", "DURATION_INVALID", "QUESTION_COUNT_INVALID")
                        .contains(issue.code())))
            throw new AppException(ErrorCode.VALIDATION_FAILED, "Cấu trúc đề không hợp lệ; kiểm tra Part, nhóm, ID và thời lượng.");
    }
    public void requirePublishable(ExamBuilderRequest request) {
        if (request != null && "NLTV".equals(request.getType())) {
            new NltvPublicationValidator().requirePublishable(request);
            return;
        }
        if (request != null && "LANGUAGE_PRACTICE".equals(request.getType())) {
            new LanguagePracticePublicationValidator().requirePublishable(request);
            return;
        }
        if(isManagedCertificate(request) && !issues(request).isEmpty())
            throw new AppException(ErrorCode.VALIDATION_FAILED,"Đề chưa đủ dữ liệu hợp lệ để xuất bản hoặc đóng gói.");
    }

    public List<Issue> issues(ExamBuilderRequest request) {
        if (request != null && "NLTV".equals(request.getType())) {
            return new NltvPublicationValidator().issues(request);
        }
        if (request != null && "LANGUAGE_PRACTICE".equals(request.getType())) {
            return new LanguagePracticePublicationValidator().issues(request);
        }
        if (request == null || !"TOEIC_LR".equals(request.getType())) return List.of();
        List<Issue> issues=new ArrayList<>(); Set<Integer> partNumbers=new HashSet<>();Set<String> questionIds=new HashSet<>(),groupIds=new HashSet<>();
        if(request.getSections()==null || request.getSections().isEmpty()) {add(issues,"STRUCTURE_INVALID",null,"Thiếu section.");return issues;}
        for(var section:request.getSections()) {
            if (section == null) { add(issues,"STRUCTURE_INVALID",null,"Section không hợp lệ."); continue; }
            if(section.getDurationMinutes()==null || section.getDurationMinutes()<=0) add(issues,"DURATION_INVALID",null,"Thời lượng chưa hợp lệ.");
            if(section.getParts()==null || section.getParts().isEmpty()) {add(issues,"STRUCTURE_INVALID",null,"Thiếu Part.");continue;}
            for(var part:section.getParts()) {
                if (part == null) { add(issues,"STRUCTURE_INVALID",null,"Part không hợp lệ."); continue; }
                Integer number=part.getPartNumber();Map<String,Object> data=part.getContentData();
                if(number==null || number<1 || number>7 || !partNumbers.add(number) || data==null) {add(issues,"STRUCTURE_INVALID",null,"Part không hợp lệ.");continue;}
                if(!Objects.equals(section.getSkillType(),number<=4?"LISTENING":"READING")) add(issues,"SKILL_INVALID",null,"Skill không khớp Part.");
                boolean markers="ETS_2024_TEMPLATE_44".equals(data.get("import_profile"));
                checkMedia(data,issues,null);
                Object rawGroups=data.get("question_groups");
                if(!(rawGroups instanceof List<?> groups) || groups.isEmpty()) {add(issues,"STRUCTURE_INVALID",null,"Thiếu nhóm câu hỏi.");continue;}
                boolean hasAudio=validMedia(data.get("shared_audio"));
                for(Object raw:groups) {
                    if(!(raw instanceof Map<?,?> group)) {add(issues,"STRUCTURE_INVALID",null,"Nhóm câu hỏi không hợp lệ.");continue;}
                    if(!(group.get("group_id") instanceof String gid) || gid.isBlank() || !groupIds.add(gid)) add(issues,"ID_INVALID",null,"Group ID thiếu hoặc trùng.");
                    checkMedia(group,issues,null);
                    if(number<=4 && !hasAudio && !validMedia(group.get("shared_audio"))) add(issues,"AUDIO_REQUIRED",null,"Part nghe thiếu audio.");
                    if(number>=6 && blank(group.get("content_html")) && blank(data.get("content_html"))) add(issues,"CONTEXT_REQUIRED",null,"Part đọc thiếu nội dung nhóm.");
                    if(markers && (marker(group.get("content_html")) || marker(group.get("instruction")))) add(issues,"SOURCE_PLACEHOLDER",null,"Nội dung nhóm còn giá trị mẫu.");
                    if(!(group.get("questions") instanceof List<?> qs) || qs.isEmpty()) {add(issues,"STRUCTURE_INVALID",null,"Nhóm thiếu câu hỏi.");continue;}
                    for(Object q:qs) {
                        if(!(q instanceof Map<?,?> question)) {add(issues,"STRUCTURE_INVALID",null,"Câu hỏi không hợp lệ.");continue;}
                        String id=question.get("question_id") instanceof String s?s:null;
                        if(id==null || id.isBlank() || !questionIds.add(id)) add(issues,"ID_INVALID",id,"Question ID thiếu hoặc trùng.");
                        if(blank(question.get("question_text"))) add(issues,"PROMPT_REQUIRED",id,"Thiếu câu hỏi.");
                        checkMedia(question,issues,id);
                        if(number==1 && !validMedia(question.get("media")) && !validMedia(group.get("shared_media"))) add(issues,"IMAGE_REQUIRED",id,"Part 1 thiếu hình ảnh.");
                        Set<Object> optionIds=new HashSet<>();boolean optionsValid=true;
                        if(question.get("options") instanceof List<?> options) {
                            if(options.size()!=(number==2?3:4)) optionsValid=false;
                            for(Object o:options) if(o instanceof Map<?,?> option) {
                                if(!(option.get("id") instanceof String oid) || !oid.matches("[A-D]") || !optionIds.add(oid) || !(option.get("text") instanceof String)) optionsValid=false;
                                if(number>=3 && blank(option.get("text"))) optionsValid=false;
                                if(markers && marker(option.get("text"))) optionsValid=false;
                            } else optionsValid=false;
                        } else optionsValid=false;
                        if(!optionsValid) add(issues,"OPTIONS_INVALID",id,"Lựa chọn chưa hợp lệ.");
                        if (!optionIds.equals(number == 2 ? Set.of("A","B","C") : Set.of("A","B","C","D")))
                            add(issues,"OPTIONS_INVALID",id,"Option ID phải khớp nhãn lựa chọn của Part.");
                        if(!"SINGLE_CHOICE".equals(question.get("type")) || !optionIds.contains(question.get("correct_answer"))) add(issues,"ANSWER_INVALID",id,"Loại câu hoặc đáp án chưa hợp lệ.");
                        if(blank(question.get("explanation")) || markers && marker(question.get("explanation"))) add(issues,"EXPLANATION_REQUIRED",id,"Giải thích chưa được hoàn thiện.");
                    }
                }
            }
        }
        return List.copyOf(issues);
    }
    private static boolean isManagedCertificate(ExamBuilderRequest request) {
        return request != null && "TOEIC_LR".equals(request.getType());
    }
    private static boolean blank(Object value) {return !(value instanceof String s) || s.isBlank();}
    private static boolean marker(Object value) {return value instanceof String s && s.trim().equals("44");}
    private static boolean validMedia(Object value) {return value instanceof Map<?,?> map && ExcelV2ExamParser.safeUrl(map.get("url"));}
    private static void checkMedia(Map<?,?> data,List<Issue> issues,String id) {
        for(String key:List.of("shared_audio","shared_media","media")) if(data.get(key)!=null && !validMedia(data.get(key))) add(issues,"MEDIA_INVALID",id,"Media chưa hợp lệ.");
        if(data.get("shared_images") instanceof List<?> images && images.stream().anyMatch(v->!ExcelV2ExamParser.safeUrl(v))) add(issues,"MEDIA_INVALID",id,"Media chưa hợp lệ.");
    }
    private static void add(List<Issue> issues,String code,String id,String message) {issues.add(new Issue(code,null,null,id,message));}
}
