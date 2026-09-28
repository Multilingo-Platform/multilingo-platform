package com.multilingo.backend.common.exception;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = GlobalExceptionHandlerTest.TestMockController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({GlobalExceptionHandler.class, GlobalExceptionHandlerTest.TestMockController.class})
@ActiveProfiles("test")
class GlobalExceptionHandlerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    static class SampleRequestDto {
        @NotBlank(message = "Username không được để trống")
        private String username;
    }

    @RestController
    static class TestMockController {

        @GetMapping("/test-api/app-exception")
        public void throwAppException() {
            throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Không tìm thấy người dùng");
        }

        @PostMapping("/test-api/validation-exception")
        public void throwValidationException(@Valid @RequestBody SampleRequestDto dto) {
            // No-op
        }

        @GetMapping("/test-api/uncaught-exception")
        public void throwUncaughtException() {
            throw new NullPointerException("Simulated unexpected null pointer");
        }
    }

    @Test
    @DisplayName("AppException should be caught and transformed into standard ApiResponse error")
    void shouldHandleAppException() throws Exception {
        mockMvc.perform(get("/test-api/app-exception"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(404))
                .andExpect(jsonPath("$.message").value("Không tìm thấy người dùng"))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    @DisplayName("Validation exception should return 422 with field violation details")
    void shouldHandleValidationException() throws Exception {
        SampleRequestDto invalidDto = new SampleRequestDto("");

        mockMvc.perform(post("/test-api/validation-exception")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidDto)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(422))
                .andExpect(jsonPath("$.message", containsString("Username không được để trống")))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    @DisplayName("Uncaught exception should return 500 with sanitized message")
    void shouldHandleUncaughtException() throws Exception {
        mockMvc.perform(get("/test-api/uncaught-exception"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(500))
                .andExpect(jsonPath("$.message").value(ErrorCode.UNCATEGORIZED_EXCEPTION.getMessage()))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    @DisplayName("HttpRequestMethodNotSupportedException should return 405 with method details")
    void shouldHandleMethodNotSupportedException() throws Exception {
        mockMvc.perform(post("/test-api/app-exception"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(405))
                .andExpect(jsonPath("$.message", containsString("POST")))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    @DisplayName("HttpMessageNotReadableException should return 400 for malformed json body")
    void shouldHandleMalformedJsonException() throws Exception {
        mockMvc.perform(post("/test-api/validation-exception")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("invalid-json{"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").exists())
                .andExpect(jsonPath("$.timestamp").exists());
    }
}
