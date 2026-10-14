package com.multilingo.backend.modules.auth.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.auth.dto.GoogleTokenPayload;
import com.multilingo.backend.modules.auth.dto.request.GoogleLoginRequest;
import com.multilingo.backend.modules.auth.dto.response.AuthenticationResponse;
import com.multilingo.backend.modules.auth.entity.RefreshToken;
import com.multilingo.backend.modules.auth.entity.Role;
import com.multilingo.backend.modules.auth.entity.SubscriptionTier;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.entity.enums.RoleName;
import com.multilingo.backend.modules.auth.repository.RefreshTokenRepository;
import com.multilingo.backend.modules.auth.repository.RoleRepository;
import com.multilingo.backend.modules.auth.repository.UserRepository;
import com.multilingo.backend.modules.auth.security.JwtTokenProvider;
import com.multilingo.backend.modules.auth.service.impl.AuthenServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthenServiceGoogleLoginTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private StringRedisTemplate stringRedisTemplate;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private RoleRepository roleRepository;

    @Mock
    private GoogleTokenVerifierService googleTokenVerifierService;

    @InjectMocks
    private AuthenServiceImpl authenService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(authenService, "refreshTokenExpirationMs", 604800000L);
    }

    @Test
    @DisplayName("TC_AUTH_GOOGLE_01: Người dùng mới đăng nhập Google -> Tự động tạo tài khoản với role USER và cấp token")
    void testLoginWithGoogle_NewUser_Success() {
        GoogleLoginRequest request = new GoogleLoginRequest("valid.google.id.token");
        GoogleTokenPayload payload = GoogleTokenPayload.builder()
                .sub("google_sub_1001")
                .email("newstudent@gmail.com")
                .fullName("New Student")
                .avatarUrl("https://photo.google.com/avatar.jpg")
                .emailVerified(true)
                .build();

        Role userRole = Role.builder().name(RoleName.USER.name()).build();
        User savedUser = User.builder()
                .email("newstudent@gmail.com")
                .fullName("New Student")
                .avatarUrl("https://photo.google.com/avatar.jpg")
                .googleId("google_sub_1001")
                .role(userRole)
                .isActive(true)
                .subscriptionTier(SubscriptionTier.FREE)
                .build();

        when(googleTokenVerifierService.verify("valid.google.id.token")).thenReturn(payload);
        when(userRepository.findByGoogleId("google_sub_1001")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("newstudent@gmail.com")).thenReturn(Optional.empty());
        when(roleRepository.findByName(RoleName.USER.name())).thenReturn(Optional.of(userRole));
        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(jwtTokenProvider.generateToken(any(User.class))).thenReturn("jwt.access.token");

        AuthenticationResponse response = authenService.loginWithGoogle(request);

        assertNotNull(response);
        assertEquals("jwt.access.token", response.getAccessToken());
        assertNotNull(response.getRefreshToken());

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        User createdUser = userCaptor.getValue();
        assertEquals("newstudent@gmail.com", createdUser.getEmail());
        assertEquals("google_sub_1001", createdUser.getGoogleId());
        assertEquals(userRole, createdUser.getRole());
        assertTrue(createdUser.getIsActive());
        assertNull(createdUser.getPasswordHash());

        verify(refreshTokenRepository).save(any(RefreshToken.class));
    }

    @Test
    @DisplayName("TC_AUTH_GOOGLE_02: Người dùng đã liên kết Google trước đó -> Đăng nhập thành công và cập nhật lastLoginAt")
    void testLoginWithGoogle_ExistingGoogleUser_Success() {
        GoogleLoginRequest request = new GoogleLoginRequest("valid.existing.token");
        GoogleTokenPayload payload = GoogleTokenPayload.builder()
                .sub("google_sub_existing")
                .email("existing@gmail.com")
                .fullName("Existing Student")
                .emailVerified(true)
                .build();

        Role userRole = Role.builder().name(RoleName.USER.name()).build();
        User existingUser = User.builder()
                .email("existing@gmail.com")
                .googleId("google_sub_existing")
                .role(userRole)
                .isActive(true)
                .build();

        when(googleTokenVerifierService.verify("valid.existing.token")).thenReturn(payload);
        when(userRepository.findByGoogleId("google_sub_existing")).thenReturn(Optional.of(existingUser));
        when(userRepository.save(existingUser)).thenReturn(existingUser);
        when(jwtTokenProvider.generateToken(existingUser)).thenReturn("jwt.existing.token");

        AuthenticationResponse response = authenService.loginWithGoogle(request);

        assertNotNull(response);
        assertEquals("jwt.existing.token", response.getAccessToken());
        assertNotNull(existingUser.getLastLoginAt());
        verify(userRepository).save(existingUser);
        verify(userRepository, never()).findByEmail(anyString());
    }

    @Test
    @DisplayName("TC_AUTH_GOOGLE_03: Email đã có trong hệ thống -> Tự động liên kết googleId và giữ nguyên thông tin cũ")
    void testLoginWithGoogle_ExistingEmailUser_AutoLink_Success() {
        GoogleLoginRequest request = new GoogleLoginRequest("valid.link.token");
        GoogleTokenPayload payload = GoogleTokenPayload.builder()
                .sub("google_sub_link")
                .email("user_password@example.com")
                .fullName("Original Name")
                .avatarUrl("https://lh3.google.com/new_photo.png")
                .emailVerified(true)
                .build();

        Role userRole = Role.builder().name(RoleName.USER.name()).build();
        User existingUser = User.builder()
                .email("user_password@example.com")
                .passwordHash("$2a$10$hashedPassword")
                .googleId(null)
                .avatarUrl(null)
                .role(userRole)
                .isActive(true)
                .build();

        when(googleTokenVerifierService.verify("valid.link.token")).thenReturn(payload);
        when(userRepository.findByGoogleId("google_sub_link")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("user_password@example.com")).thenReturn(Optional.of(existingUser));
        when(userRepository.save(existingUser)).thenReturn(existingUser);
        when(jwtTokenProvider.generateToken(existingUser)).thenReturn("jwt.linked.token");

        AuthenticationResponse response = authenService.loginWithGoogle(request);

        assertNotNull(response);
        assertEquals("jwt.linked.token", response.getAccessToken());
        assertEquals("google_sub_link", existingUser.getGoogleId());
        assertEquals("https://lh3.google.com/new_photo.png", existingUser.getAvatarUrl());
        assertEquals("$2a$10$hashedPassword", existingUser.getPasswordHash());
        verify(userRepository).save(existingUser);
    }

    @Test
    @DisplayName("TC_AUTH_GOOGLE_09: Tài khoản bị khóa (isActive = false) -> Ném AppException ACCOUNT_INACTIVE")
    void testLoginWithGoogle_InactiveUser_ThrowsAccountInactive() {
        GoogleLoginRequest request = new GoogleLoginRequest("valid.inactive.token");
        GoogleTokenPayload payload = GoogleTokenPayload.builder()
                .sub("google_sub_inactive")
                .email("locked@gmail.com")
                .emailVerified(true)
                .build();

        User lockedUser = User.builder()
                .email("locked@gmail.com")
                .googleId("google_sub_inactive")
                .isActive(false)
                .build();

        when(googleTokenVerifierService.verify("valid.inactive.token")).thenReturn(payload);
        when(userRepository.findByGoogleId("google_sub_inactive")).thenReturn(Optional.of(lockedUser));

        AppException ex = assertThrows(AppException.class, () -> authenService.loginWithGoogle(request));
        assertEquals(ErrorCode.ACCOUNT_INACTIVE, ex.getErrorCode());
        verify(jwtTokenProvider, never()).generateToken(any());
    }

    @Test
    @DisplayName("Ném ROLE_NOT_FOUND khi role mặc định USER không tồn tại trong hệ thống")
    void testLoginWithGoogle_RoleNotFound_ThrowsRoleNotFound() {
        GoogleLoginRequest request = new GoogleLoginRequest("valid.new.token");
        GoogleTokenPayload payload = GoogleTokenPayload.builder()
                .sub("google_sub_norole")
                .email("norole@gmail.com")
                .emailVerified(true)
                .build();

        when(googleTokenVerifierService.verify("valid.new.token")).thenReturn(payload);
        when(userRepository.findByGoogleId("google_sub_norole")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("norole@gmail.com")).thenReturn(Optional.empty());
        when(roleRepository.findByName(RoleName.USER.name())).thenReturn(Optional.empty());

        AppException ex = assertThrows(AppException.class, () -> authenService.loginWithGoogle(request));
        assertEquals(ErrorCode.RESOURCE_NOT_FOUND, ex.getErrorCode());
    }
}
