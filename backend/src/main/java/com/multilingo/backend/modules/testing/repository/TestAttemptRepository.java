package com.multilingo.backend.modules.testing.repository;

import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import org.springframework.data.jpa.repository.JpaRepository;
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
     * Finds attempts that are currently in the given status and whose deadline has expired.
     * Used by AttemptWatchdogService.
     */
    List<TestAttempt> findByStatusAndDeadlineBefore(AttemptStatus status, Instant deadline);
}
