package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.modules.testing.dto.response.LearnerExamStructureResponse;

public interface LearnerExamStructureService {
    LearnerExamStructureResponse getPublishedExamStructure(Integer examId);
}
