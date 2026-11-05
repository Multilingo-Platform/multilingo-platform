package com.multilingo.backend.modules.vocab.repository;

import com.multilingo.backend.modules.vocab.entity.VocabTestAttempt;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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
public interface VocabTestAttemptRepository extends JpaRepository<VocabTestAttempt, Integer> {

    Optional<VocabTestAttempt> findByTestToken(String testToken);

    Optional<VocabTestAttempt> findByTestTokenAndUserId(String testToken, Integer userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT v FROM VocabTestAttempt v WHERE v.testToken = :testToken")
    Optional<VocabTestAttempt> findForUpdateByTestToken(@Param("testToken") String testToken);

    @Query("SELECT v FROM VocabTestAttempt v WHERE v.status = 'IN_PROGRESS' AND v.expiresAt < :deadline")
    List<VocabTestAttempt> findExpiredActiveAttempts(@Param("deadline") Instant deadline, Pageable pageable);

    Page<VocabTestAttempt> findByDeckIdAndUserIdOrderByCreatedAtDesc(Integer deckId, Integer userId, Pageable pageable);
}
