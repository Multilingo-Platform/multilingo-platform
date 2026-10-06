package com.multilingo.backend.modules.exam.service;

import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;

public interface AdminExamService {

    Integer createExam(ExamBuilderRequest request);

    void updateExam(Integer id, ExamBuilderRequest request);
}
