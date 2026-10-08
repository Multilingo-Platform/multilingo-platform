package com.multilingo.backend.modules.exam.service;

import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;

public interface AdminExamService {

    Integer createExam(ExamBuilderRequest request);

    void updateExam(Integer id, ExamBuilderRequest request);

    void deleteExam(Integer id);

    java.util.List<com.multilingo.backend.modules.exam.dto.response.ExamSummaryResponse> getAllExams();
    
    ExamBuilderRequest getExamDetail(Integer id);
    
    void updateExamStatus(Integer id, boolean isPublished);
}
