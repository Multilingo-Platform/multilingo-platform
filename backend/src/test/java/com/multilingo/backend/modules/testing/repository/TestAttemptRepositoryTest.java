package com.multilingo.backend.modules.testing.repository;

import com.multilingo.backend.common.JpaTestConfig;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
@Import(JpaTestConfig.class)
class TestAttemptRepositoryTest {

    @Autowired
    TestAttemptRepository repository;

    @Test
    void save_and_find_attempt_persists_all_new_fields() {
        Instant now = Instant.now();
        Instant deadline = now.plusSeconds(10800); // 180 minutes

        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(1)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.MOCK_TEST)
                .startTime(now)
                .deadline(deadline)
                .build();

        TestAttempt saved = repository.save(attempt);
        TestAttempt found = repository.findById(saved.getId()).orElseThrow();

        assertThat(found.getId()).isNotNull();
        assertThat(found.getTestScope()).isEqualTo(TestScope.FULL_EXAM);
        assertThat(found.getTestMode()).isEqualTo(TestMode.MOCK_TEST);
        assertThat(found.getStatus()).isEqualTo(AttemptStatus.IN_PROGRESS);
        assertThat(found.getDeadline()).isEqualTo(deadline);
        assertThat(found.getVersion()).isEqualTo(1);
    }

    @Test
    void findByIdAndUserId_returns_empty_for_wrong_user() {
        TestAttempt attempt = TestAttempt.builder()
                .userId(99)
                .examId(1)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.MOCK_TEST)
                .startTime(Instant.now())
                .build();
        TestAttempt saved = repository.save(attempt);

        Optional<TestAttempt> result = repository.findByIdAndUserId(saved.getId(), 1); // wrong user
        assertThat(result).isEmpty();
    }

    @Test
    void findByIdAndUserId_returns_attempt_for_correct_user() {
        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(1)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.MOCK_TEST)
                .startTime(Instant.now())
                .build();
        TestAttempt saved = repository.save(attempt);

        Optional<TestAttempt> result = repository.findByIdAndUserId(saved.getId(), 1);
        assertThat(result).isPresent();
        assertThat(result.get().getId()).isEqualTo(saved.getId());
    }

    @Test
    void practice_attempt_has_null_deadline() {
        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(1)
                .testScope(TestScope.SINGLE_SKILL)
                .testMode(TestMode.PRACTICE)
                .startTime(Instant.now())
                .deadline(null) // explicitly null for PRACTICE
                .build();

        TestAttempt saved = repository.save(attempt);
        assertThat(saved.getDeadline()).isNull();
    }
}
