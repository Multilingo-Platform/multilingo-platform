package com.multilingo.backend.modules.auth.service;

import com.multilingo.backend.modules.auth.dto.request.UserCreationRequest;
import com.multilingo.backend.modules.auth.dto.request.UserUpdateRequest;
import com.multilingo.backend.modules.auth.dto.request.UpdateProfileRequest;
import com.multilingo.backend.modules.auth.dto.request.ChangePasswordRequest;
import com.multilingo.backend.modules.auth.dto.request.ForgotPasswordRequest;
import com.multilingo.backend.modules.auth.dto.request.ResetPasswordRequest;
import com.multilingo.backend.modules.auth.dto.response.UserResponse;

import java.util.List;

public interface UserService {
    UserResponse createUser(UserCreationRequest request);

    UserResponse getMyInfo();

    UserResponse updateMyInfo(UpdateProfileRequest request);
    
    void changePassword(ChangePasswordRequest request);

    List<UserResponse> getAllUser();

    UserResponse updateUser(String userId, UserUpdateRequest request);

    void forgotPassword(ForgotPasswordRequest request);

    void resetPassword(ResetPasswordRequest request);
}