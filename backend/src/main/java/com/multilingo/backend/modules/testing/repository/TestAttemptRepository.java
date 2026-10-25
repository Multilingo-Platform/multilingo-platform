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

    long countByUserId(Integer userId);

    long countByUserIdAndStatus(Integer userId, AttemptStatus status);

    Optional<TestAttempt> findFirstByUserIdAndStatusOrderByEndTimeDesc(Integer userId, AttemptStatus status);

    @Query("SELECT AVG(a.overallScore) FROM TestAttempt a WHERE a.userId = :userId AND a.overallScore IS NOT NULL")
    Double findAverageScoreByUserId(@Param("userId") Integer userId);

    @Query("SELECT COUNT(a) FROM TestAttempt a WHERE a.examId = :examId")
    long countByExamId(@Param("examId") Integer examId);

    @Query("SELECT AVG(a.overallScore) FROM TestAttempt a WHERE a.examId = :examId AND a.overallScore IS NOT NULL")
    Double findAverageScoreByExamId(@Param("examId") Integer examId);

    @Query("SELECT COUNT(a) FROM TestAttempt a WHERE a.examId = :examId AND a.status = 'COMPLETED'")
    long countCompletedByExamId(@Param("examId") Integer examId);

    @Query("SELECT COUNT(DISTINCT a.userId) FROM TestAttempt a WHERE a.startTime >= :since")
    long countDistinctActiveUsers(@Param("since") Instant since);

    @Query("SELECT a.examId, COUNT(a) FROM TestAttempt a GROUP BY a.examId")
    List<Object[]> countAttemptsGroupByExamId();

    @Query("SELECT a.examId, COUNT(a), MAX(a.overallScore) FROM TestAttempt a WHERE a.userId = :userId AND a.status = 'COMPLETED' GROUP BY a.examId")
    List<Object[]> findUserAttemptSummariesByUserId(@Param("userId") Integer userId);
}
