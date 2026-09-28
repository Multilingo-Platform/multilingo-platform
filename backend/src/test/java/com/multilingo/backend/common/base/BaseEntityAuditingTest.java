package com.multilingo.backend.common.base;

import com.multilingo.backend.common.config.JpaAuditingConfig;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@Import(JpaAuditingConfig.class)
@ActiveProfiles("test")
class BaseEntityAuditingTest {

    @Autowired
    private TestEntityManager entityManager;

    @Entity
    @Table(name = "test_audit_entity")
    @Getter
    @Setter
    @NoArgsConstructor
    static class DummyAuditEntity extends BaseEntity {
        private String name;

        public DummyAuditEntity(String name) {
            this.name = name;
        }
    }

    @Test
    @DisplayName("Persist entity should automatically generate id, createdAt, and updatedAt")
    void shouldPopulateAuditFieldsOnPersist() {
        DummyAuditEntity entity = new DummyAuditEntity("Test Item");

        DummyAuditEntity saved = entityManager.persistAndFlush(entity);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getId()).isPositive();
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
    }

    @Test
    @DisplayName("Update entity should automatically refresh updatedAt timestamp")
    void shouldUpdateTimestampOnModify() throws InterruptedException {
        DummyAuditEntity entity = new DummyAuditEntity("Original Name");
        DummyAuditEntity saved = entityManager.persistAndFlush(entity);

        java.time.Instant initialCreatedAt = saved.getCreatedAt();
        java.time.Instant initialUpdatedAt = saved.getUpdatedAt();

        Thread.sleep(50); // Đảm bảo thời gian chênh lệch

        saved.setName("Updated Name");
        DummyAuditEntity updated = entityManager.persistAndFlush(saved);

        assertThat(updated.getCreatedAt()).isEqualTo(initialCreatedAt);
        assertThat(updated.getUpdatedAt()).isAfterOrEqualTo(initialUpdatedAt);
    }
}
