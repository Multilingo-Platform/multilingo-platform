package com.multilingo.backend.modules.billing.repository;

import com.multilingo.backend.modules.billing.entity.Transaction;
import com.multilingo.backend.modules.billing.entity.TransactionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Integer>, JpaSpecificationExecutor<Transaction> {
    Optional<Transaction> findByVnpTxnRef(String vnpTxnRef);

    Page<Transaction> findByUserIdAndStatus(Integer userId, TransactionStatus status, Pageable pageable);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t WHERE t.status = :status")
    BigDecimal sumAmountByStatus(@Param("status") TransactionStatus status);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t WHERE t.status = :status AND t.createdAt >= :after")
    BigDecimal sumAmountByStatusAndCreatedAtAfter(@Param("status") TransactionStatus status, @Param("after") Instant after);

    @Query("SELECT t FROM Transaction t WHERE t.status = :status AND t.createdAt >= :from AND t.createdAt <= :to ORDER BY t.createdAt ASC")
    List<Transaction> findByStatusAndCreatedAtBetween(@Param("status") TransactionStatus status, @Param("from") Instant from, @Param("to") Instant to);
}
