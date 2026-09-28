package com.multilingo.backend.common.base;

import com.multilingo.backend.common.config.JpaAuditingConfig;
import com.multilingo.backend.modules.auth.entity.*;
import com.multilingo.backend.modules.billing.entity.*;
import com.multilingo.backend.modules.exam.entity.*;
import com.multilingo.backend.modules.testing.entity.*;
import com.multilingo.backend.modules.vocab.entity.*;
import com.multilingo.backend.modules.gamification.entity.*;
import com.multilingo.backend.modules.analytics.entity.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@Import(JpaAuditingConfig.class)
@ActiveProfiles("test")
class JpaEntitiesMappingTest {

    @Autowired
    private TestEntityManager entityManager;

    @Test
    @DisplayName("Should persist and load Auth module entities correctly with intra-module FK")
    void testAuthEntities() {
        Role role = Role.builder().name("ROLE_STUDENT").description("Student Role").build();
        Role savedRole = entityManager.persistAndFlush(role);
        assertThat(savedRole.getId()).isPositive();
        assertThat(savedRole.getCreatedAt()).isNotNull();

        User user = User.builder()
                .email("test@example.com")
                .fullName("Test User")
                .role(savedRole)
                .build();
        User savedUser = entityManager.persistAndFlush(user);
        assertThat(savedUser.getId()).isPositive();
        assertThat(savedUser.getRole().getName()).isEqualTo("ROLE_STUDENT");

        UserTarget target = UserTarget.builder()
                .user(savedUser)
                .targetCertificate("IELTS_AC")
                .targetScore(new BigDecimal("7.5"))
                .build();
        UserTarget savedTarget = entityManager.persistAndFlush(target);
        assertThat(savedTarget.getId()).isPositive();
        assertThat(savedTarget.getUser().getId()).isEqualTo(savedUser.getId());
    }

    @Test
    @DisplayName("Should persist Billing module entities with intra-module FK and loose userId")
    void testBillingEntities() {
        SubscriptionPlan plan = SubscriptionPlan.builder()
                .code("VIP_1M")
                .name("VIP 1 Month")
                .price(new BigDecimal("199000.00"))
                .durationDays(30)
                .build();
        SubscriptionPlan savedPlan = entityManager.persistAndFlush(plan);
        assertThat(savedPlan.getId()).isPositive();

        Transaction tx = Transaction.builder()
                .userId(1) // Loose reference to Auth service
                .plan(savedPlan) // Intra-module FK
                .vnpTxnRef("TXN_123456")
                .amount(new BigDecimal("199000.00"))
                .status("SUCCESS")
                .build();
        Transaction savedTx = entityManager.persistAndFlush(tx);
        assertThat(savedTx.getId()).isPositive();
        assertThat(savedTx.getPlan().getId()).isEqualTo(savedPlan.getId());
    }

    @Test
    @DisplayName("Should persist Exam module entities with hierarchical intra-module FK")
    void testExamEntities() {
        Exam exam = Exam.builder()
                .code("cam-18-test-1")
                .title("Cambridge IELTS 18 Test 1")
                .type("IELTS")
                .durationMinutes(60)
                .build();
        Exam savedExam = entityManager.persistAndFlush(exam);
        assertThat(savedExam.getId()).isPositive();

        ExamSection section = ExamSection.builder()
                .exam(savedExam)
                .skillType("READING")
                .title("Reading Passage 1")
                .build();
        ExamSection savedSection = entityManager.persistAndFlush(section);
        assertThat(savedSection.getId()).isPositive();
        assertThat(savedSection.getExam().getId()).isEqualTo(savedExam.getId());

        Map<String, Object> jsonContent = new HashMap<>();
        jsonContent.put("passage", "Sample passage text");
        jsonContent.put("questions", 13);

        ExamPart part = ExamPart.builder()
                .section(savedSection)
                .partNumber(1)
                .contentData(jsonContent)
                .build();
        ExamPart savedPart = entityManager.persistAndFlush(part);
        assertThat(savedPart.getId()).isPositive();
        assertThat(savedPart.getSection().getId()).isEqualTo(savedSection.getId());
        assertThat(savedPart.getContentData()).isNotNull();
    }

