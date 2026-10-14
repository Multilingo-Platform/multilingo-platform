package com.multilingo.backend.modules.auth.repository;

import com.multilingo.backend.modules.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Integer>, JpaSpecificationExecutor<User> {
    Optional<User> findByEmail(String email);
    Optional<User> findByGoogleId(String googleId);
    boolean existsByEmail(String email);

    long countBySubscriptionTier(com.multilingo.backend.modules.auth.entity.SubscriptionTier subscriptionTier);
    long countByLastLoginAtAfter(java.time.Instant after);
}
