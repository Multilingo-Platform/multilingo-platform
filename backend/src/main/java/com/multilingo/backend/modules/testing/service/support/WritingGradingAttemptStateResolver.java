package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.WritingGradingJob;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.WritingGradingJobStatus;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Map;

/**
 * Phân giải trạng thái tổng hợp của TestAttempt từ tập hợp các WritingGradingJob
 * và các kết quả cục bộ (local terminal result, ví dụ: visual context unsupported khi images=false).
 *
 * Quy tắc ánh xạ (theo spec TV3-20):
 * - Có job có thể chạy (READY, RUNNING, RETRY_WAIT) -> AI_GRADING
 * - Không có runnable, chỉ còn WAITING -> AI_GRADING_QUEUED
 * - Hết pending, có FAILED hoặc UNAVAILABLE (từ durable job hoặc local result) -> GRADING_FAILED
 * - Tất cả SUCCEEDED (kể cả TOO_SHORT) và không có terminal thất bại -> COMPLETED
 * - Không có job và không có local unavailable -> COMPLETED
 */
@Component
public class WritingGradingAttemptStateResolver {

    public AttemptStatus resolve(Collection<WritingGradingJob> jobs) {
        return resolve(jobs, false);
    }

    public AttemptStatus resolve(Collection<WritingGradingJob> jobs, Collection<AttemptAnswer> answers) {
        return resolve(jobs, hasLocalUnavailable(answers));
    }

    public AttemptStatus resolve(Collection<WritingGradingJob> jobs, boolean hasLocalUnavailable) {
        if ((jobs == null || jobs.isEmpty()) && !hasLocalUnavailable) {
            return AttemptStatus.COMPLETED;
        }

        boolean hasRunnable = false;
        boolean hasWaiting = false;
        boolean hasFailedOrUnavailable = hasLocalUnavailable;
        boolean allSucceeded = !hasLocalUnavailable;

        if (jobs != null) {
            for (WritingGradingJob job : jobs) {
                WritingGradingJobStatus status = job != null ? job.getStatus() : null;
                if (status == null) {
                    continue;
                }

                if (status == WritingGradingJobStatus.READY
                        || status == WritingGradingJobStatus.RUNNING
                        || status == WritingGradingJobStatus.RETRY_WAIT) {
                    hasRunnable = true;
                    allSucceeded = false;
                } else if (status == WritingGradingJobStatus.WAITING) {
                    hasWaiting = true;
                    allSucceeded = false;
                } else if (status == WritingGradingJobStatus.FAILED
                        || status == WritingGradingJobStatus.UNAVAILABLE) {
                    hasFailedOrUnavailable = true;
                    allSucceeded = false;
                } else if (status == WritingGradingJobStatus.SUCCEEDED) {
                    // Giữ allSucceeded nếu chưa bị vi phạm
                }
            }
        }

        if (hasRunnable) {
            return AttemptStatus.AI_GRADING;
        }
        if (hasWaiting) {
            return AttemptStatus.AI_GRADING_QUEUED;
        }
        if (hasFailedOrUnavailable) {
            return AttemptStatus.GRADING_FAILED;
        }
        if (allSucceeded) {
            return AttemptStatus.COMPLETED;
        }

        return AttemptStatus.COMPLETED;
    }

    public static boolean hasLocalUnavailable(Collection<AttemptAnswer> answers) {
        if (answers == null || answers.isEmpty()) {
            return false;
        }
        for (AttemptAnswer answer : answers) {
            if (answer == null || answer.getAiFeedback() == null) {
                continue;
            }
            Object tasksObj = answer.getAiFeedback().get("tasks");
            if (tasksObj instanceof Map<?, ?> tasks) {
                for (Object taskVal : tasks.values()) {
                    if (taskVal instanceof Map<?, ?> taskMap) {
                        Object st = taskMap.get("status");
                        if ("UNAVAILABLE".equalsIgnoreCase(String.valueOf(st))) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }
}
