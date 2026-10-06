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
import java.util.List;
import java.util.Map;
import java.util.Optional;

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
                
                Map<String, Object> data = part.getContentData();
                if (data != null && data.containsKey("questions")) {
                    List<Map<String, Object>> questions = (List<Map<String, Object>>) data.get("questions");
                    
                    for (Map<String, Object> q : questions) {
                        String questionId = (String) q.get("question_id");
                        if (questionId == null || !q.containsKey("correct_answer")) {
                            continue;
                        }

                        GradingKey key = new GradingKey();
                        key.setQuestionId(questionId);
                        key.setType((String) q.get("type"));
                        key.setCorrect(q.get("correct_answer"));
                        
                        if (q.containsKey("alternates")) {
                            List<String> alts = (List<String>) q.get("alternates");
                            key.setAlternates(alts);
                        }
                        
                        answers.put(questionId, key);
                    }
                }
                
                partGradingKey.setAnswers(answers);
                partKeys.put(part.getId(), partGradingKey);
            });
        });

        return partKeys;
    }
}
