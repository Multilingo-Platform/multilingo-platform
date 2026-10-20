package com.multilingo.backend.modules.testing.repository;

import com.multilingo.backend.modules.testing.entity.DictionaryLookupRequestRecord;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface DictionaryLookupRequestRepository extends JpaRepository<DictionaryLookupRequestRecord, Integer> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM DictionaryLookupRequestRecord r WHERE r.userId = :userId AND r.requestId = :requestId")
    Optional<DictionaryLookupRequestRecord> findByUserIdAndRequestIdForUpdate(
            @Param("userId") Integer userId, @Param("requestId") String requestId);

    Optional<DictionaryLookupRequestRecord> findFirstByUserIdOrderByLastStartedAtDesc(Integer userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM DictionaryLookupRequestRecord r WHERE r.userId = :userId AND r.status = :status")
    List<DictionaryLookupRequestRecord> findByUserIdAndStatusForUpdate(
            @Param("userId") Integer userId, @Param("status") DictionaryLookupRequestRecord.Status status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM DictionaryLookupRequestRecord r WHERE r.id = :id")
    Optional<DictionaryLookupRequestRecord> findByIdForUpdate(@Param("id") Integer id);

    @Query("SELECT DISTINCT r.userId FROM DictionaryLookupRequestRecord r WHERE r.status = 'PENDING' AND r.leaseUntil <= :now ORDER BY r.userId")
    List<Integer> findDistinctExpiredPendingUserIds(@Param("now") Instant now);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM DictionaryLookupRequestRecord r WHERE r.userId = :userId AND r.status = 'PENDING' AND r.leaseUntil <= :now ORDER BY r.id ASC")
    List<DictionaryLookupRequestRecord> findExpiredPendingForUserForUpdate(
            @Param("userId") Integer userId, @Param("now") Instant now);
}
