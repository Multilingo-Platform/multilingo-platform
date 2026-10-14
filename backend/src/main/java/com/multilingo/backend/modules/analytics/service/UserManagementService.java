package com.multilingo.backend.modules.analytics.service;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.analytics.dto.request.UpdateUserStatusRequest;
import com.multilingo.backend.modules.analytics.dto.response.AdminUserDetailResponse;
import com.multilingo.backend.modules.analytics.dto.response.AdminUserResponse;
import org.springframework.data.domain.Pageable;

public interface UserManagementService {

    PageResponse<AdminUserResponse> getUsers(String keyword, Boolean isActive, String subscriptionTier, Pageable pageable);

    AdminUserDetailResponse getUserDetail(Integer userId);

    AdminUserResponse updateUserStatus(Integer currentAdminId, Integer targetUserId, UpdateUserStatusRequest request, String ipAddress);
}
