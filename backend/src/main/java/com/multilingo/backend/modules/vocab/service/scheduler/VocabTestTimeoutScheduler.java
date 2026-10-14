package com.multilingo.backend.modules.vocab.service.scheduler;

import com.multilingo.backend.config.VocabTestProperties;
import com.multilingo.backend.modules.vocab.entity.VocabTestAttempt;
import com.multilingo.backend.modules.vocab.repository.VocabTestAttemptRepository;
import com.multilingo.backend.modules.vocab.service.VocabTestService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

/**
 * Background Scheduler định kỳ quét các bài thi thử quá hạn và tự động nộp bài.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VocabTestTimeoutScheduler {

    private final VocabTestAttemptRepository attemptRepository;
    private final VocabTestService vocabTestService;
    private final VocabTestProperties vocabTestProperties;

    @Scheduled(fixedDelayString = "${vocab.test.timeout-scan-delay-ms:60000}")
    public void scanAndFinalizeTimeouts() {
        Instant deadline = Instant.now().minusSeconds(vocabTestProperties.getSubmissionGraceSeconds());
        List<VocabTestAttempt> expiredAttempts = attemptRepository.findExpiredActiveAttempts(deadline, PageRequest.of(0, 50));

        if (!expiredAttempts.isEmpty()) {
            log.info("Scheduler phát hiện {} bài thi thử quá hạn cần thu bài tự động", expiredAttempts.size());
            for (VocabTestAttempt attempt : expiredAttempts) {
                try {
                    vocabTestService.handleTimeout(attempt.getTestToken());
                } catch (Exception e) {
                    log.error("Lỗi khi scheduler thu bài tự động token={}:", attempt.getTestToken(), e);
                }
            }
        }
    }
}
