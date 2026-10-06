package com.multilingo.backend.modules.auth.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.modules.auth.dto.request.UserCreationRequest;
import com.multilingo.backend.modules.auth.dto.request.UpdateProfileRequest;
import com.multilingo.backend.modules.auth.dto.request.ChangePasswordRequest;
import com.multilingo.backend.modules.auth.dto.response.UserResponse;
import com.multilingo.backend.modules.auth.service.UserService;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class UserController {
   UserService userService;
    @PostMapping
    public ResponseEntity<ApiResponse<UserResponse>> createUser(@RequestBody @Valid UserCreationRequest request) {
        UserResponse userResponse = userService.createUser(request);
        return ResponseEntity.ok(ApiResponse.success("Tạo tài khoản người dùng thành công", userResponse));
    }

    @org.springframework.web.bind.annotation.GetMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> getMyInfo() {
        UserResponse userResponse = userService.getMyInfo();
        return ResponseEntity.ok(ApiResponse.success("Lấy thông tin người dùng thành công", userResponse));
    }

    @org.springframework.web.bind.annotation.PutMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> updateMyInfo(@RequestBody @Valid UpdateProfileRequest request) {
        UserResponse userResponse = userService.updateMyInfo(request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật thông tin thành công", userResponse));
    }

    @org.springframework.web.bind.annotation.PutMapping("/me/password")
    public ResponseEntity<ApiResponse<Void>> changePassword(@RequestBody @Valid ChangePasswordRequest request) {
        userService.changePassword(request);
        return ResponseEntity.ok(ApiResponse.success("Đổi mật khẩu thành công", null));
    }
}
