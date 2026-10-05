package com.multilingo.backend.modules.testing.repository;

import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface TestAttemptRepository extends JpaRepository<TestAttempt, Integer> {

    /**
     * Finds an attempt only if it belongs to the specified user.
     * Used for ownership check — returns empty if attempt exists but belongs to another user.
     */
    Optional<TestAttempt> findByIdAndUserId(Integer id, Integer userId);

    /**
     * Finds an attempt with pessimistic write lock for concurrent submission safety.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM TestAttempt a WHERE a.id = :id")
    Optional<TestAttempt> findByIdForUpdate(@Param("id") Integer id);

    /**
     * Finds an attempt for update verifying user ownership.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM TestAttempt a WHERE a.id = :id AND a.userId = :userId")
    Optional<TestAttempt> findByIdAndUserIdForUpdate(@Param("id") Integer id, @Param("userId") Integer userId);

    /**
     * Finds attempts that are currently in the given status and whose deadline has expired.
     * Used by AttemptWatchdogService.
     */
    List<TestAttempt> findByStatusAndDeadlineBefore(AttemptStatus status, Instant deadline);
}
