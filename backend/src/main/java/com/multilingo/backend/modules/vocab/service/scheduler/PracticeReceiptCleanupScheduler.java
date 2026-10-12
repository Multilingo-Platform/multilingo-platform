package com.multilingo.backend.modules.vocab.service.scheduler;

import com.multilingo.backend.modules.vocab.repository.PracticeCompletionReceiptRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Slf4j
@Component
@RequiredArgsConstructor
public class PracticeReceiptCleanupScheduler {

    private final PracticeCompletionReceiptRepository receiptRepository;

    /**
     * Dọn dẹp định kỳ các bản ghi receipt đã vượt quá retain_until và session_expires_at.
     * Mặc định chạy mỗi 6 giờ hoặc theo cấu hình vocab.practice.cleanup-cron.
     */
    @Scheduled(cron = "${vocab.practice.cleanup-cron:0 0 */6 * * *}")
    @Transactional
    public void cleanupExpiredReceipts() {
        Instant now = Instant.now();
        int deleted = receiptRepository.deleteExpiredReceipts(now);
        if (deleted > 0) {
            log.info("PracticeReceiptCleanupScheduler: Đã dọn dẹp {} receipt hết hạn", deleted);
        }
    }
}
