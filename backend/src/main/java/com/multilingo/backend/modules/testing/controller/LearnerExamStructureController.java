package com.multilingo.backend.modules.testing.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.modules.testing.dto.response.LearnerExamStructureResponse;
import com.multilingo.backend.modules.testing.service.LearnerExamStructureService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/exams")
@RequiredArgsConstructor
public class LearnerExamStructureController {

    private final LearnerExamStructureService examStructureService;

    @GetMapping("/{id}/structure")
    public ResponseEntity<ApiResponse<LearnerExamStructureResponse>> getExamStructure(@PathVariable Integer id) {
        LearnerExamStructureResponse response = examStructureService.getPublishedExamStructure(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
