package com.multilingo.backend.modules.auth.service;

import com.multilingo.backend.modules.auth.dto.request.UserCreationRequest;
import com.multilingo.backend.modules.auth.dto.request.UserUpdateRequest;
import com.multilingo.backend.modules.auth.dto.request.ForgotPasswordRequest;
import com.multilingo.backend.modules.auth.dto.request.ResetPasswordRequest;
import com.multilingo.backend.modules.auth.dto.response.UserResponse;

import java.util.List;

public interface UserService {
    UserResponse createUser(UserCreationRequest request);

    UserResponse getMyInfo();

    List<UserResponse> getAllUser();

    UserResponse updateUser(String userId, UserUpdateRequest request);

    void forgotPassword(ForgotPasswordRequest request);

    void resetPassword(ResetPasswordRequest request);
}