package com.multilingo.backend.modules.auth.service.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.auth.dto.request.UserCreationRequest;
import com.multilingo.backend.modules.auth.dto.request.UserUpdateRequest;
import com.multilingo.backend.modules.auth.dto.response.UserResponse;
import com.multilingo.backend.modules.auth.entity.Role;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.entity.enums.RoleName;
import com.multilingo.backend.modules.auth.mapper.UserMapper;
import com.multilingo.backend.modules.auth.repository.RoleRepository;
import com.multilingo.backend.modules.auth.repository.UserRepository;
import com.multilingo.backend.modules.auth.service.UserService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;
import org.springframework.data.redis.core.StringRedisTemplate;
import java.util.concurrent.TimeUnit;
import java.util.Random;
import com.multilingo.backend.modules.auth.dto.request.ForgotPasswordRequest;
import com.multilingo.backend.modules.auth.dto.request.ResetPasswordRequest;

import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class UserServiceImpl implements UserService {

    UserRepository userRepository;
    RoleRepository roleRepository;
    UserMapper userMapper;
    PasswordEncoder passwordEncoder;
    StringRedisTemplate stringRedisTemplate;

    @Override
    @Transactional
    public UserResponse createUser(UserCreationRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new AppException(ErrorCode.EMAIL_EXISTED);
        }

        User user = userMapper.toUser(request);
        user.setPasswordHash(passwordEncoder.encode(request.getPasswordHash()));

        Role userRole = roleRepository.findByName(RoleName.USER.name())
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND));
        
        user.setRole(userRole);
        user.setIsActive(true);

        return userMapper.toUserResponse(userRepository.save(user));
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserResponse> getAllUser() {
        return userRepository.findAll().stream()
                .map(userMapper::toUserResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public UserResponse updateUser(String userId, UserUpdateRequest request) {
        User user = userRepository.findById(Integer.parseInt(userId))
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        userMapper.updateUser(user, request);

        if (request.getPasswordHash() != null && !request.getPasswordHash().isEmpty()) {
            user.setPasswordHash(passwordEncoder.encode(request.getPasswordHash()));
        }

        return userMapper.toUserResponse(userRepository.save(user));
    }

    @Override
    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        
        String otp = String.format("%06d", new Random().nextInt(999999));
        stringRedisTemplate.opsForValue().set("OTP_RESET_PWD:" + request.getEmail(), otp, 5, TimeUnit.MINUTES);
        
        log.info("Sending OTP {} to email {}", otp, request.getEmail());
    }

    @Override
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        String otpInRedis = stringRedisTemplate.opsForValue().get("OTP_RESET_PWD:" + request.getEmail());
        
        if (otpInRedis == null) {
            throw new AppException(ErrorCode.OTP_EXPIRED);
        }
        
        if (!otpInRedis.equals(request.getOtp())) {
            throw new AppException(ErrorCode.INVALID_OTP);
        }
        
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        
        stringRedisTemplate.delete("OTP_RESET_PWD:" + request.getEmail());
    }
}