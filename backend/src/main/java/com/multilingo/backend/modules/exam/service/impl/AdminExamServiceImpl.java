package com.multilingo.backend.modules.exam.service.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import com.multilingo.backend.modules.exam.dto.request.PartBuilderRequest;
import com.multilingo.backend.modules.exam.dto.request.SectionBuilderRequest;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.entity.ExamPart;
import com.multilingo.backend.modules.exam.entity.ExamSection;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamSectionRepository;
import com.multilingo.backend.modules.exam.service.AdminExamService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class AdminExamServiceImpl implements AdminExamService {

    private final ExamRepository examRepository;
    private final ExamSectionRepository sectionRepository;
    private final ExamPartRepository partRepository;

    public AdminExamServiceImpl(ExamRepository examRepository, ExamSectionRepository sectionRepository, ExamPartRepository partRepository) {
        this.examRepository = examRepository;
        this.sectionRepository = sectionRepository;
        this.partRepository = partRepository;
    }

    @Override
    public Integer createExam(ExamBuilderRequest request) {
        Exam exam = new Exam();
        
        // Generate a shorter, human-readable code: e.g. IELTS-A8B9C2
        String prefix = request.getType().split("_")[0].toUpperCase();
        String shortCode = java.util.UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        exam.setCode(prefix + "-" + shortCode);
        
        exam.setTitle(request.getTitle());
        exam.setType(request.getType());
        exam.setExamLanguage(request.getExamLanguage());
        exam.setIsPublished(request.isPublished());
        exam = examRepository.save(exam);

        saveSectionsAndParts(exam, request.getSections());

        return exam.getId();
    }

    @Override
    public void updateExam(Integer id, ExamBuilderRequest request) {
        Exam exam = examRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.EXAM_NOT_FOUND));

        List<Integer> sectionIds = sectionRepository.findByExam_Id(id).stream().map(ExamSection::getId).toList();
        if (!sectionIds.isEmpty()) {
            partRepository.deleteBySection_IdIn(sectionIds);
            sectionRepository.deleteByExam_Id(id);
        }

        exam.setTitle(request.getTitle());
        exam.setType(request.getType());
        exam.setExamLanguage(request.getExamLanguage());
        exam.setIsPublished(request.isPublished());
        examRepository.save(exam);

        saveSectionsAndParts(exam, request.getSections());
    }

    @Override
    public void deleteExam(Integer id) {
        if (!examRepository.existsById(id)) {
            throw new AppException(ErrorCode.EXAM_NOT_FOUND);
        }
        
        List<Integer> sectionIds = sectionRepository.findByExam_Id(id).stream().map(ExamSection::getId).toList();
        if (!sectionIds.isEmpty()) {
            partRepository.deleteBySection_IdIn(sectionIds);
            sectionRepository.deleteByExam_Id(id);
        }
        
        examRepository.deleteById(id);
    }

    private void saveSectionsAndParts(Exam exam, List<SectionBuilderRequest> sectionRequests) {
        if (sectionRequests == null) return;
        
        for (int i = 0; i < sectionRequests.size(); i++) {
            SectionBuilderRequest sectionReq = sectionRequests.get(i);
            
            ExamSection section = new ExamSection();
            section.setExam(exam);
            section.setSkillType(sectionReq.getSkillType());
            section.setTitle(sectionReq.getSkillType() + " Section");
            section.setDurationMinutes(sectionReq.getDurationMinutes());
            section = sectionRepository.save(section);

            if (sectionReq.getParts() != null) {
                for (PartBuilderRequest partReq : sectionReq.getParts()) {
                    ExamPart part = new ExamPart();
                    part.setSection(section);
                    part.setPartNumber(partReq.getPartNumber());
                    part.setContentData(partReq.getContentData());
                    partRepository.save(part);
                }
            }
        }
    }

    @Override
    public List<com.multilingo.backend.modules.exam.dto.response.ExamSummaryResponse> getAllExams() {
        return examRepository.findAll().stream().map(exam -> {
            com.multilingo.backend.modules.exam.dto.response.ExamSummaryResponse resp = new com.multilingo.backend.modules.exam.dto.response.ExamSummaryResponse();
            resp.setId(exam.getId());
            resp.setCode(exam.getCode());
            resp.setTitle(exam.getTitle());
            resp.setType(exam.getType());
            resp.setIsPublished(exam.getIsPublished());
            resp.setDurationMinutes(exam.getDurationMinutes());
            resp.setUpdatedAt(exam.getUpdatedAt());
            
            // Basic counts for now
            List<ExamSection> sections = sectionRepository.findByExam_Id(exam.getId());
            int partsCount = 0;
            for (ExamSection s : sections) {
                partsCount += partRepository.findBySection_Id(s.getId()).size();
            }
            resp.setParts(partsCount);
            resp.setQuestions(0); // Complex to calculate from JSONB, leave 0 or approximate
            resp.setJoins(0);
            
            return resp;
        }).toList();
    }

    @Override
    public ExamBuilderRequest getExamDetail(Integer id) {
        Exam exam = examRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.EXAM_NOT_FOUND));

        List<SectionBuilderRequest> sectionRequests = sectionRepository.findByExam_Id(id).stream()
                .map(section -> {
                    List<PartBuilderRequest> partRequests = partRepository.findBySection_Id(section.getId()).stream()
                            .map(part -> PartBuilderRequest.builder()
                                    .partNumber(part.getPartNumber())
                                    .contentData(part.getContentData())
                                    .build())
                            .toList();

                    return SectionBuilderRequest.builder()
                            .skillType(section.getSkillType())
                            .durationMinutes(section.getDurationMinutes())
                            .parts(partRequests)
                            .build();
                })
                .toList();

        return ExamBuilderRequest.builder()
                .title(exam.getTitle())
                .type(exam.getType())
                .examLanguage(exam.getExamLanguage())
                .isPublished(exam.getIsPublished())
                .sections(sectionRequests)
                .build();
    }

    @Override
    public void updateExamStatus(Integer id, boolean isPublished) {
        Exam exam = examRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.EXAM_NOT_FOUND));
        exam.setIsPublished(isPublished);
        examRepository.save(exam);
    }
}
