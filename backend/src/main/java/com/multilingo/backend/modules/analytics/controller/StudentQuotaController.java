package com.multilingo.backend.modules.analytics.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.analytics.dto.response.StudentQuotaResponse;
import com.multilingo.backend.modules.analytics.service.QuotaService;
import com.multilingo.backend.modules.auth.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/student/quotas")
@RequiredArgsConstructor
public class StudentQuotaController {

    private final QuotaService quotaService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<StudentQuotaResponse>>> getMyQuotas() {
        Integer userId = resolveCurrentUserId();
        List<StudentQuotaResponse> quotas = quotaService.getMyQuotas(userId);
        return ResponseEntity.ok(ApiResponse.success(quotas));
    }

    private Integer resolveCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomUserDetails userDetails && userDetails.getUser() != null) {
            return userDetails.getUser().getId();
        }
        throw new AppException(ErrorCode.UNAUTHENTICATED_ACCESS);
    }
}

