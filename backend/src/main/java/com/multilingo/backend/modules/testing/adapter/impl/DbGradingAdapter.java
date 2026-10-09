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

import java.util.HashMap;
import java.util.HashSet;
import java.util.ArrayList;
import java.util.List;
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
                    questions.add((Map<String, Object>) question);
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
        String questionId = (String) question.get("question_id");
        String type = (String) question.get("type");
        if (questionId != null && !seenQuestionIds.add(questionId)) {
            throw new IllegalArgumentException("Duplicate question_id within part: " + questionId);
        }
        if (questionId == null || !question.containsKey("correct_answer") || "ESSAY".equals(type)) {
            return;
        }

        GradingKey key = new GradingKey();
        key.setQuestionId(questionId);
        key.setType(type);
        key.setCorrect(question.get("correct_answer"));

        if (question.containsKey("alternates")) {
            key.setAlternates((List<String>) question.get("alternates"));
        }

        answers.put(questionId, key);
    }
}
