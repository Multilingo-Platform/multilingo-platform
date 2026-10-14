package com.multilingo.backend.modules.analytics.repository;

import com.multilingo.backend.modules.analytics.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.time.Instant;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Integer>, JpaSpecificationExecutor<AuditLog> {

    Page<AuditLog> findByAction(String action, Pageable pageable);

    Page<AuditLog> findByCreatedAtBetween(Instant from, Instant to, Pageable pageable);

    Page<AuditLog> findByActionAndCreatedAtBetween(String action, Instant from, Instant to, Pageable pageable);
}
