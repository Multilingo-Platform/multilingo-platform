package com.multilingo.backend.modules.auth.service;

import com.multilingo.backend.modules.auth.dto.request.UserCreationRequest;
import com.multilingo.backend.modules.auth.dto.request.UserUpdateRequest;
import com.multilingo.backend.modules.auth.dto.response.UserResponse;
import java.util.List;

public interface UserService {
    UserResponse createUser(UserCreationRequest request);
    List<UserResponse> getAllUser();
    UserResponse updateUser(String userId, UserUpdateRequest request);
    void forgotPassword(com.multilingo.backend.modules.auth.dto.request.ForgotPasswordRequest request);
    void resetPassword(com.multilingo.backend.modules.auth.dto.request.ResetPasswordRequest request);
}
