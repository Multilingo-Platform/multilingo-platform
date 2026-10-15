package com.multilingo.backend.modules.testing.repository;

import com.multilingo.backend.common.JpaTestConfig;
import com.multilingo.backend.modules.testing.entity.WritingGradingJob;
import com.multilingo.backend.modules.testing.entity.enums.WritingGradingJobStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DataJpaTest
@ActiveProfiles("test")
@Import(JpaTestConfig.class)
class WritingGradingJobRepositoryTest {

    @Autowired
    private WritingGradingJobRepository repository;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    @DisplayName("Lưu và tìm kiếm WritingGradingJob với đầy đủ trường, JSONB và audit fields")
    void saveAndFindWritingGradingJobPersistsAllFields() {
        Instant now = Instant.now();
        Instant leaseUntil = now.plusSeconds(45);
        Instant resetDate = now.plusSeconds(3600);

        WritingGradingJob job = WritingGradingJob.builder()
                .attemptId(10)
                .partId(1)
                .questionId("q1")
                .contextJson(Map.of("prompt", "Discuss advantages and disadvantages", "learningLanguage", "en"))
                .inputHash("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
                .status(WritingGradingJobStatus.READY)
                .waitReason(null)
                .attemptCount(0)
                .nextAttemptAt(now)
                .runId("run-uuid-1")
                .leaseUntil(leaseUntil)
                .lastStartedAt(now)
                .quotaId(50)
                .quotaResetDate(resetDate)
                .quotaReserved(true)
                .lastErrorCode(null)
                .modelMetadata(Map.of("model", "gemini-2.5-flash", "promptVersion", "v1"))
                .resultJson(Map.of("overallScore", 6.5))
                .completedAt(null)
                .build();

        WritingGradingJob saved = repository.saveAndFlush(job);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();

        entityManager.clear();

        Optional<WritingGradingJob> found = repository.findById(saved.getId());
        assertThat(found).isPresent();
        WritingGradingJob loaded = found.get();
        assertThat(loaded.getAttemptId()).isEqualTo(10);
        assertThat(loaded.getPartId()).isEqualTo(1);
        assertThat(loaded.getQuestionId()).isEqualTo("q1");
        assertThat(loaded.getStatus()).isEqualTo(WritingGradingJobStatus.READY);
        assertThat(loaded.getContextJson()).containsEntry("learningLanguage", "en");
        assertThat(loaded.getInputHash()).isEqualTo("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
        assertThat(loaded.getQuotaReserved()).isTrue();
        assertThat(loaded.getModelMetadata()).containsEntry("model", "gemini-2.5-flash");
        assertThat(loaded.getResultJson()).containsEntry("overallScore", 6.5);
        assertThat(loaded.getImageCount()).isEqualTo(0);
    }

    @Test
    @DisplayName("TV3-20-03-R1: imageCount round-trip persists values 0, 1, 2")
    void imageCountRoundTripPersistsValues() {
        for (int count : List.of(0, 1, 2)) {
            WritingGradingJob job = WritingGradingJob.builder()
                    .attemptId(100 + count)
                    .partId(1)
                    .questionId("q" + count)
                    .contextJson(Map.of("text", "essay " + count))
                    .inputHash("hash" + count)
                    .status(WritingGradingJobStatus.READY)
                    .imageCount(count)
                    .build();

            WritingGradingJob saved = repository.saveAndFlush(job);
            entityManager.clear();

            WritingGradingJob loaded = repository.findById(saved.getId()).orElseThrow();
            assertThat(loaded.getImageCount()).isEqualTo(count);
        }
    }

    @Test
    @DisplayName("Unique constraint (attempt_id, part_id, question_id) ngăn duplicate job")
    void duplicateAttemptPartQuestionThrowsDataIntegrityViolation() {
        WritingGradingJob job1 = WritingGradingJob.builder()
                .attemptId(20)
                .partId(2)
                .questionId("q-unique")
                .contextJson(Map.of("text", "essay 1"))
                .inputHash("hash1")
                .status(WritingGradingJobStatus.READY)
                .build();
        repository.saveAndFlush(job1);

        WritingGradingJob job2 = WritingGradingJob.builder()
                .attemptId(20)
                .partId(2)
                .questionId("q-unique")
                .contextJson(Map.of("text", "essay 2"))
                .inputHash("hash2")
                .status(WritingGradingJobStatus.READY)
                .build();

        assertThatThrownBy(() -> repository.saveAndFlush(job2))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("findByAttemptIdAndPartIdAndQuestionId tìm đúng job duy nhất")
    void findByAttemptIdAndPartIdAndQuestionIdReturnsJob() {
        WritingGradingJob job = WritingGradingJob.builder()
                .attemptId(30)
                .partId(3)
                .questionId("q-target")
                .contextJson(Map.of("text", "essay target"))
                .inputHash("target-hash")
                .status(WritingGradingJobStatus.RUNNING)
                .build();
        repository.saveAndFlush(job);

        Optional<WritingGradingJob> result = repository.findByAttemptIdAndPartIdAndQuestionId(30, 3, "q-target");
        assertThat(result).isPresent();
        assertThat(result.get().getInputHash()).isEqualTo("target-hash");

        Optional<WritingGradingJob> absent = repository.findByAttemptIdAndPartIdAndQuestionId(30, 3, "non-existent");
        assertThat(absent).isEmpty();
    }

    @Test
    @DisplayName("findAllByAttemptIdOrderByPartIdAscQuestionIdAsc trả về danh sách có thứ tự")
    void findAllByAttemptIdReturnsOrderedJobs() {
        WritingGradingJob jobB = WritingGradingJob.builder()
                .attemptId(40).partId(2).questionId("q1")
                .contextJson(Map.of()).inputHash("hashB").status(WritingGradingJobStatus.READY).build();
        WritingGradingJob jobA = WritingGradingJob.builder()
                .attemptId(40).partId(1).questionId("q1")
                .contextJson(Map.of()).inputHash("hashA").status(WritingGradingJobStatus.READY).build();
        WritingGradingJob jobC = WritingGradingJob.builder()
                .attemptId(40).partId(2).questionId("q2")
                .contextJson(Map.of()).inputHash("hashC").status(WritingGradingJobStatus.READY).build();

        repository.saveAndFlush(jobB);
        repository.saveAndFlush(jobA);
        repository.saveAndFlush(jobC);

        List<WritingGradingJob> list = repository.findAllByAttemptIdOrderByPartIdAscQuestionIdAsc(40);
        assertThat(list).hasSize(3);
        assertThat(list.get(0).getInputHash()).isEqualTo("hashA");
        assertThat(list.get(1).getInputHash()).isEqualTo("hashB");
        assertThat(list.get(2).getInputHash()).isEqualTo("hashC");
    }

    @Test
    @DisplayName("findDueJobIds tìm các job READY và RETRY_WAIT có nextAttemptAt <= now")
    void findDueJobIdsFindsReadyAndRetryWaitJobs() {
        Instant now = Instant.now();

        WritingGradingJob readyDue = WritingGradingJob.builder()
                .attemptId(50).partId(1).questionId("q1").contextJson(Map.of()).inputHash("h1")
                .status(WritingGradingJobStatus.READY).nextAttemptAt(now.minusSeconds(10)).build();
        WritingGradingJob retryDue = WritingGradingJob.builder()
                .attemptId(50).partId(1).questionId("q2").contextJson(Map.of()).inputHash("h2")
                .status(WritingGradingJobStatus.RETRY_WAIT).nextAttemptAt(now.minusSeconds(5)).build();
        WritingGradingJob retryFuture = WritingGradingJob.builder()
                .attemptId(50).partId(1).questionId("q3").contextJson(Map.of()).inputHash("h3")
                .status(WritingGradingJobStatus.RETRY_WAIT).nextAttemptAt(now.plusSeconds(60)).build();
        WritingGradingJob running = WritingGradingJob.builder()
                .attemptId(50).partId(1).questionId("q4").contextJson(Map.of()).inputHash("h4")
                .status(WritingGradingJobStatus.RUNNING).nextAttemptAt(now.minusSeconds(10)).build();

        repository.saveAndFlush(readyDue);
        repository.saveAndFlush(retryDue);
        repository.saveAndFlush(retryFuture);
        repository.saveAndFlush(running);

        List<Integer> dueIds = repository.findDueJobIds(now, PageRequest.of(0, 10));
        assertThat(dueIds).contains(readyDue.getId(), retryDue.getId());
        assertThat(dueIds).doesNotContain(retryFuture.getId(), running.getId());
    }

    @Test
    @DisplayName("findExpiredJobIds tìm các job RUNNING có leaseUntil < now")
    void findExpiredJobIdsFindsExpiredRunningJobs() {
        Instant now = Instant.now();

        WritingGradingJob expired = WritingGradingJob.builder()
                .attemptId(60).partId(1).questionId("q1").contextJson(Map.of()).inputHash("h1")
                .status(WritingGradingJobStatus.RUNNING).leaseUntil(now.minusSeconds(10)).runId("r1").build();
        WritingGradingJob active = WritingGradingJob.builder()
                .attemptId(60).partId(1).questionId("q2").contextJson(Map.of()).inputHash("h2")
                .status(WritingGradingJobStatus.RUNNING).leaseUntil(now.plusSeconds(30)).runId("r2").build();
        WritingGradingJob ready = WritingGradingJob.builder()
                .attemptId(60).partId(1).questionId("q3").contextJson(Map.of()).inputHash("h3")
                .status(WritingGradingJobStatus.READY).leaseUntil(now.minusSeconds(10)).build();

        repository.saveAndFlush(expired);
        repository.saveAndFlush(active);
        repository.saveAndFlush(ready);

        List<Integer> expiredIds = repository.findExpiredJobIds(now, PageRequest.of(0, 10));
        assertThat(expiredIds).containsExactly(expired.getId());
    }

    @Test
    @DisplayName("findWaitingJobIds tìm các job WAITING có nextAttemptAt <= now")
    void findWaitingJobIdsFindsDueWaitingJobs() {
        Instant now = Instant.now();

        WritingGradingJob waitingDue = WritingGradingJob.builder()
                .attemptId(70).partId(1).questionId("q1").contextJson(Map.of()).inputHash("h1")
                .status(WritingGradingJobStatus.WAITING).nextAttemptAt(now.minusSeconds(5)).build();
        WritingGradingJob waitingFuture = WritingGradingJob.builder()
                .attemptId(70).partId(1).questionId("q2").contextJson(Map.of()).inputHash("h2")
                .status(WritingGradingJobStatus.WAITING).nextAttemptAt(now.plusSeconds(60)).build();

        repository.saveAndFlush(waitingDue);
        repository.saveAndFlush(waitingFuture);

        List<Integer> waitingIds = repository.findWaitingJobIds(now, PageRequest.of(0, 10));
        assertThat(waitingIds).containsExactly(waitingDue.getId());
    }
}
