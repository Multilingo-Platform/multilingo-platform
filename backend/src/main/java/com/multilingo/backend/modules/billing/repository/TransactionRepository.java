package com.multilingo.backend.modules.billing.repository;

import com.multilingo.backend.modules.billing.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Integer> {
    Optional<Transaction> findByVnpTxnRef(String vnpTxnRef);
}
