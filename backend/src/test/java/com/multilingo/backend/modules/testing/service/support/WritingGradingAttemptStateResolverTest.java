package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.modules.testing.entity.WritingGradingJob;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.WritingGradingJobStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class WritingGradingAttemptStateResolverTest {

    private final WritingGradingAttemptStateResolver resolver = new WritingGradingAttemptStateResolver();

    private WritingGradingJob createJob(WritingGradingJobStatus status) {
        return WritingGradingJob.builder()
                .status(status)
                .build();
    }

    @Test
    @DisplayName("resolve: null hoặc empty jobs trả về COMPLETED")
    void resolve_nullOrEmptyJobs_returnsCompleted() {
        assertThat(resolver.resolve(null)).isEqualTo(AttemptStatus.COMPLETED);
        assertThat(resolver.resolve(Collections.emptyList())).isEqualTo(AttemptStatus.COMPLETED);
    }

    @Test
    @DisplayName("resolve: có ít nhất 1 job runnable (READY, RUNNING, RETRY_WAIT) trả về AI_GRADING")
    void resolve_hasRunnableJob_returnsAiGrading() {
        assertThat(resolver.resolve(List.of(createJob(WritingGradingJobStatus.READY)))).isEqualTo(AttemptStatus.AI_GRADING);
        assertThat(resolver.resolve(List.of(createJob(WritingGradingJobStatus.RUNNING)))).isEqualTo(AttemptStatus.AI_GRADING);
        assertThat(resolver.resolve(List.of(createJob(WritingGradingJobStatus.RETRY_WAIT)))).isEqualTo(AttemptStatus.AI_GRADING);
        
        // Runnable chiếm ưu thế hơn WAITING và FAILED/UNAVAILABLE
        assertThat(resolver.resolve(List.of(
                createJob(WritingGradingJobStatus.READY),
                createJob(WritingGradingJobStatus.WAITING),
                createJob(WritingGradingJobStatus.FAILED)
        ))).isEqualTo(AttemptStatus.AI_GRADING);
    }

    @Test
    @DisplayName("resolve: không có runnable, có job WAITING trả về AI_GRADING_QUEUED")
    void resolve_onlyWaitingJobs_returnsAiGradingQueued() {
        assertThat(resolver.resolve(List.of(createJob(WritingGradingJobStatus.WAITING)))).isEqualTo(AttemptStatus.AI_GRADING_QUEUED);
        
        // WAITING chiếm ưu thế hơn SUCCEEDED hoặc FAILED/UNAVAILABLE khi còn job chờ
        assertThat(resolver.resolve(List.of(
                createJob(WritingGradingJobStatus.WAITING),
                createJob(WritingGradingJobStatus.SUCCEEDED)
        ))).isEqualTo(AttemptStatus.AI_GRADING_QUEUED);
    }

    @Test
    @DisplayName("resolve: tất cả jobs SUCCEEDED (kể cả TOO_SHORT) trả về COMPLETED")
    void resolve_allSucceededJobs_returnsCompleted() {
        assertThat(resolver.resolve(List.of(createJob(WritingGradingJobStatus.SUCCEEDED)))).isEqualTo(AttemptStatus.COMPLETED);
        assertThat(resolver.resolve(List.of(
                createJob(WritingGradingJobStatus.SUCCEEDED),
                createJob(WritingGradingJobStatus.SUCCEEDED)
        ))).isEqualTo(AttemptStatus.COMPLETED);
    }

    @Test
    @DisplayName("resolve: hết pending, có FAILED hoặc UNAVAILABLE trả về GRADING_FAILED")
    void resolve_allTerminalWithFailedOrUnavailable_returnsGradingFailed() {
        assertThat(resolver.resolve(List.of(createJob(WritingGradingJobStatus.FAILED)))).isEqualTo(AttemptStatus.GRADING_FAILED);
        assertThat(resolver.resolve(List.of(createJob(WritingGradingJobStatus.UNAVAILABLE)))).isEqualTo(AttemptStatus.GRADING_FAILED);
        assertThat(resolver.resolve(List.of(
                createJob(WritingGradingJobStatus.SUCCEEDED),
                createJob(WritingGradingJobStatus.FAILED)
        ))).isEqualTo(AttemptStatus.GRADING_FAILED);
        assertThat(resolver.resolve(List.of(
                createJob(WritingGradingJobStatus.SUCCEEDED),
                createJob(WritingGradingJobStatus.UNAVAILABLE)
        ))).isEqualTo(AttemptStatus.GRADING_FAILED);
    }

    @Test
    @DisplayName("resolve: empty jobs nhưng có local UNAVAILABLE trả về GRADING_FAILED")
    void resolve_emptyJobsWithLocalUnavailable_returnsGradingFailed() {
        assertThat(resolver.resolve(Collections.emptyList(), true)).isEqualTo(AttemptStatus.GRADING_FAILED);
        assertThat(resolver.resolve(null, true)).isEqualTo(AttemptStatus.GRADING_FAILED);
    }

    @Test
    @DisplayName("resolve: mixed jobs: SUCCEEDED job + local UNAVAILABLE trả về GRADING_FAILED")
    void resolve_succeededJobWithLocalUnavailable_returnsGradingFailed() {
        assertThat(resolver.resolve(List.of(createJob(WritingGradingJobStatus.SUCCEEDED)), true))
                .isEqualTo(AttemptStatus.GRADING_FAILED);
    }

    @Test
    @DisplayName("resolve: mixed jobs: READY job + local UNAVAILABLE trả về AI_GRADING")
    void resolve_readyJobWithLocalUnavailable_returnsAiGrading() {
        assertThat(resolver.resolve(List.of(createJob(WritingGradingJobStatus.READY)), true))
                .isEqualTo(AttemptStatus.AI_GRADING);
    }

    @Test
    @DisplayName("resolve: mixed jobs: WAITING job + local UNAVAILABLE trả về AI_GRADING_QUEUED")
    void resolve_waitingJobWithLocalUnavailable_returnsAiGradingQueued() {
        assertThat(resolver.resolve(List.of(createJob(WritingGradingJobStatus.WAITING)), true))
                .isEqualTo(AttemptStatus.AI_GRADING_QUEUED);
    }

    @Test
    @DisplayName("hasLocalUnavailable: phát hiện chính xác khi aiFeedback chứa task UNAVAILABLE")
    void hasLocalUnavailable_detectsUnavailableTaskInAiFeedback() {
        com.multilingo.backend.modules.testing.entity.AttemptAnswer answer = new com.multilingo.backend.modules.testing.entity.AttemptAnswer();
        answer.setAiFeedback(java.util.Map.of(
                "schemaVersion", 1,
                "tasks", java.util.Map.of(
                        "q1", java.util.Map.of(
                                "status", "UNAVAILABLE",
                                "reasonCode", "VISUAL_CONTEXT_UNSUPPORTED"
                        )
                )
        ));

        assertThat(WritingGradingAttemptStateResolver.hasLocalUnavailable(List.of(answer))).isTrue();
        assertThat(resolver.resolve(Collections.emptyList(), List.of(answer))).isEqualTo(AttemptStatus.GRADING_FAILED);
    }
}
