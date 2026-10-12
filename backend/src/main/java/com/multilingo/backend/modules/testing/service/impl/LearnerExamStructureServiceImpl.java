package com.multilingo.backend.modules.testing.service.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.entity.ExamPart;
import com.multilingo.backend.modules.exam.entity.ExamSection;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamSectionRepository;
import com.multilingo.backend.modules.testing.dto.response.LearnerExamStructureResponse;
import com.multilingo.backend.modules.testing.service.LearnerExamStructureService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class LearnerExamStructureServiceImpl implements LearnerExamStructureService {

    private final ExamRepository examRepository;
    private final ExamSectionRepository sectionRepository;
    private final ExamPartRepository partRepository;

    @Override
    public LearnerExamStructureResponse getPublishedExamStructure(Integer examId) {
        Exam exam = examRepository.findById(examId)
                .filter(candidate -> Boolean.TRUE.equals(candidate.getIsPublished()))
                .orElseThrow(() -> new AppException(ErrorCode.EXAM_NOT_FOUND));

        List<LearnerExamStructureResponse.Section> sections = sectionRepository.findByExam_Id(exam.getId()).stream()
                .sorted(Comparator.comparing(ExamSection::getOrderIndex, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(ExamSection::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(this::toSection)
                .toList();

        return LearnerExamStructureResponse.builder()
                .id(exam.getId())
                .code(exam.getCode())
                .title(exam.getTitle())
                .type(exam.getType())
                .durationMinutes(exam.getDurationMinutes())
                .sections(sections)
                .build();
    }

    private LearnerExamStructureResponse.Section toSection(ExamSection section) {
        List<LearnerExamStructureResponse.Part> parts = partRepository.findBySection_Id(section.getId()).stream()
                .sorted(Comparator.comparing(ExamPart::getPartNumber, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(ExamPart::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(this::toPart)
                .toList();

        return LearnerExamStructureResponse.Section.builder()
                .id(section.getId())
                .skillType(section.getSkillType())
                .title(section.getTitle())
                .durationMinutes(section.getDurationMinutes())
                .orderIndex(section.getOrderIndex())
                .parts(parts)
                .build();
    }

    private LearnerExamStructureResponse.Part toPart(ExamPart part) {
        String title = null;
        if (part.getContentData() != null) {
            Object partTitle = part.getContentData().get("part_title");
            if (partTitle instanceof String) {
                title = (String) partTitle;
            } else {
                Object legacyTitle = part.getContentData().get("title");
                if (legacyTitle instanceof String) {
                    title = (String) legacyTitle;
                }
            }
        }
        return LearnerExamStructureResponse.Part.builder()
                .id(part.getId())
                .partNumber(part.getPartNumber())
                .title(title)
                .build();
    }
}
