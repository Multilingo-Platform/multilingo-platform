package com.multilingo.backend.modules.analytics.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.analytics.dto.request.UpdateUserStatusRequest;
import com.multilingo.backend.modules.analytics.dto.response.AdminUserDetailResponse;
import com.multilingo.backend.modules.analytics.dto.response.AdminUserResponse;
import com.multilingo.backend.modules.analytics.service.UserManagementService;
import com.multilingo.backend.modules.auth.security.CustomUserDetails;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final UserManagementService userManagementService;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<AdminUserResponse>>> getUsers(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Boolean isActive,
            @RequestParam(required = false) String subscriptionTier,
            @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        PageResponse<AdminUserResponse> result = userManagementService.getUsers(keyword, isActive, subscriptionTier, pageable);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AdminUserDetailResponse>> getUserDetail(@PathVariable Integer id) {
        AdminUserDetailResponse result = userManagementService.getUserDetail(id);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<ApiResponse<AdminUserResponse>> updateUserStatus(
            @PathVariable Integer id,
            @Valid @RequestBody UpdateUserStatusRequest request,
            HttpServletRequest httpRequest
    ) {
        Integer adminId = resolveCurrentAdminId();
        String clientIp = resolveClientIp(httpRequest);
        AdminUserResponse result = userManagementService.updateUserStatus(adminId, id, request, clientIp);
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
