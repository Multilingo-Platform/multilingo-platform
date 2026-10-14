package com.multilingo.backend.modules.analytics.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.modules.analytics.dto.request.UpdateQuotaRequest;
import com.multilingo.backend.modules.analytics.dto.response.UserQuotaResponse;
import com.multilingo.backend.modules.analytics.service.QuotaService;
import com.multilingo.backend.modules.auth.security.CustomUserDetails;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/quotas")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminQuotaController {

    private final QuotaService quotaService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<UserQuotaResponse>>> getAllQuotas() {
        List<UserQuotaResponse> list = quotaService.getAllQuotas();
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @PutMapping
    public ResponseEntity<ApiResponse<UserQuotaResponse>> updateQuota(
            @Valid @RequestBody UpdateQuotaRequest request,
            HttpServletRequest httpRequest
    ) {
        Integer adminId = resolveCurrentAdminId();
        String clientIp = resolveClientIp(httpRequest);
        UserQuotaResponse result = quotaService.updateQuota(adminId, request, clientIp);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    private Integer resolveCurrentAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomUserDetails userDetails && userDetails.getUser() != null) {
            return userDetails.getUser().getId();
        }
        return 1;
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) return "127.0.0.1";
        String xf = request.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            return xf.split(",")[0].trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "127.0.0.1";
    }
}
