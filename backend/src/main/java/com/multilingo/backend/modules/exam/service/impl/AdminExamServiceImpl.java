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
import com.multilingo.backend.modules.exam.service.ExamContentNormalizer;
import com.multilingo.backend.modules.exam.service.ExamPublicationValidator;
import com.multilingo.backend.modules.exam.service.IeltsAcademicPublicationValidator;
import com.multilingo.backend.modules.exam.service.OfficialExamDatasetRegistry;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@Transactional
public class AdminExamServiceImpl implements AdminExamService {

    private final ExamRepository examRepository;
    private final ExamSectionRepository sectionRepository;
    private final ExamPartRepository partRepository;
    private final TestAttemptRepository testAttemptRepository;

    public AdminExamServiceImpl(ExamRepository examRepository,
                                ExamSectionRepository sectionRepository,
                                ExamPartRepository partRepository) {
        this(examRepository, sectionRepository, partRepository, null);
    }

    @Autowired
    public AdminExamServiceImpl(ExamRepository examRepository,
                                ExamSectionRepository sectionRepository,
                                ExamPartRepository partRepository,
                                TestAttemptRepository testAttemptRepository) {
        this.examRepository = examRepository;
        this.sectionRepository = sectionRepository;
        this.partRepository = partRepository;
        this.testAttemptRepository = testAttemptRepository;
    }

    @Override
    public Integer createExam(ExamBuilderRequest request) {
        String prefix = request.getType().split("_")[0].toUpperCase();
        String shortCode = java.util.UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        return createExamWithCode(request, prefix + "-" + shortCode);
    }

    @Override
    public Integer createExamWithCode(ExamBuilderRequest request, String code) {
        request = prepare(request, code);
        Exam exam = new Exam();
        
        // Generate a shorter, human-readable code: e.g. IELTS-A8B9C2
        exam.setCode(code);
        
        exam.setTitle(request.getTitle());
        exam.setType(request.getType());
        exam.setExamLanguage(request.getExamLanguage());
        exam.setIsPublished(request.isPublished());
        setDuration(exam, request);
        exam = examRepository.save(exam);

        saveSectionsAndParts(exam, request.getSections());

        return exam.getId();
    }

