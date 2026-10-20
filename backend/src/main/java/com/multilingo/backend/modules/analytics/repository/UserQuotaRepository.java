package com.multilingo.backend.modules.analytics.repository;

import com.multilingo.backend.modules.analytics.entity.UserQuota;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserQuotaRepository extends JpaRepository<UserQuota, Integer> {

    Optional<UserQuota> findByUserIdAndFeatureCode(Integer userId, String featureCode);
    List<UserQuota> findAllByUserIdAndFeatureCode(Integer userId, String featureCode);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT q FROM UserQuota q WHERE q.userId = :userId AND q.featureCode = :featureCode")
    List<UserQuota> findAllByUserIdAndFeatureCodeForUpdate(
            @Param("userId") Integer userId,
            @Param("featureCode") String featureCode
    );

    List<UserQuota> findByFeatureCode(String featureCode);

    /** Atomic first-use provisioning; the partial unique index is installed by the dictionary migration. */
    @Modifying
    @Query(value = "INSERT INTO user_quotas (user_id, feature_code, used_count, max_limit, reset_date, created_at, updated_at) " +
            "VALUES (:userId, 'DICTIONARY_LOOKUP', 0, :maxLimit, :resetDate, :now, :now) " +
            "ON CONFLICT (user_id, feature_code) WHERE feature_code = 'DICTIONARY_LOOKUP' DO NOTHING", nativeQuery = true)
    int insertDictionaryLookupQuotaIfAbsent(
            @Param("userId") Integer userId,
            @Param("maxLimit") Integer maxLimit,
            @Param("now") Instant now,
            @Param("resetDate") Instant resetDate
    );
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT q FROM UserQuota q WHERE q.id = :id")
    Optional<UserQuota> findByIdForUpdate(@Param("id") Integer id);

    @Query("SELECT DISTINCT q.featureCode FROM UserQuota q ORDER BY q.featureCode ASC")
    List<String> findDistinctFeatureCodes();
    @Modifying(flushAutomatically = true)
    @Query("UPDATE UserQuota q SET q.usedCount = q.usedCount + 1, q.updatedAt = :now " +
           "WHERE q.id = :id " +
           "AND q.resetDate = :expectedResetDate " +
           "AND q.resetDate > :now " +
           "AND q.usedCount < q.maxLimit " +
           "AND q.usedCount >= 0")
    int conditionalIncrement(
            @Param("id") Integer id,
            @Param("expectedResetDate") Instant expectedResetDate,
            @Param("now") Instant now
    );

    @Modifying(flushAutomatically = true)
    @Query("UPDATE UserQuota q SET q.usedCount = q.usedCount - 1, q.updatedAt = :now " +
           "WHERE q.id = :id " +
           "AND q.resetDate = :expectedResetDate " +
           "AND q.usedCount > 0")
    int conditionalDecrement(
            @Param("id") Integer id,
            @Param("expectedResetDate") Instant expectedResetDate,
            @Param("now") Instant now
    );
}
