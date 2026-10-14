package com.multilingo.backend.modules.analytics.adapter;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.analytics.adapter.dto.UserAccountInfo;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

public interface UserAccountAdapter {

    PageResponse<UserAccountInfo> findUsers(String keyword, Boolean isActive, String subscriptionTier, Pageable pageable);

    Optional<UserAccountInfo> findUserById(Integer userId);

    UserAccountInfo updateUserActiveStatus(Integer userId, boolean isActive);

    void revokeUserSessions(Integer userId);

    Map<Integer, UserAccountInfo> findUsersByIds(Set<Integer> userIds);

    long countTotalUsers();

    long countUsersByTier(String tier);

    long countActiveUsersSince(Instant since);
}
