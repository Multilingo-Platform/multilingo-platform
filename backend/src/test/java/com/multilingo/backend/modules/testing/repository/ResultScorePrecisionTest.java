package com.multilingo.backend.modules.testing.repository;

import com.multilingo.backend.common.JpaTestConfig;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
@Import(JpaTestConfig.class)
class ResultScorePrecisionTest {

    @Autowired
    private TestAttemptRepository attemptRepository;

    @Autowired
    private AttemptAnswerRepository answerRepository;

    @Autowired
    private EntityManager entityManager;

    @Test
    @DisplayName("Should successfully persist, flush, and reload raw score 200.00 without numeric overflow")
    void persistAndReload_rawScore200_succeeds() {
        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(10)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.MOCK_TEST)
                .status(AttemptStatus.COMPLETED)
                .startTime(Instant.now().minusSeconds(3600))
                .endTime(Instant.now())
                .overallScore(new BigDecimal("200.00"))
                .build();

        TestAttempt savedAttempt = attemptRepository.save(attempt);

        AttemptAnswer answer = AttemptAnswer.builder()
                .attempt(savedAttempt)
                .partId(1)
                .userAnswers(Map.of("q1", "A"))
                .earnedScore(new BigDecimal("200.00"))
                .build();

        AttemptAnswer savedAnswer = answerRepository.save(answer);

        entityManager.flush();
        entityManager.clear();

        TestAttempt reloadedAttempt = attemptRepository.findById(savedAttempt.getId()).orElseThrow();
        AttemptAnswer reloadedAnswer = answerRepository.findById(savedAnswer.getId()).orElseThrow();

        assertThat(reloadedAttempt.getOverallScore()).isEqualByComparingTo("200.00");
        assertThat(reloadedAnswer.getEarnedScore()).isEqualByComparingTo("200.00");
    }

    @Test
    @DisplayName("Should preserve existing legacy score scale and value like 9.25")
    void persistAndReload_legacyScore9_25_preserved() {
        TestAttempt attempt = TestAttempt.builder()
                .userId(2)
                .examId(11)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.MOCK_TEST)
                .status(AttemptStatus.COMPLETED)
                .startTime(Instant.now().minusSeconds(1800))
                .endTime(Instant.now())
                .overallScore(new BigDecimal("9.25"))
                .build();

        TestAttempt savedAttempt = attemptRepository.save(attempt);

        AttemptAnswer answer = AttemptAnswer.builder()
                .attempt(savedAttempt)
                .partId(2)
                .userAnswers(Map.of("q2", "B"))
                .earnedScore(new BigDecimal("9.25"))
                .build();

        AttemptAnswer savedAnswer = answerRepository.save(answer);

        entityManager.flush();
        entityManager.clear();

        TestAttempt reloadedAttempt = attemptRepository.findById(savedAttempt.getId()).orElseThrow();
        AttemptAnswer reloadedAnswer = answerRepository.findById(savedAnswer.getId()).orElseThrow();

        assertThat(reloadedAttempt.getOverallScore()).isEqualByComparingTo("9.25");
        assertThat(reloadedAnswer.getEarnedScore()).isEqualByComparingTo("9.25");
    }
}
