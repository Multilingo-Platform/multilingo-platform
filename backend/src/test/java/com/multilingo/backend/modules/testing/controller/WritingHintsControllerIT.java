package com.multilingo.backend.modules.testing.controller;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.dto.request.WritingHintsRequest;
import com.multilingo.backend.modules.testing.dto.response.WritingHintsResponse;
import com.multilingo.backend.modules.testing.exception.WritingHintsRetryAfterException;
import com.multilingo.backend.modules.testing.service.WritingHintsService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class WritingHintsControllerIT {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private WritingHintsService writingHintsService;

    private ListAppender<ILoggingEvent> listAppender;
    private Logger controllerLogger;
    private Logger testingPkgLogger;

    @BeforeEach
    void setUpLogging() {
        listAppender = new ListAppender<>();
        listAppender.start();

        controllerLogger = (Logger) LoggerFactory.getLogger(WritingHintsController.class);
        controllerLogger.addAppender(listAppender);

        testingPkgLogger = (Logger) LoggerFactory.getLogger("com.multilingo.backend.modules.testing");
        testingPkgLogger.addAppender(listAppender);
    }

    @AfterEach
    void tearDownLogging() {
        if (controllerLogger != null && listAppender != null) {
            controllerLogger.detachAppender(listAppender);
        }
        if (testingPkgLogger != null && listAppender != null) {
            testingPkgLogger.detachAppender(listAppender);
        }
        if (listAppender != null) {
            listAppender.stop();
        }
    }

    private WritingHintsResponse createSampleResponse(Integer attemptId, String reqId) {
        WritingHintsResponse.Content content = new WritingHintsResponse.Content(
                List.of(
                        new WritingHintsResponse.OutlineSection("Introduction", List.of("Paraphrase topic", "Outline stance")),
                        new WritingHintsResponse.OutlineSection("Body 1", List.of("Key point A", "Evidence A")),
                        new WritingHintsResponse.OutlineSection("Body 2", List.of("Key point B", "Evidence B")),
                        new WritingHintsResponse.OutlineSection("Conclusion", List.of("Summary"))
                ),
                List.of(
                        new WritingHintsResponse.VocabularyItem("substantial", "large in amount", "use for growth", "A substantial rise was noted"),
                        new WritingHintsResponse.VocabularyItem("fluctuate", "rise and fall", "use for trend variations", "Prices fluctuate wildly"),
                        new WritingHintsResponse.VocabularyItem("predominant", "most common or having greatest power", "main feature", "The predominant factor"),
                        new WritingHintsResponse.VocabularyItem("deteriorate", "become worse", "negative shifts", "Conditions deteriorate"),
                        new WritingHintsResponse.VocabularyItem("mitigate", "make less severe", "solution paragraph", "Steps to mitigate risks")
                ),
                List.of("Hints based on text prompt only; chart visual details require user observation.")
        );

        return WritingHintsResponse.of(
                attemptId, 30, "writing-task-1", reqId, "en", "vi", Instant.parse("2026-10-13T10:00:00Z"), content
        );
    }

    @Test
    @DisplayName("TC_18_02_1: Unauthenticated request bị từ chối 401 Unauthorized")
    void unauthenticatedRequestReturns401() throws Exception {
        mockMvc.perform(post("/api/v1/attempts/10/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"partId\":30,\"questionId\":\"q1\",\"requestId\":\"c5430ff2-6f41-4eb4-b287-e1e1fdab47aa\"}"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(writingHintsService);
    }

    @Test
    @WithMockUser(username = "1", roles = "USER")
    @DisplayName("TC_18_01: Yêu cầu Practice Writing hợp lệ trả 200 OK, ApiResponse envelope và Cache-Control: no-store")
    void validRequestReturns200WithApiResponseAndNoStore() throws Exception {
        String reqId = "c5430ff2-6f41-4eb4-b287-e1e1fdab47aa";
        WritingHintsResponse expectedResponse = createSampleResponse(10, reqId);
        when(writingHintsService.generate(eq(10), any(WritingHintsRequest.class))).thenReturn(expectedResponse);

        String jsonPayload = """
                {
                  "partId": 30,
                  "questionId": "writing-task-1",
                  "requestId": "%s",
                  "learningLanguage": "en",
                  "hintLanguage": "vi"
                }
                """.formatted(reqId);

        mockMvc.perform(post("/api/v1/attempts/10/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonPayload))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.message").value("Success"))
                .andExpect(jsonPath("$.data.attemptId").value(10))
                .andExpect(jsonPath("$.data.partId").value(30))
                .andExpect(jsonPath("$.data.questionId").value("writing-task-1"))
                .andExpect(jsonPath("$.data.requestId").value(reqId))
                .andExpect(jsonPath("$.data.learningLanguage").value("en"))
                .andExpect(jsonPath("$.data.hintLanguage").value("vi"))
                .andExpect(jsonPath("$.data.generatedAt").value("2026-10-13T10:00:00Z"))
                .andExpect(jsonPath("$.data.outline").isArray())
                .andExpect(jsonPath("$.data.vocabulary").isArray())
                .andExpect(jsonPath("$.data.vocabulary.length()").value(5))
                .andExpect(jsonPath("$.data.limitations").isArray());

        verify(writingHintsService).generate(eq(10), any(WritingHintsRequest.class));
    }

    @Test
    @WithMockUser(username = "1", roles = "USER")
    @DisplayName("TC_18_02_2: Foreign hoặc MOCK_TEST attempt trả về 403 FORBIDDEN với fixed message và no-store")
    void foreignOrMockAttemptReturns403Forbidden() throws Exception {
        when(writingHintsService.generate(eq(10), any(WritingHintsRequest.class)))
                .thenThrow(new AppException(ErrorCode.FORBIDDEN, "Chỉ hỗ trợ gợi ý viết cho bài làm PRACTICE của chính người dùng"));

        String jsonPayload = """
                {
                  "partId": 30,
                  "questionId": "writing-task-1",
                  "requestId": "c5430ff2-6f41-4eb4-b287-e1e1fdab47aa"
                }
                """;

        mockMvc.perform(post("/api/v1/attempts/10/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonPayload))
                .andExpect(status().isForbidden())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.code").value(ErrorCode.FORBIDDEN.getCode()))
                .andExpect(jsonPath("$.message").value(ErrorCode.FORBIDDEN.getMessage()))
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    @WithMockUser(username = "1", roles = "USER")
    @DisplayName("Bài thi đã nộp trả 409 ATTEMPT_ALREADY_SUBMITTED với no-store")
    void alreadySubmittedAttemptReturns409() throws Exception {
        when(writingHintsService.generate(eq(10), any(WritingHintsRequest.class)))
                .thenThrow(new AppException(ErrorCode.ATTEMPT_ALREADY_SUBMITTED));

        String jsonPayload = """
                {
                  "partId": 30,
                  "questionId": "writing-task-1",
                  "requestId": "c5430ff2-6f41-4eb4-b287-e1e1fdab47aa"
                }
                """;

        mockMvc.perform(post("/api/v1/attempts/10/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonPayload))
                .andExpect(status().isConflict())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.code").value(ErrorCode.ATTEMPT_ALREADY_SUBMITTED.getCode()))
                .andExpect(jsonPath("$.message").value(ErrorCode.ATTEMPT_ALREADY_SUBMITTED.getMessage()));
    }

    @Test
    @WithMockUser(username = "1", roles = "USER")
    @DisplayName("Bài thi đã hết giờ làm bài trả 409 ATTEMPT_EXPIRED với no-store")
    void expiredAttemptReturns409() throws Exception {
        when(writingHintsService.generate(eq(10), any(WritingHintsRequest.class)))
                .thenThrow(new AppException(ErrorCode.ATTEMPT_EXPIRED));

        String jsonPayload = """
                {
                  "partId": 30,
                  "questionId": "writing-task-1",
                  "requestId": "c5430ff2-6f41-4eb4-b287-e1e1fdab47aa"
                }
                """;

        mockMvc.perform(post("/api/v1/attempts/10/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonPayload))
                .andExpect(status().isConflict())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.code").value(ErrorCode.ATTEMPT_EXPIRED.getCode()))
                .andExpect(jsonPath("$.message").value(ErrorCode.ATTEMPT_EXPIRED.getMessage()));
    }

    @Test
    @WithMockUser(username = "1", roles = "USER")
    @DisplayName("TC_18_18_1: Yêu cầu đang chạy (PENDING) trả 409 WRITING_HINTS_IN_PROGRESS với header Retry-After và no-store")
    void inProgressRequestReturns409WithRetryAfter() throws Exception {
        when(writingHintsService.generate(eq(10), any(WritingHintsRequest.class)))
                .thenThrow(new WritingHintsRetryAfterException(ErrorCode.WRITING_HINTS_IN_PROGRESS, "Đang xử lý", 25L));

        String jsonPayload = """
                {
                  "partId": 30,
                  "questionId": "writing-task-1",
                  "requestId": "c5430ff2-6f41-4eb4-b287-e1e1fdab47aa"
                }
                """;

        mockMvc.perform(post("/api/v1/attempts/10/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonPayload))
                .andExpect(status().isConflict())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(header().string(HttpHeaders.RETRY_AFTER, "25"))
                .andExpect(jsonPath("$.code").value(ErrorCode.WRITING_HINTS_IN_PROGRESS.getCode()))
                .andExpect(jsonPath("$.message").value(ErrorCode.WRITING_HINTS_IN_PROGRESS.getMessage()));
    }

    @Test
    @WithMockUser(username = "1", roles = "USER")
    @DisplayName("TC_18_18_2: Cooldown request trả 429 WRITING_HINTS_RATE_LIMITED với header Retry-After và no-store")
    void cooldownRequestReturns429WithRetryAfter() throws Exception {
        when(writingHintsService.generate(eq(10), any(WritingHintsRequest.class)))
                .thenThrow(new WritingHintsRetryAfterException(ErrorCode.WRITING_HINTS_RATE_LIMITED, "Rate limited", 8L));

        String jsonPayload = """
                {
                  "partId": 30,
                  "questionId": "writing-task-1",
                  "requestId": "c5430ff2-6f41-4eb4-b287-e1e1fdab47aa"
                }
                """;

        mockMvc.perform(post("/api/v1/attempts/10/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonPayload))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(header().string(HttpHeaders.RETRY_AFTER, "8"))
                .andExpect(jsonPath("$.code").value(ErrorCode.WRITING_HINTS_RATE_LIMITED.getCode()))
                .andExpect(jsonPath("$.message").value(ErrorCode.WRITING_HINTS_RATE_LIMITED.getMessage()));
    }

    @Test
    @WithMockUser(username = "1", roles = "USER")
    @DisplayName("TC_18_13: Payload xung đột với request_id trước trả 409 WRITING_HINTS_REQUEST_CONFLICT với no-store")
    void requestConflictReturns409() throws Exception {
        when(writingHintsService.generate(eq(10), any(WritingHintsRequest.class)))
                .thenThrow(new AppException(ErrorCode.WRITING_HINTS_REQUEST_CONFLICT));

        String jsonPayload = """
                {
                  "partId": 30,
                  "questionId": "writing-task-1",
                  "requestId": "c5430ff2-6f41-4eb4-b287-e1e1fdab47aa"
                }
                """;

        mockMvc.perform(post("/api/v1/attempts/10/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonPayload))
                .andExpect(status().isConflict())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.code").value(ErrorCode.WRITING_HINTS_REQUEST_CONFLICT.getCode()))
                .andExpect(jsonPath("$.message").value(ErrorCode.WRITING_HINTS_REQUEST_CONFLICT.getMessage()));
    }

    @Test
    @WithMockUser(username = "1", roles = "USER")
    @DisplayName("Hết hạn mức quota trả 429 QUOTA_EXCEEDED với no-store và không có header Retry-After")
    void quotaExceededReturns429WithoutRetryAfter() throws Exception {
        when(writingHintsService.generate(eq(10), any(WritingHintsRequest.class)))
                .thenThrow(new AppException(ErrorCode.QUOTA_EXCEEDED));

        String jsonPayload = """
                {
                  "partId": 30,
                  "questionId": "writing-task-1",
                  "requestId": "c5430ff2-6f41-4eb4-b287-e1e1fdab47aa"
                }
                """;

        mockMvc.perform(post("/api/v1/attempts/10/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonPayload))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(header().doesNotExist(HttpHeaders.RETRY_AFTER))
                .andExpect(jsonPath("$.code").value(ErrorCode.QUOTA_EXCEEDED.getCode()))
                .andExpect(jsonPath("$.message").value(ErrorCode.QUOTA_EXCEEDED.getMessage()));
    }

    @Test
    @WithMockUser(username = "1", roles = "USER")
    @DisplayName("TC_18_04_1: Request body vượt quá 16 KiB trả 413 WRITING_HINTS_REQUEST_TOO_LARGE với no-store")
    void oversizedBodyReturns413() throws Exception {
        // Tạo body 16 KiB + 1 byte (16385 bytes)
        String padding = "x".repeat(16360);
        String oversizedJson = "{\"partId\":30,\"questionId\":\"" + padding + "\"}";

        mockMvc.perform(post("/api/v1/attempts/10/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(oversizedJson))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.code").value(ErrorCode.WRITING_HINTS_REQUEST_TOO_LARGE.getCode()))
                .andExpect(jsonPath("$.message").value(ErrorCode.WRITING_HINTS_REQUEST_TOO_LARGE.getMessage()));

        verifyNoInteractions(writingHintsService);
    }

    @Test
    @WithMockUser(username = "1", roles = "USER")
    @DisplayName("TC_18_03_1: Malformed JSON trả 422 VALIDATION_FAILED với no-store và không log body")
    void malformedJsonReturns422() throws Exception {
        String malformedJson = "{partId: 30, bad_json";

        mockMvc.perform(post("/api/v1/attempts/10/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(malformedJson))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.code").value(ErrorCode.VALIDATION_FAILED.getCode()))
                .andExpect(jsonPath("$.message").value(ErrorCode.VALIDATION_FAILED.getMessage()));

        verifyNoInteractions(writingHintsService);
    }

    @Test
    @WithMockUser(username = "1", roles = "USER")
    @DisplayName("TC_18_03_2: Duplicate key trong JSON payload trả 422 VALIDATION_FAILED")
    void duplicateKeyInJsonReturns422() throws Exception {
        String duplicateKeyJson = """
                {
                  "partId": 30,
                  "partId": 30,
                  "questionId": "q1",
                  "requestId": "c5430ff2-6f41-4eb4-b287-e1e1fdab47aa"
                }
                """;

        mockMvc.perform(post("/api/v1/attempts/10/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(duplicateKeyJson))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.code").value(ErrorCode.VALIDATION_FAILED.getCode()))
                .andExpect(jsonPath("$.message").value(ErrorCode.VALIDATION_FAILED.getMessage()));

        verifyNoInteractions(writingHintsService);
    }

    @Test
    @WithMockUser(username = "1", roles = "USER")
    @DisplayName("TC_18_03_3: Unknown field trong JSON payload trả 422 VALIDATION_FAILED")
    void unknownFieldInJsonReturns422() throws Exception {
        String unknownFieldJson = """
                {
                  "partId": 30,
                  "questionId": "q1",
                  "requestId": "c5430ff2-6f41-4eb4-b287-e1e1fdab47aa",
                  "unexpectedProperty": "exploit"
                }
                """;

        mockMvc.perform(post("/api/v1/attempts/10/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(unknownFieldJson))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.code").value(ErrorCode.VALIDATION_FAILED.getCode()))
                .andExpect(jsonPath("$.message").value(ErrorCode.VALIDATION_FAILED.getMessage()));

        verifyNoInteractions(writingHintsService);
    }

    @Test
    @WithMockUser(username = "1", roles = "USER")
    @DisplayName("TC_18_04_2: Path ID không hợp lệ (leading zero, âm, chữ, overflow) trả 422 VALIDATION_FAILED")
    void invalidPathIdReturns422() throws Exception {
        String validBody = """
                {
                  "partId": 30,
                  "questionId": "writing-task-1",
                  "requestId": "c5430ff2-6f41-4eb4-b287-e1e1fdab47aa"
                }
                """;

        List<String> invalidIds = List.of("0", "012", "-5", "abc", "10a", "9999999999999");
        for (String idStr : invalidIds) {
            mockMvc.perform(post("/api/v1/attempts/" + idStr + "/writing-hints")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(validBody))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                    .andExpect(jsonPath("$.code").value(ErrorCode.VALIDATION_FAILED.getCode()))
                    .andExpect(jsonPath("$.message").value(ErrorCode.VALIDATION_FAILED.getMessage()));
        }

        verifyNoInteractions(writingHintsService);
    }

    @Test
    @WithMockUser(username = "1", roles = "USER")
    @DisplayName("TC_18_07: Ngôn ngữ không được hỗ trợ trả 422 WRITING_HINTS_LANGUAGE_UNSUPPORTED với no-store")
    void languageUnsupportedReturns422() throws Exception {
        when(writingHintsService.generate(eq(10), any(WritingHintsRequest.class)))
                .thenThrow(new AppException(ErrorCode.WRITING_HINTS_LANGUAGE_UNSUPPORTED));

        String jsonPayload = """
                {
                  "partId": 30,
                  "questionId": "writing-task-1",
                  "requestId": "c5430ff2-6f41-4eb4-b287-e1e1fdab47aa",
                  "hintLanguage": "xx"
                }
                """;

        mockMvc.perform(post("/api/v1/attempts/10/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonPayload))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.code").value(ErrorCode.WRITING_HINTS_LANGUAGE_UNSUPPORTED.getCode()))
                .andExpect(jsonPath("$.message").value(ErrorCode.WRITING_HINTS_LANGUAGE_UNSUPPORTED.getMessage()));
    }

    @Test
    @WithMockUser(username = "1", roles = "USER")
    @DisplayName("Thiếu ngôn ngữ học tập bắt buộc trả 422 WRITING_HINTS_LANGUAGE_REQUIRED")
    void languageRequiredReturns422() throws Exception {
        when(writingHintsService.generate(eq(10), any(WritingHintsRequest.class)))
                .thenThrow(new AppException(ErrorCode.WRITING_HINTS_LANGUAGE_REQUIRED));

        String jsonPayload = """
                {
                  "partId": 30,
                  "questionId": "writing-task-1",
                  "requestId": "c5430ff2-6f41-4eb4-b287-e1e1fdab47aa"
                }
                """;

        mockMvc.perform(post("/api/v1/attempts/10/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonPayload))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.code").value(ErrorCode.WRITING_HINTS_LANGUAGE_REQUIRED.getCode()))
                .andExpect(jsonPath("$.message").value(ErrorCode.WRITING_HINTS_LANGUAGE_REQUIRED.getMessage()));
    }

    @Test
    @WithMockUser(username = "1", roles = "USER")
    @DisplayName("Nội dung bài viết không khả dụng trả 422 WRITING_HINTS_CONTEXT_UNAVAILABLE")
    void contextUnavailableReturns422() throws Exception {
        when(writingHintsService.generate(eq(10), any(WritingHintsRequest.class)))
                .thenThrow(new AppException(ErrorCode.WRITING_HINTS_CONTEXT_UNAVAILABLE));

        String jsonPayload = """
                {
                  "partId": 30,
                  "questionId": "writing-task-1",
                  "requestId": "c5430ff2-6f41-4eb4-b287-e1e1fdab47aa"
                }
                """;

        mockMvc.perform(post("/api/v1/attempts/10/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonPayload))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.code").value(ErrorCode.WRITING_HINTS_CONTEXT_UNAVAILABLE.getCode()))
                .andExpect(jsonPath("$.message").value(ErrorCode.WRITING_HINTS_CONTEXT_UNAVAILABLE.getMessage()));
    }

    @Test
    @WithMockUser(username = "1", roles = "USER")
    @DisplayName("Tính năng tắt trả 503 WRITING_HINTS_UNAVAILABLE với no-store")
    void featureDisabledReturns503() throws Exception {
        when(writingHintsService.generate(eq(10), any(WritingHintsRequest.class)))
                .thenThrow(new AppException(ErrorCode.WRITING_HINTS_UNAVAILABLE));

        String jsonPayload = """
                {
                  "partId": 30,
                  "questionId": "writing-task-1",
                  "requestId": "c5430ff2-6f41-4eb4-b287-e1e1fdab47aa"
                }
                """;

        mockMvc.perform(post("/api/v1/attempts/10/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonPayload))
                .andExpect(status().isServiceUnavailable())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.code").value(ErrorCode.WRITING_HINTS_UNAVAILABLE.getCode()))
                .andExpect(jsonPath("$.message").value(ErrorCode.WRITING_HINTS_UNAVAILABLE.getMessage()));
    }

    @Test
    @WithMockUser(username = "1", roles = "USER")
    @DisplayName("Gemini timeout trả 504 WRITING_HINTS_TIMEOUT với no-store")
    void geminiTimeoutReturns504() throws Exception {
        when(writingHintsService.generate(eq(10), any(WritingHintsRequest.class)))
                .thenThrow(new AppException(ErrorCode.WRITING_HINTS_TIMEOUT));

        String jsonPayload = """
                {
                  "partId": 30,
                  "questionId": "writing-task-1",
                  "requestId": "c5430ff2-6f41-4eb4-b287-e1e1fdab47aa"
                }
                """;

        mockMvc.perform(post("/api/v1/attempts/10/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonPayload))
                .andExpect(status().isGatewayTimeout())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.code").value(ErrorCode.WRITING_HINTS_TIMEOUT.getCode()))
                .andExpect(jsonPath("$.message").value(ErrorCode.WRITING_HINTS_TIMEOUT.getMessage()));
    }

    @Test
    @WithMockUser(username = "1", roles = "USER")
    @DisplayName("TC_18_11: Output Gemini không hợp lệ trả 502 WRITING_HINTS_INVALID_RESPONSE với no-store")
    void geminiInvalidResponseReturns502() throws Exception {
        when(writingHintsService.generate(eq(10), any(WritingHintsRequest.class)))
                .thenThrow(new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE));

        String jsonPayload = """
                {
                  "partId": 30,
                  "questionId": "writing-task-1",
                  "requestId": "c5430ff2-6f41-4eb4-b287-e1e1fdab47aa"
                }
                """;

        mockMvc.perform(post("/api/v1/attempts/10/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonPayload))
                .andExpect(status().isBadGateway())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.code").value(ErrorCode.WRITING_HINTS_INVALID_RESPONSE.getCode()))
                .andExpect(jsonPath("$.message").value(ErrorCode.WRITING_HINTS_INVALID_RESPONSE.getMessage()));
    }

    @Test
    @WithMockUser(username = "1", roles = "USER")
    @DisplayName("Câu hỏi ngoài snapshot trả 404 RESOURCE_NOT_FOUND với no-store")
    void questionNotFoundInSnapshotReturns404() throws Exception {
        when(writingHintsService.generate(eq(10), any(WritingHintsRequest.class)))
                .thenThrow(new AppException(ErrorCode.RESOURCE_NOT_FOUND));

        String jsonPayload = """
                {
                  "partId": 30,
                  "questionId": "non-existent-question",
                  "requestId": "c5430ff2-6f41-4eb4-b287-e1e1fdab47aa"
                }
                """;

        mockMvc.perform(post("/api/v1/attempts/10/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonPayload))
                .andExpect(status().isNotFound())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.code").value(ErrorCode.RESOURCE_NOT_FOUND.getCode()))
                .andExpect(jsonPath("$.message").value(ErrorCode.RESOURCE_NOT_FOUND.getMessage()));
    }

    @Test
    @WithMockUser(username = "1", roles = "USER")
    @DisplayName("TC_18_17: Sentinel privacy guard - Không lộ chuỗi nhạy cảm trong body phản hồi và nhật ký logs")
    void sentinelPrivacyGuardsEnsureNoLeakInResponseOrLogs() throws Exception {
        String bodySentinel = "SENTINEL_BODY_RAW_ESSAY_TEXT_443322";
        String errorSentinel = "SENTINEL_INTERNAL_PROVIDER_STACK_TRACE_998877";

        when(writingHintsService.generate(eq(10), any(WritingHintsRequest.class)))
                .thenThrow(new AppException(ErrorCode.WRITING_HINTS_UNAVAILABLE, errorSentinel));

        String jsonPayloadWithSentinel = """
                {
                  "partId": 30,
                  "questionId": "q-%s",
                  "requestId": "c5430ff2-6f41-4eb4-b287-e1e1fdab47aa",
                  "learningLanguage": "en"
                }
                """.formatted(bodySentinel);

        MvcResult result = mockMvc.perform(post("/api/v1/attempts/10/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonPayloadWithSentinel))
                .andExpect(status().isServiceUnavailable())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andReturn();

        // 1. Phản hồi HTTP tuyệt đối không chứa errorSentinel hay bodySentinel
        String responseBody = result.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        assertThat(responseBody).doesNotContain(errorSentinel);
        assertThat(responseBody).doesNotContain(bodySentinel);
        // Message phải là message cố định an toàn của ErrorCode
        assertThat(responseBody).contains(ErrorCode.WRITING_HINTS_UNAVAILABLE.getMessage());

        // Kiểm tra thêm trường hợp payload JSON bị lỗi chứa bodySentinel
        String malformedWithSentinel = "{ badJsonWithSentinel: \"" + bodySentinel + "\" ";
        mockMvc.perform(post("/api/v1/attempts/10/writing-hints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(malformedWithSentinel))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"));

        // 2. Logs tuyệt đối không in exception custom message hoặc raw body chứa sentinels
        boolean sentinelInLogs = listAppender.list.stream()
                .anyMatch(event -> {
                    String msg = event.getFormattedMessage();
                    boolean inMsg = msg != null && (msg.contains(errorSentinel) || msg.contains(bodySentinel));
                    boolean inThrowable = event.getThrowableProxy() != null && (
                            String.valueOf(event.getThrowableProxy().getMessage()).contains(errorSentinel)
                                    || String.valueOf(event.getThrowableProxy().getMessage()).contains(bodySentinel));
                    return inMsg || inThrowable;
                });
        assertThat(sentinelInLogs).isFalse();
    }
}