    @Test
    @DisplayName("Should persist Testing module entities with intra-module FK")
    void testTestingEntities() {
        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(1)
                .startTime(Instant.now())
                .build();
        TestAttempt savedAttempt = entityManager.persistAndFlush(attempt);
        assertThat(savedAttempt.getId()).isPositive();

        Map<String, Object> answers = new HashMap<>();
        answers.put("q1", "A");

        AttemptAnswer answer = AttemptAnswer.builder()
                .attempt(savedAttempt)
                .partId(1)
                .userAnswers(answers)
                .build();
        AttemptAnswer savedAnswer = entityManager.persistAndFlush(answer);
        assertThat(savedAnswer.getId()).isPositive();
        assertThat(savedAnswer.getAttempt().getId()).isEqualTo(savedAttempt.getId());
    }

    @Test
    @DisplayName("Should persist Vocab module entities with Flashcard intra-module FK")
    void testVocabEntities() {
        DictionaryWord word = DictionaryWord.builder()
                .word("resilient")
                .defaultMeaning(Map.of("vi", "kiên cường"))
                .build();
        DictionaryWord savedWord = entityManager.persistAndFlush(word);
        assertThat(savedWord.getId()).isPositive();

        FlashcardDeck deck = FlashcardDeck.builder()
                .userId(1)
                .name("IELTS Vocabulary")
                .build();
        FlashcardDeck savedDeck = entityManager.persistAndFlush(deck);
        assertThat(savedDeck.getId()).isPositive();

        UserFlashcard flashcard = UserFlashcard.builder()
                .userId(1)
                .deck(savedDeck)
                .word(savedWord)
                .customWord("resilient")
                .customMeaning("kiên cường")
                .nextReviewDate(Instant.now())
                .build();
        UserFlashcard savedCard = entityManager.persistAndFlush(flashcard);
        assertThat(savedCard.getId()).isPositive();
        assertThat(savedCard.getDeck().getId()).isEqualTo(savedDeck.getId());
        assertThat(savedCard.getWord().getId()).isEqualTo(savedWord.getId());
    }

    @Test
    @DisplayName("Should persist Gamification module entities correctly")
    void testGamificationEntities() {
        UserStudyStat stat = UserStudyStat.builder()
                .userId(1)
                .currentStreak(5)
                .highestStreak(10)
                .lastStudyDate(LocalDate.now())
                .build();
        UserStudyStat savedStat = entityManager.persistAndFlush(stat);
        assertThat(savedStat.getId()).isPositive();
        assertThat(savedStat.getCurrentStreak()).isEqualTo(5);

        DailyStudyLog log = DailyStudyLog.builder()
                .userId(1)
                .studyDate(LocalDate.now())
                .learningMinutes(45)
                .flashcardsDue(10)
                .flashcardsReviewed(10)
                .build();
        DailyStudyLog savedLog = entityManager.persistAndFlush(log);
        assertThat(savedLog.getId()).isPositive();

        Notification notif = Notification.builder()
                .userId(1)
                .title("Streak Reminder")
                .content("Học ngay để giữ chuỗi ngày Streak 5 ngày!")
                .build();
        Notification savedNotif = entityManager.persistAndFlush(notif);
        assertThat(savedNotif.getId()).isPositive();
    }

    @Test
    @DisplayName("Should persist Analytics module entities with audit log details")
    void testAnalyticsEntities() {
        UserQuota quota = UserQuota.builder()
                .userId(1)
                .featureCode("AI_WRITING_GRADING")
                .resetDate(Instant.now())
                .build();
        UserQuota savedQuota = entityManager.persistAndFlush(quota);
        assertThat(savedQuota.getId()).isPositive();

        AuditLog audit = AuditLog.builder()
                .action("DELETE_EXAM")
                .entityType("EXAM")
                .entityId("1")
                .details(Map.of("reason", "Outdated"))
                .build();
        AuditLog savedAudit = entityManager.persistAndFlush(audit);
        assertThat(savedAudit.getId()).isPositive();
    }
}
