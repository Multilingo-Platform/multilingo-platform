package com.multilingo.backend.modules.vocab.security;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.auth.entity.Role;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.security.CustomUserDetails;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("VocabSecurity Unit & Identity Resolver Tests - Chống IDOR")
class VocabSecurityIntegrationTest {

    private VocabIdentityResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new VocabIdentityResolver();
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("TC_SEC_01: Trích xuất userId thành công từ CustomUserDetails trong SecurityContext")
    void requireUserId_success_whenAuthenticated() {
        User mockUser = new User();
        mockUser.setId(42);
        mockUser.setEmail("test@multilingo.com");
        Role role = new Role();
        role.setName("USER");
        mockUser.setRole(role);

        CustomUserDetails userDetails = new CustomUserDetails(mockUser);
        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(authentication);

        Integer resolvedId = resolver.requireUserId();

        assertThat(resolvedId).isEqualTo(42);
    }

    @Test
    @DisplayName("TC_SEC_02: Ném UNAUTHENTICATED_ACCESS khi SecurityContext rỗng")
    void requireUserId_throwsException_whenEmptyContext() {
        assertThatThrownBy(() -> resolver.requireUserId())
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.UNAUTHENTICATED_ACCESS);
    }

    @Test
    @DisplayName("TC_SEC_03: Ném UNAUTHENTICATED_ACCESS khi principal là String anonymous")
    void requireUserId_throwsException_whenAnonymousPrincipal() {
        UsernamePasswordAuthenticationToken anonymousToken =
                new UsernamePasswordAuthenticationToken("anonymousUser", null, null);
        SecurityContextHolder.getContext().setAuthentication(anonymousToken);

        assertThatThrownBy(() -> resolver.requireUserId())
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.UNAUTHENTICATED_ACCESS);
    }

    @Test
    @DisplayName("TC_SEC_04: Ném UNAUTHENTICATED_ACCESS khi User trong CustomUserDetails có id null")
    void requireUserId_throwsException_whenUserIdIsNull() {
        User userWithoutId = new User();
        CustomUserDetails userDetails = new CustomUserDetails(userWithoutId);
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);

        assertThatThrownBy(() -> resolver.requireUserId())
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.UNAUTHENTICATED_ACCESS);
    }
}
