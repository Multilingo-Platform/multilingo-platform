package com.multilingo.backend.modules.analytics.adapter.impl;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.analytics.adapter.UserAccountAdapter;
import com.multilingo.backend.modules.analytics.adapter.dto.UserAccountInfo;
import com.multilingo.backend.modules.auth.entity.SubscriptionTier;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.repository.RefreshTokenRepository;
import com.multilingo.backend.modules.auth.repository.UserRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class DbUserAccountAdapter implements UserAccountAdapter {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<UserAccountInfo> findUsers(String keyword, Boolean isActive, String subscriptionTier, Pageable pageable) {
        Specification<User> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (keyword != null && !keyword.isBlank()) {
                String pattern = "%" + keyword.trim().toLowerCase() + "%";
                Predicate emailPred = cb.like(cb.lower(root.get("email")), pattern);
                Predicate namePred = cb.like(cb.lower(root.get("fullName")), pattern);
                predicates.add(cb.or(emailPred, namePred));
            }

            if (isActive != null) {
                predicates.add(cb.equal(root.get("isActive"), isActive));
            }

            if (subscriptionTier != null && !subscriptionTier.isBlank()) {
                SubscriptionTier tier = resolveSubscriptionTier(subscriptionTier);
                if (tier != null) {
                    predicates.add(cb.equal(root.get("subscriptionTier"), tier));
                }
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<User> page = userRepository.findAll(spec, pageable);
        Page<UserAccountInfo> dtoPage = page.map(this::toInfo);
        return PageResponse.from(dtoPage);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<UserAccountInfo> findUserById(Integer userId) {
        return userRepository.findById(userId).map(this::toInfo);
    }

    @Override
    @Transactional
    public UserAccountInfo updateUserActiveStatus(Integer userId, boolean isActive) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        user.setIsActive(isActive);
        User saved = userRepository.save(user);
        return toInfo(saved);
    }

    @Override
    @Transactional
    public void revokeUserSessions(Integer userId) {
        refreshTokenRepository.deleteByUserId(userId);
        log.info("Revoked refresh tokens for user ID: {}", userId);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<Integer, UserAccountInfo> findUsersByIds(Set<Integer> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return Collections.emptyMap();
        }
        return userRepository.findAllById(userIds).stream()
                .map(this::toInfo)
                .collect(Collectors.toMap(UserAccountInfo::getId, Function.identity()));
    }

    @Override
    @Transactional(readOnly = true)
    public long countTotalUsers() {
        return userRepository.count();
    }

    @Override
    @Transactional(readOnly = true)
    public long countUsersByTier(String tier) {
        SubscriptionTier resolved = resolveSubscriptionTier(tier);
        return resolved != null ? userRepository.countBySubscriptionTier(resolved) : 0L;
    }

    @Override
    @Transactional(readOnly = true)
    public long countActiveUsersSince(Instant since) {
        return userRepository.countByLastLoginAtAfter(since);
    }

    private UserAccountInfo toInfo(User u) {
        String tierStr = "FREE";
        if (u.getSubscriptionTier() != null) {
            tierStr = u.getSubscriptionTier() == SubscriptionTier.PREMIUM ? "VIP" : u.getSubscriptionTier().name();
        }

        return UserAccountInfo.builder()
                .id(u.getId())
                .email(u.getEmail())
                .fullName(u.getFullName())
                .avatarUrl(u.getAvatarUrl())
                .roleName(u.getRole() != null ? u.getRole().getName() : "USER")
                .subscriptionTier(tierStr)
                .isActive(u.getIsActive())
                .nativeLanguage(u.getNativeLanguage())
                .targetLanguage(u.getTargetLanguage())
                .phone(u.getPhone())
                .premiumExpiresAt(u.getPremiumExpiresAt())
                .createdAt(u.getCreatedAt())
                .lastLoginAt(u.getLastLoginAt())
                .lastLoginIp(u.getLastLoginIp())
                .build();
    }

    private SubscriptionTier resolveSubscriptionTier(String tier) {
        if (tier == null) return null;
        String upper = tier.trim().toUpperCase();
        if ("VIP".equals(upper) || "PREMIUM".equals(upper)) {
            return SubscriptionTier.PREMIUM;
        }
        try {
            return SubscriptionTier.valueOf(upper);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
