package com.multilingo.backend.common;

import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * JPA Auditing configuration for @DataJpaTest contexts.
 * Without this, @CreatedDate and @LastModifiedDate fields remain null,
 * causing NOT NULL constraint violations on BaseEntity.createdAt/updatedAt.
 */
@EnableJpaAuditing
public class JpaTestConfig {
    // No beans needed — @EnableJpaAuditing registers the AuditingEntityListener
}
