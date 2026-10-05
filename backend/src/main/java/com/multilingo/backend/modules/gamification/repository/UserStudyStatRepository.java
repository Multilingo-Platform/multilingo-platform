package com.multilingo.backend.modules.gamification.repository;

import com.multilingo.backend.modules.gamification.entity.UserStudyStat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserStudyStatRepository extends JpaRepository<UserStudyStat, Integer> {

    Optional<UserStudyStat> findByUserId(Integer userId);
}
