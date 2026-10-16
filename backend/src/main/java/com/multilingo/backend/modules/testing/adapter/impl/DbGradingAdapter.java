package com.multilingo.backend.modules.testing.adapter.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.entity.ExamPart;
import com.multilingo.backend.modules.exam.entity.ExamSection;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamSectionRepository;
import com.multilingo.backend.modules.testing.adapter.GradingAdapter;
import com.multilingo.backend.modules.testing.grading.dto.GradingKey;
import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Component
@Primary
@RequiredArgsConstructor
public class DbGradingAdapter implements GradingAdapter {

    private final ExamRepository examRepository;
    private final ExamSectionRepository examSectionRepository;
    private final ExamPartRepository examPartRepository;
    private final ObjectMapper objectMapper;

    @SuppressWarnings("unchecked")
    @Override
    public Map<Integer, PartGradingKey> loadPartKeys(Integer examId) {
        Map<Integer, PartGradingKey> partKeys = new HashMap<>();

        Optional<Exam> examOpt = examRepository.findById(examId);
        if (examOpt.isEmpty()) {
            return partKeys;
        }

        Exam exam = examOpt.get();
        List<ExamSection> sections = examSectionRepository.findByExam_Id(exam.getId());

        sections.forEach(section -> {
            List<ExamPart> parts = examPartRepository.findBySection_Id(section.getId());
            
            parts.forEach(part -> {
                PartGradingKey partGradingKey = new PartGradingKey();
                partGradingKey.setPartId(part.getId());
                partGradingKey.setSectionName(section.getSkillType());
                
                Map<String, GradingKey> answers = new HashMap<>();
                Set<String> seenQuestionIds = new HashSet<>();
                
                Map<String, Object> data = part.getContentData();
                if (data != null) {
                    for (Map<String, Object> question : extractQuestions(data)) {
                        addGradingKey(answers, seenQuestionIds, question);
                    }
                }
                
                partGradingKey.setAnswers(answers);
                partKeys.put(part.getId(), partGradingKey);
            });
        });

        return partKeys;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> extractQuestions(Map<String, Object> data) {
        List<Map<String, Object>> questions = new ArrayList<>();
        if (data.containsKey("question_groups")) {
            Object rawGroups = data.get("question_groups");
            if (!(rawGroups instanceof List<?> groups) || groups.isEmpty()) {
                throw new IllegalArgumentException("question_groups must be a non-empty array");
            }
            for (Object rawGroup : groups) {
                if (!(rawGroup instanceof Map<?, ?> group)) {
                    throw new IllegalArgumentException("question group must be an object");
                }
                Object rawQuestions = group.get("questions");
                if (!(rawQuestions instanceof List<?> groupQuestions) || groupQuestions.isEmpty()) {
                    throw new IllegalArgumentException("question group questions must be a non-empty array");
                }
                for (Object rawQuestion : groupQuestions) {
                    if (!(rawQuestion instanceof Map<?, ?> question)) {
                        throw new IllegalArgumentException("question group questions must contain objects");
                    }
                    validateCanonicalQuestion(question);
                    Map<String, Object> questionMap = (Map<String, Object>) question;
                    if (!questionMap.containsKey("options")) {
                        if (group.containsKey("options")) {
                            questionMap = new LinkedHashMap<>(questionMap);
                            questionMap.put("options", group.get("options"));
                        } else if (questionMap.get("metadata") instanceof Map<?, ?> mm && mm.containsKey("options")) {
                            questionMap = new LinkedHashMap<>(questionMap);
                            questionMap.put("options", mm.get("options"));
                        }
                    }
                    questions.add(questionMap);
                }
            }
            return questions;
        }

        Object rawQuestions = data.get("questions");
        if (rawQuestions instanceof List<?> legacyQuestions) {
            for (Object rawQuestion : legacyQuestions) {
                if (rawQuestion instanceof Map<?, ?> question) {
                    questions.add((Map<String, Object>) question);
                }
            }
        }
        return questions;
    }

    private void validateCanonicalQuestion(Map<?, ?> question) {
        Object questionId = question.get("question_id");
        if (!(questionId instanceof String id) || id.isBlank()) {
            throw new IllegalArgumentException("canonical question_id must be a non-blank string");
        }

        Object type = question.get("type");
        if (!(type instanceof String typeName) || typeName.isBlank()) {
            throw new IllegalArgumentException("canonical question type must be a non-blank string");
        }
    }

    @SuppressWarnings("unchecked")
    private void addGradingKey(Map<String, GradingKey> answers, Set<String> seenQuestionIds,
                               Map<String, Object> question) {
        Object rawQuestionId = question.get("question_id");
        if (rawQuestionId == null) rawQuestionId = question.get("questionId");
        if (rawQuestionId == null) rawQuestionId = question.get("id");
        String questionId = rawQuestionId != null ? rawQuestionId.toString().trim() : null;

        Object rawType = question.get("type");
        if (rawType == null) rawType = question.get("questionType");
        if (rawType == null) rawType = question.get("question_type");
        String type = rawType != null ? rawType.toString().trim() : null;

        if (questionId != null && !seenQuestionIds.add(questionId)) {
            throw new IllegalArgumentException("Duplicate question_id within part: " + questionId);
        }
        if (questionId == null || type == null || "ESSAY".equalsIgnoreCase(type)) {
            return;
        }

        Map<String, Object> metadata = question.get("metadata") instanceof Map<?, ?> mm
                ? (Map<String, Object>) mm
                : null;

        Object correct = question.get("correct_answer");
        if (correct == null) correct = question.get("correctAnswer");

        List<String> alternates = new ArrayList<>();
        if (question.get("alternates") instanceof List<?> alts) {
            for (Object a : alts) {
                if (a != null && !a.toString().isBlank()) alternates.add(a.toString().trim());
            }
        }

        if ((correct == null || (correct instanceof String s && s.isBlank())) && metadata != null) {
            Object metaCorrect = metadata.get("correct_answer");
            if (metaCorrect == null) metaCorrect = metadata.get("correctAnswer");
            if (metaCorrect != null && (!(metaCorrect instanceof String s) || !s.isBlank())) {
                correct = metaCorrect;
            }
        }

        Object rawOptions = question.get("options");
        if (rawOptions == null && metadata != null) {
            rawOptions = metadata.get("options");
        }
        List<?> optionList = rawOptions instanceof List<?> list ? list : Collections.emptyList();

        if (metadata != null && metadata.containsKey("correct_option_index") && metadata.get("correct_option_index") instanceof Number num) {
            int idx = num.intValue();
            if (idx >= 0) {
                String letter = String.valueOf((char) ('A' + idx));
                String optionText = null;
                if (idx < optionList.size() && optionList.get(idx) != null) {
                    Object optItem = optionList.get(idx);
                    if (optItem instanceof Map<?, ?> optMap) {
                        Object textVal = optMap.get("text");
                        if (textVal != null) optionText = textVal.toString().trim();
                    } else if (!optItem.toString().isBlank()) {
                        optionText = optItem.toString().trim();
                    }
                }

                if (correct == null || (correct instanceof String s && s.isBlank())) {
                    if (optionText != null && !optionText.isBlank()) {
                        correct = optionText;
                        alternates.add(letter);
                    } else {
                        correct = letter;
                    }
                } else {
                    if (!letter.equalsIgnoreCase(correct.toString().trim())) {
                        alternates.add(letter);
                    }
                    if (optionText != null && !optionText.isBlank() && !optionText.equalsIgnoreCase(correct.toString().trim())) {
                        alternates.add(optionText);
                    }
                }
            }
        }

        if (metadata != null && metadata.containsKey("correct_option_indices") && metadata.get("correct_option_indices") instanceof List<?> idxList) {
            List<String> letters = new ArrayList<>();
            List<String> texts = new ArrayList<>();
            for (Object o : idxList) {
                if (o instanceof Number num) {
                    int idx = num.intValue();
                    if (idx >= 0) {
                        String letter = String.valueOf((char) ('A' + idx));
                        letters.add(letter);
                        if (idx < optionList.size() && optionList.get(idx) != null) {
                            String t = optionList.get(idx).toString().trim();
                            if (!t.isBlank()) texts.add(t);
                        }
                    }
                }
            }
            if (!letters.isEmpty()) {
                if (correct == null || (correct instanceof String s && s.isBlank()) || (correct instanceof Collection<?> c && c.isEmpty())) {
                    correct = letters;
                    if (!texts.isEmpty()) {
                        alternates.addAll(texts);
                    }
                } else {
                    alternates.addAll(letters);
                    alternates.addAll(texts);
                }
            }
        }

        if (metadata != null && metadata.get("alternates") instanceof List<?> metaAlts) {
            for (Object a : metaAlts) {
                if (a != null && !a.toString().isBlank()) alternates.add(a.toString().trim());
            }
        }

        if (correct == null || (correct instanceof String s && s.isBlank())) {
            return;
        }

        GradingKey key = new GradingKey();
        key.setQuestionId(questionId);
        key.setType(type);
        key.setCorrect(correct);
        if (!alternates.isEmpty()) {
            key.setAlternates(alternates);
        }

        if ("MATCHING_HEADINGS".equalsIgnoreCase(type)) {
            resolveMatchingHeadingsOptions(key, question);
        }

        answers.put(questionId, key);
    }

    @SuppressWarnings("unchecked")
    private void resolveMatchingHeadingsOptions(GradingKey key, Map<String, Object> question) {
        Object rawOptions = question.get("options");
        if (!(rawOptions instanceof List<?> optionList) || optionList.isEmpty()) {
            return;
        }

        List<String> alternates = key.getAlternates();
        List<String> updatedAlternates = (alternates != null) ? new ArrayList<>(alternates) : new ArrayList<>();

        Object correctObj = key.getCorrect();

        for (Object rawOpt : optionList) {
            if (!(rawOpt instanceof Map<?, ?> optMap)) {
                continue;
            }
            Object idObj = optMap.get("id");
            Object textObj = optMap.get("text");
            if (idObj == null || textObj == null) {
                continue;
            }
            String optId = idObj.toString().trim();
            String optText = textObj.toString().trim();
            if (optId.isEmpty() || optText.isEmpty()) {
                continue;
            }

            boolean isMatch = false;

            if (correctObj instanceof String correctStr) {
                if (matchesText(optText, correctStr) || matchesText(optId, correctStr)) {
                    isMatch = true;
                }
            } else if (correctObj instanceof Collection<?> coll) {
                for (Object item : coll) {
                    if (item != null && (matchesText(optText, item.toString()) || matchesText(optId, item.toString()))) {
                        isMatch = true;
                        break;
                    }
                }
            }

            if (!isMatch && alternates != null) {
                for (String alt : alternates) {
                    if (alt != null && (matchesText(optText, alt) || matchesText(optId, alt))) {
                        isMatch = true;
                        break;
                    }
                }
            }

            if (isMatch) {
                if (!updatedAlternates.contains(optId) && !containsNormalized(correctObj, optId)) {
                    updatedAlternates.add(optId);
                }
                if (!updatedAlternates.contains(optText) && !containsNormalized(correctObj, optText)) {
                    updatedAlternates.add(optText);
                }
            }
        }

        if (!updatedAlternates.isEmpty()) {
            key.setAlternates(updatedAlternates);
        }
    }

    private boolean containsNormalized(Object correctObj, String target) {
        if (correctObj instanceof String s) {
            return matchesText(s, target);
        }
        if (correctObj instanceof Collection<?> coll) {
            for (Object item : coll) {
                if (item != null && matchesText(item.toString(), target)) {
                    return true;
                }
            }
        }
        return false;
    }

    private boolean matchesText(String s1, String s2) {
        if (s1 == null || s2 == null) {
            return false;
        }
        String n1 = s1.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        String n2 = s2.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        return n1.equals(n2);
    }
}
