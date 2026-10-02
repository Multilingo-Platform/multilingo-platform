package com.multilingo.backend.modules.testing.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class TestAttemptControllerIT {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    // ─── UC-01: POST /api/v1/attempts ───────────────────────────────────────────

    @Test
    void post_attempts_creates_attempt_and_returns_201() throws Exception {
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1);
        req.setTestScope(TestScope.FULL_EXAM);
        req.setTestMode(TestMode.MOCK_TEST);

        mockMvc.perform(post("/api/v1/attempts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.attemptId").isNumber())
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.data.deadline").isNotEmpty())
                .andExpect(jsonPath("$.data.examSnapshot").isNotEmpty());
    }

    @Test
    void post_attempts_practice_mode_returns_null_deadline() throws Exception {
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1);
        req.setTestScope(TestScope.FULL_EXAM);
        req.setTestMode(TestMode.PRACTICE);

        mockMvc.perform(post("/api/v1/attempts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.deadline").doesNotExist());
    }

    @Test
    void post_attempts_with_invalid_exam_returns_404() throws Exception {
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(9999);
        req.setTestScope(TestScope.FULL_EXAM);
        req.setTestMode(TestMode.MOCK_TEST);

        mockMvc.perform(post("/api/v1/attempts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isNotFound());
    }

    @Test
    void post_attempts_missing_required_fields_returns_422() throws Exception {
        // Missing examId — @Valid triggers validation; GlobalExceptionHandler maps to 422 VALIDATION_FAILED
        mockMvc.perform(post("/api/v1/attempts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnprocessableEntity());
    }

    // ─── UC-02: GET /api/v1/attempts/{id}/workspace ─────────────────────────────

    @Test
    void get_workspace_returns_200_for_own_attempt() throws Exception {
        // Create an attempt first
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1);
        req.setTestScope(TestScope.FULL_EXAM);
        req.setTestMode(TestMode.PRACTICE);

        MvcResult createResult = mockMvc.perform(post("/api/v1/attempts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andReturn();

        String responseBody = createResult.getResponse().getContentAsString();
        Integer attemptId = objectMapper.readTree(responseBody)
                .path("data").path("attemptId").asInt();

        mockMvc.perform(get("/api/v1/attempts/{id}/workspace", attemptId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.attemptId").value(attemptId))
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"));

        // Verify standard RESTful endpoint /api/v1/attempts/{id} also works
        mockMvc.perform(get("/api/v1/attempts/{id}", attemptId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.attemptId").value(attemptId))
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"));
    }

    @Test
    void get_workspace_nonexistent_attempt_returns_403() throws Exception {
        mockMvc.perform(get("/api/v1/attempts/{id}/workspace", 99999))
                .andExpect(status().isForbidden());
    }

    // ─── UC-03: PUT /api/v1/attempts/{id}/answers ────────────────────────────────

    @Test
    void put_answers_returns_200_for_valid_attempt() throws Exception {
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1);
        req.setTestScope(TestScope.FULL_EXAM);
        req.setTestMode(TestMode.MOCK_TEST);
        MvcResult create = mockMvc.perform(post("/api/v1/attempts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andReturn();
        int attemptId = objectMapper.readTree(create.getResponse().getContentAsString())
                .path("data").path("attemptId").asInt();

        String body = "{\"version\": 1, \"answers\": []}";
        mockMvc.perform(put("/api/v1/attempts/{id}/answers", attemptId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());
    }

    // ─── UC-04: POST /api/v1/attempts/{id}/submit ───────────────────────────────

    @Test
    void post_submit_changes_status_to_COMPLETED() throws Exception {
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1);
        req.setTestScope(TestScope.SINGLE_SKILL);
        req.setTargetSectionId(1);
        req.setTestMode(TestMode.MOCK_TEST);
        MvcResult create = mockMvc.perform(post("/api/v1/attempts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andReturn();
        int attemptId = objectMapper.readTree(create.getResponse().getContentAsString())
                .path("data").path("attemptId").asInt();

        String body = "{\"reason\": \"MANUAL\", \"version\": 1, \"answers\": []}";
        mockMvc.perform(post("/api/v1/attempts/{id}/submit", attemptId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.redirectUrl").value("/attempts/" + attemptId + "/result"));
    }

    @Test
    void post_submit_idempotent_returns_200_when_already_submitted() throws Exception {
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1);
        req.setTestScope(TestScope.SINGLE_SKILL);
        req.setTargetSectionId(1);
        req.setTestMode(TestMode.MOCK_TEST);
        MvcResult create = mockMvc.perform(post("/api/v1/attempts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andReturn();
        int attemptId = objectMapper.readTree(create.getResponse().getContentAsString())
                .path("data").path("attemptId").asInt();
        String body = "{\"reason\": \"MANUAL\", \"version\": 1, \"answers\": []}";

        mockMvc.perform(post("/api/v1/attempts/{id}/submit", attemptId)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/attempts/{id}/submit", attemptId)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));
    }
}
