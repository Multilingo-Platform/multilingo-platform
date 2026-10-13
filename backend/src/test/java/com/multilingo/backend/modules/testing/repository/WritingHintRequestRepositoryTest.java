package com.multilingo.backend.modules.testing.repository;

import com.multilingo.backend.common.JpaTestConfig;
import com.multilingo.backend.modules.testing.entity.WritingHintRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
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
class WritingHintRequestRepositoryTest {

    @Autowired
    private WritingHintRequestRepository repository;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    @DisplayName("Lưu và tìm kiếm WritingHintRequest với đầy đủ trường, JSONB và audit fields")
    void saveAndFindWritingHintRequestPersistsAllFields() {
        Instant now = Instant.now();
        Instant leaseUntil = now.plusSeconds(45);
        Instant resetDate = now.plusSeconds(3600);

        WritingHintRequest request = WritingHintRequest.builder()
                .userId(1)
                .attemptId(10)
                .partId(30)
                .questionId("writing-task-1")
                .requestId("c5430ff2-6f41-4eb4-b287-e1e1fdab47aa")
                .requestFingerprint("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
                .contextJson(Map.of("learningLanguage", "en", "hintLanguage", "vi", "promptVersion", "v1"))
                .status(WritingHintRequest.Status.PENDING)
                .runId("run-uuid-123")
                .leaseUntil(leaseUntil)
                .lastStartedAt(now)
                .quotaId(100)
                .quotaResetDate(resetDate)
                .quotaReserved(true)
                .resultJson(null)
                .failureCode(null)
                .build();

        WritingHintRequest saved = repository.saveAndFlush(request);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();

        entityManager.clear();

        WritingHintRequest found = repository.findById(saved.getId()).orElseThrow();
        assertThat(found.getUserId()).isEqualTo(1);
        assertThat(found.getAttemptId()).isEqualTo(10);
        assertThat(found.getPartId()).isEqualTo(30);
        assertThat(found.getQuestionId()).isEqualTo("writing-task-1");
        assertThat(found.getRequestId()).isEqualTo("c5430ff2-6f41-4eb4-b287-e1e1fdab47aa");
        assertThat(found.getRequestFingerprint()).isEqualTo("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
        assertThat(found.getStatus()).isEqualTo(WritingHintRequest.Status.PENDING);
        assertThat(found.getContextJson()).containsEntry("learningLanguage", "en");
        assertThat(found.getContextJson()).containsEntry("hintLanguage", "vi");
        assertThat(found.getQuotaReserved()).isTrue();
    }

    @Test
    @DisplayName("Ràng buộc tính duy nhất (user_id, request_id) ném DataIntegrityViolationException khi trùng lặp")
    void uniqueConstraintUserIdAndRequestIdThrowsException() {
        WritingHintRequest req1 = WritingHintRequest.builder()
                .userId(1)
                .attemptId(10)
                .partId(30)
                .questionId("q-1")
                .requestId("same-request-id")
                .requestFingerprint("fp-1")
                .contextJson(Map.of("key", "val1"))
                .status(WritingHintRequest.Status.PENDING)
                .quotaReserved(false)
                .build();
        repository.saveAndFlush(req1);

        WritingHintRequest req2 = WritingHintRequest.builder()
                .userId(1) // Trùng userId
                .attemptId(11)
                .partId(30)
                .questionId("q-2")
                .requestId("same-request-id") // Trùng requestId
                .requestFingerprint("fp-2")
                .contextJson(Map.of("key", "val2"))
                .status(WritingHintRequest.Status.PENDING)
                .quotaReserved(false)
                .build();

        assertThatThrownBy(() -> repository.saveAndFlush(req2))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("findByUserIdAndRequestId trả về đúng request của user và empty nếu không trùng")
    void findByUserIdAndRequestIdWorksCorrectly() {
        WritingHintRequest req = WritingHintRequest.builder()
                .userId(1)
                .attemptId(10)
                .partId(30)
                .questionId("q-1")
                .requestId("req-abc")
                .requestFingerprint("fp-1")
                .contextJson(Map.of("foo", "bar"))
                .status(WritingHintRequest.Status.SUCCEEDED)
                .resultJson(Map.of("outline", List.of()))
                .quotaReserved(true)
                .build();
        repository.saveAndFlush(req);

        Optional<WritingHintRequest> found = repository.findByUserIdAndRequestId(1, "req-abc");
        assertThat(found).isPresent();
        assertThat(found.get().getStatus()).isEqualTo(WritingHintRequest.Status.SUCCEEDED);

        Optional<WritingHintRequest> wrongUser = repository.findByUserIdAndRequestId(2, "req-abc");
        assertThat(wrongUser).isEmpty();

        Optional<WritingHintRequest> wrongReq = repository.findByUserIdAndRequestId(1, "req-xyz");
        assertThat(wrongReq).isEmpty();
    }

    @Test
    @DisplayName("findByUserIdAndStatus tìm đúng request theo status")
    void findByUserIdAndStatusWorksCorrectly() {
        WritingHintRequest req = WritingHintRequest.builder()
                .userId(1)
                .attemptId(10)
                .partId(30)
                .questionId("q-1")
                .requestId("req-status-test")
                .requestFingerprint("fp-1")
                .contextJson(Map.of("foo", "bar"))
                .status(WritingHintRequest.Status.PENDING)
                .quotaReserved(true)
                .build();
        repository.saveAndFlush(req);

        Optional<WritingHintRequest> found = repository.findByUserIdAndStatus(1, WritingHintRequest.Status.PENDING);
        assertThat(found).isPresent();
        assertThat(found.get().getRequestId()).isEqualTo("req-status-test");

        Optional<WritingHintRequest> notFound = repository.findByUserIdAndStatus(1, WritingHintRequest.Status.SUCCEEDED);
        assertThat(notFound).isEmpty();
    }

    @Test
    @DisplayName("findExpiredPendingRequests chỉ lấy request PENDING có leaseUntil < now")
    void findExpiredPendingRequestsWorksCorrectly() {
        Instant now = Instant.now();

        // 1. Expired PENDING: leaseUntil in past
        WritingHintRequest expired = WritingHintRequest.builder()
                .userId(1)
                .attemptId(10)
                .partId(30)
                .questionId("q-1")
                .requestId("req-expired")
                .requestFingerprint("fp-1")
                .contextJson(Map.of("k", "v"))
                .status(WritingHintRequest.Status.PENDING)
                .leaseUntil(now.minusSeconds(10))
                .quotaReserved(true)
                .build();

        // 2. Active PENDING: leaseUntil in future
        WritingHintRequest active = WritingHintRequest.builder()
                .userId(2)
                .attemptId(10)
                .partId(30)
                .questionId("q-2")
                .requestId("req-active")
                .requestFingerprint("fp-2")
                .contextJson(Map.of("k", "v"))
                .status(WritingHintRequest.Status.PENDING)
                .leaseUntil(now.plusSeconds(30))
                .quotaReserved(true)
                .build();

        // 3. Expired lease but SUCCEEDED: should not be returned
        WritingHintRequest succeeded = WritingHintRequest.builder()
                .userId(3)
                .attemptId(10)
                .partId(30)
                .questionId("q-3")
                .requestId("req-succeeded")
                .requestFingerprint("fp-3")
                .contextJson(Map.of("k", "v"))
                .status(WritingHintRequest.Status.SUCCEEDED)
                .leaseUntil(now.minusSeconds(10))
                .quotaReserved(true)
                .build();

        repository.saveAndFlush(expired);
        repository.saveAndFlush(active);
        repository.saveAndFlush(succeeded);

        List<WritingHintRequest> expiredList = repository.findExpiredPendingRequests(now);
        assertThat(expiredList).hasSize(1);
        assertThat(expiredList.getFirst().getRequestId()).isEqualTo("req-expired");
    }

    @Test
    @DisplayName("findExpiredPendingRequests trả về request có leaseUntil == now (equality boundary)")
    void findExpiredPendingRequestsIncludesEqualityBoundary() {
        Instant now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);

        WritingHintRequest exactBoundary = WritingHintRequest.builder()
                .userId(1)
                .attemptId(10)
                .partId(30)
                .questionId("q-exact")
                .requestId("req-exact-boundary")
                .requestFingerprint("fp-exact")
                .contextJson(Map.of("k", "v"))
                .status(WritingHintRequest.Status.PENDING)
                .leaseUntil(now) // Exact equality boundary!
                .quotaReserved(true)
                .build();

        exactBoundary = repository.saveAndFlush(exactBoundary);
        Instant queryBoundary = exactBoundary.getLeaseUntil();

        List<WritingHintRequest> expiredList = repository.findExpiredPendingRequests(queryBoundary);
        assertThat(expiredList).anyMatch(r -> "req-exact-boundary".equals(r.getRequestId()));

        List<WritingHintRequest> userExpiredList = repository.findExpiredPendingRequestsByUserIdOrderByIdAsc(1, queryBoundary);
        assertThat(userExpiredList).anyMatch(r -> "req-exact-boundary".equals(r.getRequestId()));
    }
}
