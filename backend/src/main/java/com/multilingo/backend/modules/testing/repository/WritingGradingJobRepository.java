package com.multilingo.backend.modules.testing.repository;

import com.multilingo.backend.modules.testing.entity.WritingGradingJob;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface WritingGradingJobRepository extends JpaRepository<WritingGradingJob, Integer> {

    List<WritingGradingJob> findAllByAttemptId(Integer attemptId);

    List<WritingGradingJob> findAllByAttemptIdAndPartId(Integer attemptId, Integer partId);

    List<WritingGradingJob> findAllByAttemptIdOrderByPartIdAscQuestionIdAsc(Integer attemptId);

    Optional<WritingGradingJob> findByAttemptIdAndPartIdAndQuestionId(Integer attemptId, Integer partId, String questionId);

    @Query("SELECT j.attemptId FROM WritingGradingJob j WHERE j.id = :id")
    Optional<Integer> findAttemptIdById(@Param("id") Integer id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT j FROM WritingGradingJob j WHERE j.id = :id")
    Optional<WritingGradingJob> findByIdForUpdate(@Param("id") Integer id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT j FROM WritingGradingJob j WHERE j.attemptId = :attemptId")
    List<WritingGradingJob> findAllByAttemptIdForUpdate(@Param("attemptId") Integer attemptId);

    @Query("SELECT j.id FROM WritingGradingJob j WHERE j.status IN ('READY', 'RETRY_WAIT') AND (j.nextAttemptAt IS NULL OR j.nextAttemptAt <= :now) ORDER BY j.createdAt ASC")
    List<Integer> findDueJobIds(@Param("now") Instant now, Pageable pageable);

    @Query("SELECT j.id FROM WritingGradingJob j WHERE j.status = 'RUNNING' AND j.leaseUntil < :now ORDER BY j.leaseUntil ASC")
    List<Integer> findExpiredJobIds(@Param("now") Instant now, Pageable pageable);

    @Query("SELECT j.id FROM WritingGradingJob j WHERE j.status = 'WAITING' AND (j.nextAttemptAt IS NULL OR j.nextAttemptAt <= :now) ORDER BY j.nextAttemptAt ASC")
    List<Integer> findWaitingJobIds(@Param("now") Instant now, Pageable pageable);
}
