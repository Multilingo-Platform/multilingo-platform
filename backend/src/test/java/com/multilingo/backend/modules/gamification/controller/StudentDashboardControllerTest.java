package com.multilingo.backend.modules.gamification.controller;

import com.multilingo.backend.modules.auth.entity.Role;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.security.CustomUserDetails;
import com.multilingo.backend.modules.auth.security.CustomUserDetailsService;
import com.multilingo.backend.modules.auth.security.JwtTokenProvider;
import com.multilingo.backend.modules.gamification.dto.dashboard.ExamStatsDto;
import com.multilingo.backend.modules.gamification.dto.dashboard.StreakStatsDto;
import com.multilingo.backend.modules.gamification.dto.dashboard.StudentDashboardResponse;
import com.multilingo.backend.modules.gamification.dto.dashboard.UserProfileSummary;
import com.multilingo.backend.modules.gamification.dto.dashboard.VocabStatsDto;
import com.multilingo.backend.modules.gamification.service.StudentDashboardService;
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

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(StudentDashboardController.class)
@AutoConfigureMockMvc(addFilters = false)
class StudentDashboardControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private StudentDashboardService studentDashboardService;

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
                .fullName("Nguyễn Hữu Giáp")
                .role(role)
                .build();
        mockUser.setId(10);

        mockUserDetails = new CustomUserDetails(mockUser);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(mockUserDetails, null, mockUserDetails.getAuthorities())
        );
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("TC_DASHBOARD_GET_01: Authenticated user gets 200 OK and dashboard data")
    void getDashboard_Success_Returns200() throws Exception {
        StudentDashboardResponse response = StudentDashboardResponse.builder()
                .isNewUser(false)
                .userProfile(UserProfileSummary.builder().id(10).fullName("Nguyễn Hữu Giáp").build())
                .streak(StreakStatsDto.builder().currentStreak(5).highestStreak(10).totalLearningMinutes(120).build())
                .examStats(ExamStatsDto.builder().totalExamsTaken(3L).averageScore(8.0).build())
                .vocabStats(VocabStatsDto.builder().totalWords(25L).masteredWords(15L).masteryRate(60.0).build())
                .build();

        when(studentDashboardService.getStudentDashboard(10, "THIS_WEEK", null)).thenReturn(response);

        mockMvc.perform(get("/api/v1/student/dashboard")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.message").value("Lấy dữ liệu bảng điều khiển thành công"))
                .andExpect(jsonPath("$.data.isNewUser").value(false))
                .andExpect(jsonPath("$.data.userProfile.fullName").value("Nguyễn Hữu Giáp"))
                .andExpect(jsonPath("$.data.streak.currentStreak").value(5))
                .andExpect(jsonPath("$.data.examStats.totalExamsTaken").value(3))
                .andExpect(jsonPath("$.data.vocabStats.masteryRate").value(60.0));

        verify(studentDashboardService).getStudentDashboard(10, "THIS_WEEK", null);
    }

    @Test
    @DisplayName("TC_DASHBOARD_TIME_01 & TC_DASHBOARD_HEAT_01: Passes query params timeRange and year to service")
    void getDashboard_WithQueryParams_PassesToService() throws Exception {
        StudentDashboardResponse response = StudentDashboardResponse.builder()
                .isNewUser(false)
                .build();

        when(studentDashboardService.getStudentDashboard(10, "THIS_MONTH", 2025)).thenReturn(response);

        mockMvc.perform(get("/api/v1/student/dashboard")
                        .param("timeRange", "THIS_MONTH")
                        .param("year", "2025")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(studentDashboardService).getStudentDashboard(10, "THIS_MONTH", 2025);
    }

    @Test
    @DisplayName("TC_DASHBOARD_SEC_02: IDOR Defense - Ignores userId query param and uses authenticated principal")
    void getDashboard_IgnoresUserIdQueryParam_UsesTokenPrincipal() throws Exception {
        StudentDashboardResponse response = StudentDashboardResponse.builder()
                .isNewUser(false)
                .build();

        when(studentDashboardService.getStudentDashboard(10, "THIS_WEEK", null)).thenReturn(response);

        mockMvc.perform(get("/api/v1/student/dashboard")
                        .param("userId", "999") // attacker attempts to view user 999's dashboard
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        // Verifies service was called with 10 (from token), NOT 999
        verify(studentDashboardService).getStudentDashboard(eq(10), eq("THIS_WEEK"), eq(null));
    }
}
