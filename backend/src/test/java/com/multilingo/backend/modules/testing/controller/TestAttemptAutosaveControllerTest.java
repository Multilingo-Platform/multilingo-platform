package com.multilingo.backend.modules.testing.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.common.exception.GlobalExceptionHandler;
import com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest;
import com.multilingo.backend.modules.testing.dto.response.AutosaveVersionResponse;
import com.multilingo.backend.modules.testing.service.TestAttemptService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class TestAttemptAutosaveControllerTest {

    @Mock
    private TestAttemptService testAttemptService;

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final Integer ATTEMPT_ID = 42;

    @BeforeEach
    void setUp() {
        TestAttemptController controller = new TestAttemptController(testAttemptService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void autosaveAnswers_success_returns_200_with_version_and_no_serverTime() throws Exception {
        // Arrange
        AutosaveVersionResponse serviceResponse = AutosaveVersionResponse.builder()
                .version(2)
                .build();
        when(testAttemptService.autosaveAnswers(eq(ATTEMPT_ID), any(AutosaveAnswersRequest.class)))
                .thenReturn(serviceResponse);

        AutosaveAnswersRequest request = AutosaveAnswersRequest.builder()
                .version(1)
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(10)
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                .questionId("q1")
                                                .answer("A")
                                                .build()
                                ))
                                .build()
                ))
                .build();

        // Act & Assert
        mockMvc.perform(put("/api/v1/attempts/{id}/answers", ATTEMPT_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.version").value(2))
                .andExpect(jsonPath("$.data.serverTime").doesNotExist());
    }

    @Test
    void autosaveAnswers_staleVersion_returns_409_with_code_1601() throws Exception {
        // Arrange
        when(testAttemptService.autosaveAnswers(eq(ATTEMPT_ID), any(AutosaveAnswersRequest.class)))
                .thenThrow(new AppException(ErrorCode.VERSION_CONFLICT, "Version conflict: current attempt version is 2"));

        AutosaveAnswersRequest request = AutosaveAnswersRequest.builder()
                .version(1)
                .answers(List.of())
                .build();

        // Act & Assert
        mockMvc.perform(put("/api/v1/attempts/{id}/answers", ATTEMPT_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(1601))
                .andExpect(jsonPath("$.message").value("Version conflict: current attempt version is 2"));
    }

    @Test
    void autosaveAnswers_missingVersion_returns_validation_error() throws Exception {
        String invalidJson = "{\"answers\": []}";

        mockMvc.perform(put("/api/v1/attempts/{id}/answers", ATTEMPT_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidJson))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(422));
    }
}
