package com.multilingo.backend.modules.testing.repository;

import com.multilingo.backend.modules.testing.entity.WritingHintRequest;
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
public interface WritingHintRequestRepository extends JpaRepository<WritingHintRequest, Integer> {

    Optional<WritingHintRequest> findByUserIdAndRequestId(Integer userId, String requestId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM WritingHintRequest r WHERE r.userId = :userId AND r.requestId = :requestId")
    Optional<WritingHintRequest> findByUserIdAndRequestIdForUpdate(
            @Param("userId") Integer userId,
            @Param("requestId") String requestId
    );

    Optional<WritingHintRequest> findByUserIdAndStatus(Integer userId, WritingHintRequest.Status status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM WritingHintRequest r WHERE r.userId = :userId AND r.status = :status")
    Optional<WritingHintRequest> findByUserIdAndStatusForUpdate(
            @Param("userId") Integer userId,
            @Param("status") WritingHintRequest.Status status
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM WritingHintRequest r WHERE r.id = :id")
    Optional<WritingHintRequest> findByIdForUpdate(@Param("id") Integer id);

    @Query("SELECT r FROM WritingHintRequest r WHERE r.status = 'PENDING' AND r.leaseUntil <= :now")
    List<WritingHintRequest> findExpiredPendingRequests(@Param("now") Instant now);

    @Query("SELECT r FROM WritingHintRequest r WHERE r.userId = :userId AND r.status = 'PENDING' AND r.leaseUntil <= :now")
    List<WritingHintRequest> findExpiredPendingRequestsByUserId(
            @Param("userId") Integer userId,
            @Param("now") Instant now
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM WritingHintRequest r WHERE r.userId = :userId AND r.status = 'PENDING' AND r.leaseUntil <= :now ORDER BY r.id ASC")
    List<WritingHintRequest> findExpiredPendingRequestsByUserIdOrderByIdAsc(
            @Param("userId") Integer userId,
            @Param("now") Instant now
    );

    Optional<WritingHintRequest> findFirstByUserIdOrderByLastStartedAtDesc(Integer userId);

    List<WritingHintRequest> findByAttemptId(Integer attemptId);
}