    @Override
    public void updateExam(Integer id, ExamBuilderRequest request) {
        Exam exam = examRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.EXAM_NOT_FOUND));
        request = prepare(request, exam.getCode());

        List<Integer> sectionIds = sectionRepository.findByExam_Id(id).stream().map(ExamSection::getId).toList();
        if (!sectionIds.isEmpty()) {
            partRepository.deleteBySection_IdIn(sectionIds);
            sectionRepository.deleteByExam_Id(id);
        }

        exam.setTitle(request.getTitle());
        exam.setType(request.getType());
        exam.setExamLanguage(request.getExamLanguage());
        exam.setIsPublished(request.isPublished());
        setDuration(exam, request);
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
            section.setOrderIndex(i + 1);
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
        Map<Integer, Long> attemptCountMap = getAttemptCountMap();

        return examRepository.findAll().stream().map(exam -> {
            com.multilingo.backend.modules.exam.dto.response.ExamSummaryResponse resp = new com.multilingo.backend.modules.exam.dto.response.ExamSummaryResponse();
            resp.setId(exam.getId());
            resp.setCode(exam.getCode());
            resp.setTitle(exam.getTitle());
            resp.setType(exam.getType());
            resp.setIsPublished(exam.getIsPublished());
            resp.setDurationMinutes(exam.getDurationMinutes());
            resp.setUpdatedAt(exam.getUpdatedAt());
            
            // Basic counts
            List<ExamSection> sections = sectionRepository.findByExam_Id(exam.getId());
            int partsCount = 0;
            int questionsCount = 0;
            for (ExamSection s : sections) {
                List<ExamPart> parts = partRepository.findBySection_Id(s.getId());
                partsCount += parts.size();
                for (ExamPart p : parts) {
                    questionsCount += countQuestionsInPart(p);
                }
            }
            resp.setParts(partsCount);
            resp.setQuestions(questionsCount);
            resp.setJoins(attemptCountMap.getOrDefault(exam.getId(), 0L).intValue());
            
            return resp;
        }).toList();
    }

    private Map<Integer, Long> getAttemptCountMap() {
        if (testAttemptRepository == null) {
            return Collections.emptyMap();
        }
        List<Object[]> counts = testAttemptRepository.countAttemptsGroupByExamId();
        if (counts == null || counts.isEmpty()) {
            return Collections.emptyMap();
        }
        return counts.stream()
                .filter(row -> row != null && row.length >= 2 && row[0] instanceof Integer && row[1] instanceof Number)
                .collect(Collectors.toMap(
                        row -> (Integer) row[0],
                        row -> ((Number) row[1]).longValue(),
                        (existing, replacement) -> existing
                ));
    }

    private int countQuestionsInPart(ExamPart part) {
        if (part == null || part.getContentData() == null) {
            return 0;
        }
        return countQuestionsInMap(part.getContentData());
    }

    private int countQuestionsInMap(Map<String, Object> map) {
        if (map == null) {
            return 0;
        }
        int count = 0;

        // Direct "questions" array
        Object directQuestions = map.get("questions");
        if (directQuestions instanceof List<?> list) {
            count += list.size();
        }

        // Inside "question_groups"
        Object questionGroups = map.get("question_groups");
        if (questionGroups instanceof List<?> groups) {
            for (Object gObj : groups) {
                if (gObj instanceof Map<?, ?> gMap) {
                    Object gQuestions = gMap.get("questions");
                    if (gQuestions instanceof List<?> qList) {
                        count += qList.size();
                    }
                }
            }
        }

        // Nested in "content" object if any
        Object nestedContent = map.get("content");
        if (nestedContent instanceof Map<?, ?> nestedMap) {
            @SuppressWarnings("unchecked")
            Map<String, Object> casted = (Map<String, Object>) nestedMap;
            count += countQuestionsInMap(casted);
        }

        return count;
    }

    @Override
    public ExamBuilderRequest getExamDetail(Integer id) {
        Exam exam = examRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.EXAM_NOT_FOUND));

        List<SectionBuilderRequest> sectionRequests = sectionRepository.findByExam_Id(id).stream()
                .sorted(java.util.Comparator.comparing(ExamSection::getOrderIndex).thenComparing(ExamSection::getId))
                .map(section -> {
                    List<PartBuilderRequest> partRequests = partRepository.findBySection_Id(section.getId()).stream()
                            .sorted(java.util.Comparator.comparing(ExamPart::getPartNumber))
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
        if (isPublished) {
            var original = getExamDetail(id);
            var canonical = new ExamContentNormalizer().normalize(original);
            requirePublishable(canonical, exam.getCode());
            if (("TOEIC_LR".equals(original.getType()) || isRegisteredCambridgeCode(exam.getCode()))
                    && !original.equals(canonical))
                throw new AppException(ErrorCode.VALIDATION_FAILED, "Hãy lưu lại đề theo định dạng chuẩn trước khi xuất bản.");
            if (!original.equals(canonical)) {
                List<Integer> sectionIds = sectionRepository.findByExam_Id(id).stream().map(ExamSection::getId).toList();
                if (!sectionIds.isEmpty()) {
                    partRepository.deleteBySection_IdIn(sectionIds);
                    sectionRepository.deleteByExam_Id(id);
                }
                saveSectionsAndParts(exam, canonical.getSections());
            }
        }
        exam.setIsPublished(isPublished);
        examRepository.save(exam);
    }

    private ExamBuilderRequest prepare(ExamBuilderRequest request, String examCode) {
        ExamBuilderRequest normalized=new ExamContentNormalizer().normalize(request);
        validateRegisteredIdentity(normalized, examCode);
        new ExamPublicationValidator().requireStructure(normalized);
        if (isRegisteredCambridgeCode(examCode)) new IeltsAcademicPublicationValidator().requireStructure(normalized);
        if (normalized.isPublished()) requirePublishable(normalized, examCode);
        return normalized;
    }

    private static void requirePublishable(ExamBuilderRequest request, String examCode) {
        validateRegisteredIdentity(request, examCode);
        var definition = OfficialExamDatasetRegistry.findByExamCode(examCode);
        if (definition.isPresent()) {
            if (OfficialExamDatasetRegistry.CAMBRIDGE_IELTS_KEY.equals(definition.get().datasetKey()))
                new IeltsAcademicPublicationValidator().requirePublishable(request,
                        "COMPLETE".equals(definition.get().explanationStatus()));
            else new ExamPublicationValidator().requirePublishable(request);
            com.multilingo.backend.modules.exam.dto.response.ExamDatasetBundle.requireRegisteredShape(
                    definition.get(), request);
            return;
        }
        new ExamPublicationValidator().requirePublishable(request);
    }

    private static void validateRegisteredIdentity(ExamBuilderRequest request, String examCode) {
        OfficialExamDatasetRegistry.findByExamCode(examCode).ifPresent(definition -> {
            if (request == null || !Objects.equals(definition.type(), request.getType())
                    || !Objects.equals(definition.title(), request.getTitle())
                    || !Objects.equals(definition.language(), request.getExamLanguage()))
                throw new AppException(ErrorCode.VALIDATION_FAILED,
                        "Mã đề chính thức không khớp type, tên đề hoặc ngôn ngữ đã đăng ký.");
        });
    }

    private static boolean isRegisteredCambridgeCode(String examCode) {
        return OfficialExamDatasetRegistry.findByExamCode(examCode)
                .filter(definition -> OfficialExamDatasetRegistry.CAMBRIDGE_IELTS_KEY.equals(definition.datasetKey()))
                .isPresent();
    }
    private void setDuration(Exam exam,ExamBuilderRequest request) {
        if (java.util.Set.of("TOEIC_LR", "IELTS_ACADEMIC", "LANGUAGE_PRACTICE", "NLTV").contains(request.getType()))
            exam.setDurationMinutes(request.getSections().stream().mapToInt(s -> s.getDurationMinutes()).sum());
    }

    @Override
    public com.multilingo.backend.modules.exam.dto.response.ExamDatasetBundle exportDataset(Integer id) {
        return exportDataset(id, null);
    }

    @Override
    public com.multilingo.backend.modules.exam.dto.response.ExamDatasetBundle exportDataset(Integer id, String approvalReference) {
        Exam exam = examRepository.findById(id).orElseThrow(() -> new AppException(ErrorCode.EXAM_NOT_FOUND));
        return com.multilingo.backend.modules.exam.dto.response.ExamDatasetBundle
                .exportForCode(getExamDetail(id), exam.getCode(), approvalReference);
    }
}
