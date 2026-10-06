package com.multilingo.backend.modules.testing.adapter.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.entity.ExamPart;
import com.multilingo.backend.modules.exam.entity.ExamSection;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamSectionRepository;
import com.multilingo.backend.modules.testing.adapter.ExamAdapter;
import com.multilingo.backend.modules.testing.adapter.dto.ExamFixture;
import com.multilingo.backend.modules.testing.adapter.dto.PartFixture;
import com.multilingo.backend.modules.testing.adapter.dto.SectionFixture;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@Primary
@RequiredArgsConstructor
public class DbExamAdapter implements ExamAdapter {

    private final ExamRepository examRepository;
    private final ExamSectionRepository examSectionRepository;
    private final ExamPartRepository examPartRepository;
    private final ObjectMapper objectMapper;

    @Override
    public Optional<ExamFixture> findById(Integer examId) {
        return examRepository.findById(examId).map(this::mapToFixture);
    }

    @SuppressWarnings("unchecked")
    private ExamFixture mapToFixture(Exam exam) {
        ExamFixture fixture = new ExamFixture();
        fixture.setId(exam.getId());
        fixture.setTitle(exam.getTitle());
        fixture.setDurationMinutes(exam.getDurationMinutes());

        List<ExamSection> entitySections = examSectionRepository.findByExam_Id(exam.getId());

        List<SectionFixture> sections = entitySections.stream()
                .map(section -> {
                    SectionFixture sFixture = new SectionFixture();
                    sFixture.setId(section.getId());
                    sFixture.setName(section.getSkillType());
                    sFixture.setDurationMinutes(section.getDurationMinutes());

                    List<ExamPart> entityParts = examPartRepository.findBySection_Id(section.getId());

                    List<PartFixture> parts = entityParts.stream()
                            .map(part -> {
                                PartFixture pFixture = new PartFixture();
                                pFixture.setId(part.getId());
                                
                                Map<String, Object> data = part.getContentData();
                                if (data != null) {
                                    if (data.containsKey("title")) {
                                        pFixture.setTitle(data.get("title").toString());
                                    }
                                    if (data.containsKey("instruction")) {
                                        pFixture.setInstruction(data.get("instruction").toString());
                                    }
                                    if (data.containsKey("questions")) {
                                        List<Map<String, Object>> rawQuestions = (List<Map<String, Object>>) data.get("questions");
                                        
                                        List<Object> strippedQuestions = rawQuestions.stream().map(q -> {
                                            Map<String, Object> copy = objectMapper.convertValue(q, Map.class);
                                            copy.remove("correct_answer");
                                            copy.remove("explanation");
                                            return (Object) copy;
                                        }).collect(Collectors.toList());
                                        pFixture.setQuestions(strippedQuestions);
                                    }
                                }
                                return pFixture;
                            })
                            .collect(Collectors.toList());

                    sFixture.setParts(parts);
                    return sFixture;
                })
                .collect(Collectors.toList());

        fixture.setSections(sections);
        return fixture;
    }
}
