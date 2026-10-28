package com.multilingo.backend.modules.testing.controller;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.common.exception.GlobalExceptionHandler;
import com.multilingo.backend.modules.auth.entity.Role;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.security.CustomUserDetails;
import com.multilingo.backend.modules.testing.dto.response.RecentScoreTrendItem;
import com.multilingo.backend.modules.testing.dto.response.StudentHistoryItemResponse;
import com.multilingo.backend.modules.testing.dto.response.StudentHistoryStatsResponse;
import com.multilingo.backend.modules.testing.service.StudentHistoryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class StudentHistoryControllerIT {

    private MockMvc mockMvc;

    @Mock
    private StudentHistoryService studentHistoryService;

    @InjectMocks
    private StudentHistoryController studentHistoryController;

    private CustomUserDetails mockUserDetails;

    @BeforeEach
    void setUp() {
        Role role = Role.builder().name("STUDENT").build();
        User user = User.builder()
                .email("student@example.com")
                .fullName("Test Student")
                .role(role)
                .build();
        user.setId(1);

        mockUserDetails = new CustomUserDetails(user);

        HandlerMethodArgumentResolver authPrincipalResolver = new HandlerMethodArgumentResolver() {
            @Override
            public boolean supportsParameter(MethodParameter parameter) {
                return parameter.hasParameterAnnotation(AuthenticationPrincipal.class);
            }

            @Override
            public Object resolveArgument(MethodParameter parameter,
                                          ModelAndViewContainer mavContainer,
                                          NativeWebRequest webRequest,
                                          WebDataBinderFactory binderFactory) {
                return mockUserDetails;
            }
        };

        mockMvc = MockMvcBuilders.standaloneSetup(studentHistoryController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setCustomArgumentResolvers(authPrincipalResolver)
                .build();
    }

    @Test
    @DisplayName("GET /api/v1/student/history/stats: Trả về HTTP 200 và thống kê đầy đủ")
    void getStats_ReturnsSuccess() throws Exception {
        StudentHistoryStatsResponse mockStats = StudentHistoryStatsResponse.builder()
                .totalAttempts(10)
                .completedAttempts(8)
                .inProgressAttempts(2)
                .averageScore(7.5)
                .highestScore(8.5)
                .totalPracticeMinutes(300)
                .currentStreak(4)
                .targetAchievedCount(5)
                .recentScoreTrends(List.of(
                        RecentScoreTrendItem.builder()
                                .attemptId(1)
                                .examTitle("IELTS Test 1")
                                .certType("IELTS")
                                .score(7.5)
                                .maxScore(9.0)
                                .percentage(83.3)
                                .completedAt(Instant.now())
                                .build()
                ))
                .build();

        when(studentHistoryService.getStudentStats(eq(1))).thenReturn(mockStats);

        mockMvc.perform(get("/api/v1/student/history/stats")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.totalAttempts").value(10))
                .andExpect(jsonPath("$.data.averageScore").value(7.5))
                .andExpect(jsonPath("$.data.currentStreak").value(4))
                .andExpect(jsonPath("$.data.recentScoreTrends[0].examTitle").value("IELTS Test 1"));
    }

    @Test
    @DisplayName("GET /api/v1/student/history: Trả về HTTP 200 và danh sách lượt thi phân trang")
    void getHistory_ReturnsSuccess() throws Exception {
        StudentHistoryItemResponse item = StudentHistoryItemResponse.builder()
                .attemptId(101)
                .examId(10)
                .examCode("IELTS-1")
                .examTitle("IELTS Cambridge 18")
                .examType("IELTS_ACADEMIC")
                .status("COMPLETED")
                .testMode("MOCK_TEST")
                .overallScore(7.5)
                .maxScore(9.0)
                .durationMinutes(90)
                .targetAchieved(true)
                .build();

        PageResponse<StudentHistoryItemResponse> pageResponse = PageResponse.<StudentHistoryItemResponse>builder()
                .items(List.of(item))
                .page(0)
                .size(10)
                .totalElements(1)
                .totalPages(1)
                .last(true)
                .build();

        when(studentHistoryService.getStudentHistory(
                eq(1), any(), any(), any(), any(), anyInt(), anyInt(), any()
        )).thenReturn(pageResponse);

        mockMvc.perform(get("/api/v1/student/history")
                        .param("cert", "IELTS")
                        .param("page", "0")
                        .param("size", "10")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.items[0].attemptId").value(101))
                .andExpect(jsonPath("$.data.items[0].examTitle").value("IELTS Cambridge 18"))
                .andExpect(jsonPath("$.data.items[0].overallScore").value(7.5));
    }
}
