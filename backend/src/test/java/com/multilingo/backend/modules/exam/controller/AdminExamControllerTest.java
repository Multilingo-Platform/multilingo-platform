package com.multilingo.backend.modules.exam.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import com.multilingo.backend.modules.exam.service.AdminExamService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.multilingo.backend.modules.auth.security.JwtTokenProvider;
import com.multilingo.backend.modules.auth.security.CustomUserDetailsService;

import org.springframework.data.redis.core.StringRedisTemplate;

@WebMvcTest(AdminExamController.class)
@AutoConfigureMockMvc(addFilters = false)
class AdminExamControllerTest {

    @MockBean
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private CustomUserDetailsService customUserDetailsService;

    @MockBean
    private StringRedisTemplate stringRedisTemplate;

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AdminExamService examService;

    @MockBean
    private com.multilingo.backend.modules.exam.service.ExamParserService examParserService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void createExam_Success() throws Exception {
        ExamBuilderRequest request = ExamBuilderRequest.builder()
                .title("Mock Exam")
                .type("IELTS")
                .examLanguage("en")
                .isPublished(true)
                .sections(java.util.List.of(com.multilingo.backend.modules.exam.dto.request.SectionBuilderRequest.builder().skillType("LISTENING").durationMinutes(40).parts(java.util.List.of(com.multilingo.backend.modules.exam.dto.request.PartBuilderRequest.builder().partNumber(1).contentData(java.util.Map.of("key","val")).build())).build()))
                .build();

        when(examService.createExam(any())).thenReturn(1);

        mockMvc.perform(post("/api/v1/admin/exams")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").value(1));
    }

    @Test
    void updateExam_Success() throws Exception {
        ExamBuilderRequest request = ExamBuilderRequest.builder()
                .title("Updated Exam")
                .type("IELTS")
                .examLanguage("en")
                .isPublished(true)
                .sections(java.util.List.of(com.multilingo.backend.modules.exam.dto.request.SectionBuilderRequest.builder().skillType("LISTENING").durationMinutes(40).parts(java.util.List.of(com.multilingo.backend.modules.exam.dto.request.PartBuilderRequest.builder().partNumber(1).contentData(java.util.Map.of("key","val")).build())).build()))
                .build();

        doNothing().when(examService).updateExam(eq(1), any());

        mockMvc.perform(put("/api/v1/admin/exams/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.message").value("Success"));
    }

    @Test
    void updateExam_NotFound() throws Exception {
        ExamBuilderRequest request = ExamBuilderRequest.builder()
                .title("Updated Exam")
                .type("IELTS")
                .examLanguage("en")
                .isPublished(true)
                .sections(java.util.List.of(com.multilingo.backend.modules.exam.dto.request.SectionBuilderRequest.builder().skillType("LISTENING").durationMinutes(40).parts(java.util.List.of(com.multilingo.backend.modules.exam.dto.request.PartBuilderRequest.builder().partNumber(1).contentData(java.util.Map.of("key","val")).build())).build()))
                .build();

        doThrow(new AppException(ErrorCode.EXAM_NOT_FOUND))
                .when(examService).updateExam(eq(99), any());

        mockMvc.perform(put("/api/v1/admin/exams/99")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(1401));
    }

    @Test
    void deleteExam_Success() throws Exception {
        doNothing().when(examService).deleteExam(1);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/v1/admin/exams/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.message").value("Success"));
    }

    @Test
    void deleteExam_NotFound() throws Exception {
        doThrow(new AppException(ErrorCode.EXAM_NOT_FOUND))
                .when(examService).deleteExam(99);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/v1/admin/exams/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(1401));
    }

    @Test
    void importExam_Success() throws Exception {
        ExamBuilderRequest request = ExamBuilderRequest.builder()
                .title("Mock Exam")
                .type("IELTS")
                .examLanguage("en")
                .isPublished(true)
                .sections(java.util.List.of(com.multilingo.backend.modules.exam.dto.request.SectionBuilderRequest.builder().skillType("LISTENING").durationMinutes(40).parts(java.util.List.of(com.multilingo.backend.modules.exam.dto.request.PartBuilderRequest.builder().partNumber(1).contentData(java.util.Map.of("key","val")).build())).build()))
                .build();
                
        when(examParserService.parseExamFile(any())).thenReturn(request);
        when(examService.createExam(any())).thenReturn(10);
        
        org.springframework.mock.web.MockMultipartFile file = new org.springframework.mock.web.MockMultipartFile("file", "test.json", "application/json", "{}".getBytes());

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart("/api/v1/admin/exams/import")
                        .file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").value(10));
    }
}
