package com.multilingo.backend.modules.auth.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;

import static org.junit.jupiter.api.Assertions.*;

class JwtAccessDeniedHandlerTest {

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
    private final JwtAccessDeniedHandler accessDeniedHandler = new JwtAccessDeniedHandler(objectMapper);

    @Test
    @DisplayName("handle phải ghi HTTP 403 và trả về ApiResponse của ErrorCode.FORBIDDEN")
    void handle_ShouldWriteForbiddenApiResponse() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/v1/admin/exams");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AccessDeniedException exception = new AccessDeniedException("Access Denied");

        accessDeniedHandler.handle(request, response, exception);

        assertEquals(403, response.getStatus());
        assertTrue(response.getContentType().contains("application/json"));
        String json = response.getContentAsString();
        assertTrue(json.contains("\"code\":403"));
        assertTrue(json.contains("Không có quyền thực hiện thao tác"));
    }
}
