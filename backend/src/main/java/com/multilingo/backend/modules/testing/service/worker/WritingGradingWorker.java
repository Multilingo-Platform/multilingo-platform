package com.multilingo.backend.modules.testing.service.worker;

import com.multilingo.backend.modules.testing.ai.grading.*;
import com.multilingo.backend.modules.testing.config.WritingGradingProperties;
import com.multilingo.backend.modules.testing.service.support.Claim;
import com.multilingo.backend.modules.testing.service.support.ClaimDecision;
import com.multilingo.backend.modules.testing.service.support.WritingGradingTransactionCoordinator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Objects;

/**
 * Worker xử lý chấm bài thi Writing tự động ngoài giao dịch cơ sở dữ liệu.
 * Luồng thực thi:
 *   1. Nhận việc (claim) qua coordinator trong giao dịch riêng;
 *   2. Tải ảnh (nếu có ngữ cảnh trực quan) qua imageLoader ngoài giao dịch;
 *   3. Gọi Gemini generator ngoài giao dịch;
 *   4. Hoàn tất (complete) hoặc báo lỗi (fail) qua coordinator trong giao dịch riêng.
 *
 * Tuyệt đối không log nội dung bài viết, đề bài, feedback hay image URLs.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WritingGradingWorker {

    private final WritingGradingTransactionCoordinator coordinator;
    private final WritingGradingImageLoader imageLoader;
    private final WritingGradingGenerator generator;
    private final WritingGradingProperties properties;

    public void process(Integer jobId) {
        if (jobId == null) {
            return;
        }

        ClaimDecision decision;
        try {
            decision = coordinator.claim(jobId);
        } catch (Exception e) {
            log.error("Failed to claim writing grading job {}: errorCode=CLAIM_FAILED", jobId);
            return;
        }

        if (decision instanceof ClaimDecision.Waiting waiting) {
            log.info("Writing grading job {} is waiting: {}", jobId, waiting.reason());
            return;
        }

        if (decision instanceof ClaimDecision.Rejected rejected) {
            log.debug("Writing grading job {} claim rejected: {}", jobId, rejected.reason());
            return;
        }

        if (!(decision instanceof ClaimDecision.Granted granted)) {
            return;
        }

        Claim claim = granted.claim();
        WritingGradingContext context = claim.context();

        try {
            if (Thread.currentThread().isInterrupted()) {
                throw new WritingGradingException(
                        WritingGradingFailure.retryable("INTERRUPTED", "Worker thread interrupted")
                );
            }

            // Phòng thủ: nếu bài có ảnh nhưng cấu hình images-enabled đang tắt
            if (context != null && context.hasVisualContext() && !properties.isImagesEnabled()) {
                log.warn("Visual grading requested for job {} but images are disabled", claim.jobId());
                coordinator.fail(claim, WritingGradingFailure.unavailable(
                        "VISUAL_CONTEXT_UNSUPPORTED", "Visual writing grading is disabled"
                ));
                return;
            }

            // Tải ảnh ngoài transaction nếu có ngữ cảnh trực quan
            WritingGradingImageLoader.LoadedImages loadedImages = WritingGradingImageLoader.LoadedImages.empty();
            if (context != null && context.hasVisualContext()) {
                loadedImages = imageLoader.load(context.images(), claim.leaseUntil());
            }

            if (Thread.currentThread().isInterrupted()) {
                throw new WritingGradingException(
                        WritingGradingFailure.retryable("INTERRUPTED", "Worker thread interrupted")
                );
            }

            // Gọi Gemini generator ngoài transaction
            WritingGrade grade = generator.generate(context, loadedImages.parts(), loadedImages.sha256HexDigests());

            // Lưu kết quả qua coordinator trong transaction riêng
            coordinator.complete(claim, grade);
            log.info("Successfully completed writing grading for job {} (attemptId={})",
                    claim.jobId(), claim.attemptId());

        } catch (WritingGradingException e) {
            log.warn("Writing grading failed for job {}: errorCode={}, retryable={}, destination={}",
                    claim.jobId(), e.getFailure().errorCode(), e.getFailure().isRetryable(), e.getFailure().destination());
            try {
                coordinator.fail(claim, e.getFailure());
            } catch (Exception ex) {
                log.error("Failed to record failure for job {}: errorCode=FAILURE_RECORD_FAILED", claim.jobId());
            }
        } catch (Exception e) {
            log.error("Unexpected error processing writing grading job {}: errorCode=UNEXPECTED_ERROR", claim.jobId());
            WritingGradingFailure failure = WritingGradingFailure.retryable(
                    "UNEXPECTED_ERROR", "Unexpected error during worker execution: " + e.getClass().getSimpleName()
            );
            try {
                coordinator.fail(claim, failure);
            } catch (Exception ex) {
                log.error("Failed to record unexpected failure for job {}: errorCode=FAILURE_RECORD_FAILED", claim.jobId());
            }
        }
    }
}
