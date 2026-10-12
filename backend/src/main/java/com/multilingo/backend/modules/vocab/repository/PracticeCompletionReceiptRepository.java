package com.multilingo.backend.modules.vocab.repository;

import com.multilingo.backend.modules.vocab.entity.PracticeCompletionReceipt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;

@Repository
public interface PracticeCompletionReceiptRepository extends JpaRepository<PracticeCompletionReceipt, Integer> {

    Optional<PracticeCompletionReceipt> findByUserIdAndSessionId(Integer userId, String sessionId);

    @Modifying
    @Query(value = "INSERT INTO practice_completion_receipts (user_id, session_id, request_hash, result_json, session_expires_at, processed_at, retain_until, created_at, updated_at) " +
            "VALUES (:userId, :sessionId, :requestHash, CAST(:resultJson AS jsonb), :sessionExpiresAt, :processedAt, :retainUntil, :now, :now) " +
            "ON CONFLICT (user_id, session_id) DO NOTHING", nativeQuery = true)
    int reserveReceipt(
            @Param("userId") Integer userId,
            @Param("sessionId") String sessionId,
            @Param("requestHash") String requestHash,
            @Param("resultJson") String resultJson,
            @Param("sessionExpiresAt") Instant sessionExpiresAt,
            @Param("processedAt") Instant processedAt,
            @Param("retainUntil") Instant retainUntil,
            @Param("now") Instant now
    );

    @Modifying
    @Query(value = "UPDATE practice_completion_receipts SET result_json = CAST(:resultJson AS jsonb), updated_at = :now WHERE user_id = :userId AND session_id = :sessionId", nativeQuery = true)
    int updateResultJson(
            @Param("userId") Integer userId,
            @Param("sessionId") String sessionId,
            @Param("resultJson") String resultJson,
            @Param("now") Instant now
    );

    @Modifying
    @Query(value = "DELETE FROM practice_completion_receipts WHERE retain_until < :now AND session_expires_at < :now", nativeQuery = true)
    int deleteExpiredReceipts(@Param("now") Instant now);
}
