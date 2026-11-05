package com.multilingo.backend.modules.analytics.controller;

import com.multilingo.backend.modules.analytics.dto.response.StudentQuotaResponse;
import com.multilingo.backend.modules.analytics.service.QuotaService;
import com.multilingo.backend.modules.auth.entity.Role;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.security.CustomUserDetails;
import com.multilingo.backend.modules.auth.security.CustomUserDetailsService;
import com.multilingo.backend.modules.auth.security.JwtTokenProvider;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(StudentQuotaController.class)
@AutoConfigureMockMvc(addFilters = false)
class StudentQuotaControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private QuotaService quotaService;

    @MockBean
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private CustomUserDetailsService customUserDetailsService;

    @MockBean
    private StringRedisTemplate stringRedisTemplate;

    private User mockUser;
    private CustomUserDetails mockUserDetails;

    @BeforeEach
    void setUp() {
        Role role = Role.builder().name("STUDENT").build();
        role.setId(1);

        mockUser = User.builder()
                .fullName("Student Quota Test")
                .email("student@test.com")
                .role(role)
                .build();
        mockUser.setId(999);

        mockUserDetails = new CustomUserDetails(mockUser);
        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(mockUserDetails, null, mockUserDetails.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("GET /api/v1/student/quotas - Trả về danh sách hạn mức AI của học viên")
    void getMyQuotas_Success() throws Exception {
        StudentQuotaResponse hints = StudentQuotaResponse.builder()
                .featureCode("AI_WRITING_HINTS")
                .featureName("Gợi ý Writing AI")
                .usedCount(1)
                .maxLimit(5)
                .remaining(4)
                .tier("FREE")
                .resetDate(Instant.parse("2026-11-06T00:00:00Z"))
                .build();

        StudentQuotaResponse grading = StudentQuotaResponse.builder()
                .featureCode("AI_WRITING_GRADING")
                .featureName("AI chấm bài Writing")
                .usedCount(0)
                .maxLimit(5)
                .remaining(5)
                .tier("FREE")
                .resetDate(Instant.parse("2026-11-06T00:00:00Z"))
                .build();

        when(quotaService.getMyQuotas(eq(999))).thenReturn(List.of(hints, grading));

        mockMvc.perform(get("/api/v1/student/quotas")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[0].featureCode").value("AI_WRITING_HINTS"))
                .andExpect(jsonPath("$.data[0].remaining").value(4))
                .andExpect(jsonPath("$.data[1].featureCode").value("AI_WRITING_GRADING"))
                .andExpect(jsonPath("$.data[1].remaining").value(5));

        verify(quotaService).getMyQuotas(eq(999));
    }
}
