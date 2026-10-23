package com.multilingo.backend.modules.exam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import java.util.*;

/** Canonical request projection at the builder persistence boundary. */
public final class ExamContentNormalizer {
    private final ObjectMapper mapper = new ObjectMapper();

    private static final Set<String> CANONICAL_QUESTION_TYPES = Set.of(
            "SINGLE_CHOICE", "MULTIPLE_CHOICE", "FILL_IN_THE_BLANK",
            "TRUE_FALSE_NOT_GIVEN", "YES_NO_NOT_GIVEN", "MATCHING_FEATURES",
            "MATCHING_INFORMATION", "ESSAY"
    );

    public ExamBuilderRequest normalize(ExamBuilderRequest source) {
        if (source == null) return null;
        String type = source.getType();
        boolean toeic = "TOEIC_LR".equals(type);
        boolean ielts = "IELTS_ACADEMIC".equals(type);
        boolean languagePractice = "LANGUAGE_PRACTICE".equals(type);
        boolean nltv = "NLTV".equals(type);
        if (!toeic && !ielts && !languagePractice && !nltv) return source;

        ExamBuilderRequest result=mapper.convertValue(source,ExamBuilderRequest.class);
        if (languagePractice) {
            new com.multilingo.backend.common.i18n.LearningLanguageCatalog()
                    .findNormalized(result.getExamLanguage())
                    .ifPresent(result::setExamLanguage);
        }
        if(toeic && "ENGLISH".equalsIgnoreCase(result.getExamLanguage())) result.setExamLanguage("en");
        if(result.getSections()==null) return result;
        for(var section:result.getSections()) if(section.getParts()!=null) for(var part:section.getParts()) {
            Map<String,Object> data=part.getContentData(); if(data==null) continue;
            if(!data.containsKey("content_html") && data.containsKey("shared_content_html")) data.put("content_html",data.get("shared_content_html"));
            data.remove("shared_content_html");
            Object groups=data.get("question_groups");
            if(groups instanceof List<?> list) for(Object raw:list) if(raw instanceof Map<?,?> g) {
                Map<String,Object> group=(Map<String,Object>)g;
                if(!group.containsKey("shared_media") && group.get("shared_images") instanceof List<?> images && !images.isEmpty())
                    group.put("shared_media",Map.of("type","image","url",images.get(0)));
                Object qs=group.get("questions");
                if(qs instanceof List<?> questions) for(Object q:questions) if(q instanceof Map<?,?> map)
                    normalizeQuestion((Map<String,Object>)map, toeic, nltv);
            }
        }
        return result;
    }

    private void normalizeQuestion(Map<String,Object> question, boolean normalizeLegacyToeicType, boolean normalizeNltvType) {
        Object rawMetadata=question.remove("metadata");
        boolean legacy=rawMetadata instanceof Map<?,?>;
        Map<?,?> metadata=legacy?(Map<?,?>)rawMetadata:Map.of();
        for(String field:List.of("options","correct_answer","alternates","explanation","media","answer_group"))
            if(!question.containsKey(field) && metadata.containsKey(field)) question.put(field,metadata.get(field));
        Object rawType = question.get("type");
        if (rawType instanceof String strType) {
            String trimmed = strType.trim();
            if ("WRITING_ESSAY".equalsIgnoreCase(trimmed)) {
                question.put("type", "ESSAY");
            } else if ("MULTIPLE_CHOICE_MULTI".equalsIgnoreCase(trimmed)) {
                question.put("type", "MULTIPLE_CHOICE");
            } else {
                String upper = trimmed.toUpperCase(Locale.ROOT);
                if (CANONICAL_QUESTION_TYPES.contains(upper)) {
                    question.put("type", upper);
                } else {
                    question.put("type", trimmed);
                }
            }
        }
        if (normalizeNltvType && "MULTIPLE_CHOICE".equals(question.get("type"))) question.put("type", "SINGLE_CHOICE");
        if(normalizeLegacyToeicType && legacy && "MULTIPLE_CHOICE".equals(question.get("type"))) question.put("type","SINGLE_CHOICE");
        if(normalizeLegacyToeicType && legacy && "MULTIPLE_CHOICE_MULTI".equals(question.get("type"))) question.put("type","MULTIPLE_CHOICE");
        Object rawOptions=question.get("options");
        if(!(rawOptions instanceof List<?> options)) return;
        List<Map<String,Object>> canonical=new ArrayList<>();
        for(int i=0;i<options.size();i++) {
            Object option=options.get(i);
            if(option instanceof String text) canonical.add(Map.of("id",String.valueOf((char)('A'+i)),"text",text));
            else if(option instanceof Map<?,?> map) canonical.add(new LinkedHashMap<>((Map<String,Object>)map));
        }
        question.put("options",canonical);
        if(normalizeLegacyToeicType && legacy && "SINGLE_CHOICE".equals(question.get("type"))) {
            Object index=metadata.get("correct_option_index");
            if(index instanceof Number n && n.doubleValue()==n.intValue() && n.intValue()>=0 && n.intValue()<canonical.size()) {
                question.put("correct_answer",canonical.get(n.intValue()).get("id"));
            } else question.put("correct_answer",optionId(canonical,question.get("correct_answer")));
        } else if(normalizeLegacyToeicType && legacy && "MULTIPLE_CHOICE".equals(question.get("type"))) {
            if(metadata.get("correct_option_indices") instanceof List<?> indices && !indices.isEmpty()) {
                List<Object> answer=new ArrayList<>();
                for(Object raw:indices) if(raw instanceof Number n && n.doubleValue()==n.intValue() && n.intValue()>=0 && n.intValue()<canonical.size()) answer.add(canonical.get(n.intValue()).get("id"));
                question.put("correct_answer",answer);
            } else if(question.get("correct_answer") instanceof List<?> answers)
                question.put("correct_answer",answers.stream().map(a->optionId(canonical,a)).toList());
        }
    }
    private Object optionId(List<Map<String,Object>> options,Object answer) {
        if(options.stream().anyMatch(o->Objects.equals(o.get("id"),answer))) return answer;
        List<Map<String,Object>> matches=options.stream().filter(o->Objects.equals(o.get("text"),answer)).toList();
        return matches.size()==1?matches.get(0).get("id"):answer;
    }
}
