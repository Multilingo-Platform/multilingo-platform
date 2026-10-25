package com.multilingo.backend.modules.auth.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityRbacAuthorizationIT {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Guest chưa đăng nhập gọi API admin phải nhận 401 UNAUTHENTICATED_ACCESS")
    void guestAccessAdminEndpoint_ShouldReturn401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/exams"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(909));
    }

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("User thường gọi API admin phải nhận 403 FORBIDDEN")
    void userAccessAdminEndpoint_ShouldReturn403() throws Exception {
        mockMvc.perform(get("/api/v1/admin/exams"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("Không có quyền thực hiện thao tác"));
    }

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("User thường gọi API admin plans phải nhận 403 FORBIDDEN")
    void userAccessAdminPlans_ShouldReturn403() throws Exception {
        mockMvc.perform(get("/api/admin/plans"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("Không có quyền thực hiện thao tác"));
    }

    @Test
    @DisplayName("Guest hoặc User gọi API public billing plans phải nhận 200 OK")
    void guestAccessPublicBillingPlans_ShouldReturn200() throws Exception {
        mockMvc.perform(get("/api/v1/billing/plans"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }
}
