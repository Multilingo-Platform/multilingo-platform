package com.multilingo.backend.modules.exam.controller;

import com.multilingo.backend.modules.exam.service.*;
import com.multilingo.backend.modules.exam.dto.response.ExamImportPreviewResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.*;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.ActiveProfiles;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AdminExamController.class)
@ActiveProfiles("test")
@Import(ExamImportSecurityTest.MethodSecurity.class)
class ExamImportSecurityTest {
    @org.springframework.boot.test.context.TestConfiguration @EnableMethodSecurity static class MethodSecurity {}
    @Autowired MockMvc mvc;
    @MockBean AdminExamService admin;
    @MockBean ExamParserService parser;
    @MockBean com.multilingo.backend.modules.auth.security.JwtTokenProvider token;
    @MockBean com.multilingo.backend.modules.auth.security.CustomUserDetailsService users;
    @MockBean org.springframework.data.redis.core.StringRedisTemplate redis;

    @Test @WithMockUser(roles = "USER")
    void learnerCannotPreviewImportOrExportSolutions() throws Exception {
        mvc.perform(multipart("/api/v1/admin/exams/import/preview").file("file", new byte[]{1}).with(csrf())).andExpect(status().isForbidden());
        mvc.perform(multipart("/api/v1/admin/exams/import").file("file", new byte[]{1}).with(csrf())).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/exams/1/dataset-export")).andExpect(status().isForbidden());
        verifyNoInteractions(admin, parser);
    }

    @Test @WithMockUser(roles = "CONTENT_CREATOR")
    void contentCreatorCanPreviewWithoutSaving() throws Exception {
        when(parser.previewExamFile(any())).thenReturn(new ExamImportPreviewResponse(null, java.util.List.of(),
            new ExamImportPreviewResponse.Counts(0, 0, 0), "a".repeat(64), false));
        mvc.perform(multipart("/api/v1/admin/exams/import/preview").file("file", new byte[]{1}).with(csrf())).andExpect(status().isOk());
        verifyNoInteractions(admin);
    }

    @Test @WithMockUser(roles = "ADMIN")
    void administratorCanExport() throws Exception {
        mvc.perform(get("/api/v1/admin/exams/1/dataset-export")).andExpect(status().isOk());
        verify(admin).exportDataset(1);
    }
}
