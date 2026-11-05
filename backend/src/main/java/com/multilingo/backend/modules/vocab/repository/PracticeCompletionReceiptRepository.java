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
}
