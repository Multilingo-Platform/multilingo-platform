package com.multilingo.backend.modules.auth.service.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.auth.dto.request.LoginRequest;
import com.multilingo.backend.modules.auth.dto.response.AuthenticationResponse;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.repository.UserRepository;
import com.multilingo.backend.modules.auth.security.JwtTokenProvider;
import com.multilingo.backend.modules.auth.service.AuthenService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import org.springframework.data.redis.core.StringRedisTemplate;
import com.multilingo.backend.modules.auth.dto.request.LogoutRequest;
import java.util.Date;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@org.springframework.transaction.annotation.Transactional
public class AuthenServiceImpl implements AuthenService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final StringRedisTemplate stringRedisTemplate;
    private final com.multilingo.backend.modules.auth.repository.RefreshTokenRepository refreshTokenRepository;

    @org.springframework.beans.factory.annotation.Value("${app.jwt.refresh-expiration-ms:604800000}")
    private long refreshTokenExpirationMs;

    @Override
    public AuthenticationResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new AppException(ErrorCode.WRONG_PASSWORD);
        }

        String token = jwtTokenProvider.generateToken(user);
        
        // Generate Refresh Token
        String refreshTokenString = java.util.UUID.randomUUID().toString();
        com.multilingo.backend.modules.auth.entity.RefreshToken refreshToken = com.multilingo.backend.modules.auth.entity.RefreshToken.builder()
                .user(user)
                .token(refreshTokenString)
                .expiresAt(java.time.Instant.now().plusMillis(refreshTokenExpirationMs))
                .isRevoked(false)
                .build();
        refreshTokenRepository.save(refreshToken);

        return AuthenticationResponse.builder()
                .accessToken(token)
                .refreshToken(refreshTokenString)
                .build();
    }

    @Override
    public void logout(LogoutRequest request) {
        String token = request.getToken();
        if (token != null && jwtTokenProvider.validateToken(token)) {
            String jti = jwtTokenProvider.getJtiFromJWT(token);
            Date expiration = jwtTokenProvider.getExpirationFromJWT(token);
            long ttl = expiration.getTime() - System.currentTimeMillis();

            if (ttl > 0) {
                stringRedisTemplate.opsForValue().set("BLACKLIST_TOKEN:" + jti, "invalid", ttl, TimeUnit.MILLISECONDS);
            }
            
            // Revoke all refresh tokens for this user
            String email = jwtTokenProvider.getEmailFromJWT(token);
            userRepository.findByEmail(email).ifPresent(user -> {
                refreshTokenRepository.revokeAllUserTokens(user);
            });
        }
    }

    @Override
    public AuthenticationResponse refreshToken(String refreshTokenString) {
        if (refreshTokenString == null || refreshTokenString.isEmpty()) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        com.multilingo.backend.modules.auth.entity.RefreshToken refreshToken = refreshTokenRepository.findByToken(refreshTokenString)
                .orElseThrow(() -> new AppException(ErrorCode.UNAUTHORIZED));

        if (refreshToken.getIsRevoked() || refreshToken.getExpiresAt().isBefore(java.time.Instant.now())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        User user = refreshToken.getUser();
        String newAccessToken = jwtTokenProvider.generateToken(user);

        return AuthenticationResponse.builder()
                .accessToken(newAccessToken)
                .build();
    }
}
