package com.multilingo.backend.modules.auth.repository;

import com.multilingo.backend.modules.auth.entity.UserTarget;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserTargetRepository extends JpaRepository<UserTarget, Integer> {
    Optional<UserTarget> findFirstByUserId(Integer userId);
    Optional<UserTarget> findFirstByUserIdOrderByCreatedAtDesc(Integer userId);
}
