package com.multilingo.backend.modules.testing.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest;
import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.dto.response.SubmitResultResponse;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;
import com.multilingo.backend.modules.testing.service.TestAttemptService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/attempts")
@RequiredArgsConstructor
public class TestAttemptController {

    private final TestAttemptService testAttemptService;

    /**
     * UC-01: Create a new test attempt.
     * userId is resolved from IdentityAdapter (fixture in dev/test, JWT in production).
     *
     * @return 201 Created with WorkspaceResponse
     */
    @PostMapping
    public ResponseEntity<ApiResponse<WorkspaceResponse>> createAttempt(
            @Valid @RequestBody CreateAttemptRequest request) {
        WorkspaceResponse workspace = testAttemptService.createAttempt(request);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success(workspace));
    }

    /**
     * UC-02: Get the workspace for an existing attempt.
     * Only the attempt owner can access — returns 403 otherwise.
     *
     * @return 200 OK with WorkspaceResponse
     */
    @GetMapping({"/{id}", "/{id}/workspace"})
    public ResponseEntity<ApiResponse<WorkspaceResponse>> getWorkspace(
            @PathVariable Integer id) {
        WorkspaceResponse workspace = testAttemptService.getAttemptWorkspace(id);
        return ResponseEntity.ok(ApiResponse.success(workspace));
    }

    /**
     * UC-03: Autosave answers draft for an in-progress attempt.
     *
     * @return 200 OK
     */
    @PutMapping("/{id}/answers")
    public ResponseEntity<ApiResponse<Void>> autosaveAnswers(
            @PathVariable Integer id,
            @Valid @RequestBody AutosaveAnswersRequest request) {
        testAttemptService.autosaveAnswers(id, request);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    /**
     * UC-04: Submit attempt. Idempotent.
     *
     * @return 200 OK with SubmitResultResponse
     */
    @PostMapping("/{id}/submit")
    public ResponseEntity<ApiResponse<SubmitResultResponse>> submitAttempt(
            @PathVariable Integer id,
            @Valid @RequestBody com.multilingo.backend.modules.testing.dto.request.SubmitAttemptRequest request) {
        SubmitResultResponse result = testAttemptService.submitAttempt(id, request);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Lock a section in an attempt (MOCK_TEST FULL_EXAM only).
     */
    @PostMapping("/{id}/sections/{sectionId}/lock")
    public ResponseEntity<ApiResponse<Void>> lockSection(
            @PathVariable Integer id,
            @PathVariable Integer sectionId) {
        testAttemptService.lockSection(id, sectionId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
