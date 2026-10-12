package com.multilingo.backend.modules.gamification.repository;

import com.multilingo.backend.modules.gamification.entity.UserStudyStat;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserStudyStatRepository extends JpaRepository<UserStudyStat, Integer> {

    Optional<UserStudyStat> findByUserId(Integer userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM UserStudyStat s WHERE s.userId = :userId")
    Optional<UserStudyStat> findByUserIdWithLock(@Param("userId") Integer userId);
}
