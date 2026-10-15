package com.multilingo.backend.modules.testing.service.worker;

import com.multilingo.backend.modules.testing.ai.gemini.GeminiImagePart;
import com.multilingo.backend.modules.testing.ai.grading.*;
import com.multilingo.backend.modules.testing.config.WritingGradingProperties;
import com.multilingo.backend.modules.testing.service.support.Claim;
import com.multilingo.backend.modules.testing.service.support.ClaimDecision;
import com.multilingo.backend.modules.testing.service.support.WritingGradingTransactionCoordinator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WritingGradingWorkerTest {

    @Mock
    private WritingGradingTransactionCoordinator coordinator;

    @Mock
    private WritingGradingImageLoader imageLoader;

    @Mock
    private WritingGradingGenerator generator;

    private WritingGradingProperties properties;
    private WritingGradingWorker worker;

    @BeforeEach
    void setUp() {
        properties = new WritingGradingProperties();
        properties.setEnabled(true);
        properties.setImagesEnabled(true);
        worker = new WritingGradingWorker(coordinator, imageLoader, generator, properties);
    }

    @Test
    @DisplayName("process - khi jobId null thì kết thúc an toàn, không gọi coordinator hay provider")
    void process_whenJobIdNull_returnsSafely() {
        worker.process(null);

        verifyNoInteractions(coordinator, imageLoader, generator);
    }

    @Test
    @DisplayName("process - khi claim bị Rejected thì không tải ảnh hay gọi generator")
    void process_whenClaimRejected_doesNotCallLoaderOrGenerator() {
        when(coordinator.claim(101)).thenReturn(new ClaimDecision.Rejected("ALREADY_RUNNING"));

        worker.process(101);

        verify(coordinator).claim(101);
        verifyNoMoreInteractions(coordinator);
        verifyNoInteractions(imageLoader, generator);
    }

    @Test
    @DisplayName("process - khi claim ở trạng thái Waiting thì không tải ảnh hay gọi generator")
    void process_whenClaimWaiting_doesNotCallLoaderOrGenerator() {
        when(coordinator.claim(101)).thenReturn(new ClaimDecision.Waiting("QUOTA_UNAVAILABLE"));

        worker.process(101);

        verify(coordinator).claim(101);
        verifyNoMoreInteractions(coordinator);
        verifyNoInteractions(imageLoader, generator);
    }

    @Test
    @DisplayName("process - bài text-only hợp lệ: claim Granted -> generator -> coordinator.complete ngoài transaction")
    void process_whenClaimGranted_textOnly_generatesAndCompletes() {
        WritingGradingContext context = new WritingGradingContext(
                1, "q1", "en", "prompt", "This is an essay with more than ten words for testing worker.", 12, List.of()
        );
        Claim claim = new Claim(101, 1, 1, "q1", "run-1", Instant.now().plusSeconds(60), 1, "hash-1", context);
        when(coordinator.claim(101)).thenReturn(new ClaimDecision.Granted(claim));

        WritingGrade grade = new WritingGrade(
                "WRITING_EN_V1", "vi", new BigDecimal("7.0"), List.of(), "feedback", "corrected", List.of(), List.of(), null, List.of()
        );
        when(generator.generate(eq(context), eq(List.of()), eq(List.of()))).thenReturn(grade);

        worker.process(101);

        verify(coordinator).claim(101);
        verify(generator).generate(eq(context), eq(List.of()), eq(List.of()));
        verify(coordinator).complete(claim, grade);
        verifyNoInteractions(imageLoader);
    }

    @Test
    @DisplayName("process - bài có ảnh: claim Granted -> imageLoader.load -> generator -> coordinator.complete")
    void process_whenClaimGranted_withImages_loadsImagesAndGenerates() {
        WritingImageRef imgRef = new WritingImageRef("https://example.com/chart.png");
        WritingGradingContext context = new WritingGradingContext(
                1, "q1", "en", "prompt", "This is an essay with more than ten words for testing worker.", 12, List.of(imgRef)
        );
        Instant leaseUntil = Instant.now().plusSeconds(60);
        Claim claim = new Claim(101, 1, 1, "q1", "run-1", leaseUntil, 1, "hash-1", context);
        when(coordinator.claim(101)).thenReturn(new ClaimDecision.Granted(claim));

        GeminiImagePart imgPart = new GeminiImagePart("image/png", new byte[]{1, 2, 3});
        WritingGradingImageLoader.LoadedImages loaded = new WritingGradingImageLoader.LoadedImages(
                List.of(imgPart), List.of("sha256-hex")
        );
        when(imageLoader.load(eq(context.images()), eq(leaseUntil))).thenReturn(loaded);

        WritingGrade grade = new WritingGrade(
                "WRITING_EN_V1", "vi", new BigDecimal("7.5"), List.of(), "feedback", "corrected", List.of(), List.of(), "visual observations", List.of("sha256-hex")
        );
        when(generator.generate(eq(context), eq(List.of(imgPart)), eq(List.of("sha256-hex")))).thenReturn(grade);

        worker.process(101);

        verify(coordinator).claim(101);
        verify(imageLoader).load(eq(context.images()), eq(leaseUntil));
        verify(generator).generate(eq(context), eq(List.of(imgPart)), eq(List.of("sha256-hex")));
        verify(coordinator).complete(claim, grade);
    }

    @Test
    @DisplayName("process - bài có ảnh nhưng imagesEnabled=false: thất bại ngay với VISUAL_CONTEXT_UNSUPPORTED mà không tải ảnh hay gọi generator")
    void process_whenVisualTaskAndImagesDisabled_failsWithVisualContextUnsupported() {
        properties.setImagesEnabled(false);

        WritingImageRef imgRef = new WritingImageRef("https://example.com/chart.png");
        WritingGradingContext context = new WritingGradingContext(
                1, "q1", "en", "prompt", "This is an essay with more than ten words for testing worker.", 12, List.of(imgRef)
        );
        Claim claim = new Claim(101, 1, 1, "q1", "run-1", Instant.now().plusSeconds(60), 1, "hash-1", context);
        when(coordinator.claim(101)).thenReturn(new ClaimDecision.Granted(claim));

        worker.process(101);

        verify(coordinator).claim(101);
        verify(coordinator).fail(eq(claim), argThat(failure ->
                "VISUAL_CONTEXT_UNSUPPORTED".equals(failure.errorCode())
                        && failure.destination() == WritingGradingFailure.TerminalDestination.UNAVAILABLE
        ));
        verifyNoInteractions(imageLoader, generator);
    }

    @Test
    @DisplayName("process - khi generator ném WritingGradingException: gọi coordinator.fail với đúng failure")
    void process_whenGeneratorThrowsWritingGradingException_callsCoordinatorFail() {
        WritingGradingContext context = new WritingGradingContext(
                1, "q1", "en", "prompt", "This is an essay with more than ten words for testing worker.", 12, List.of()
        );
        Claim claim = new Claim(101, 1, 1, "q1", "run-1", Instant.now().plusSeconds(60), 1, "hash-1", context);
        when(coordinator.claim(101)).thenReturn(new ClaimDecision.Granted(claim));

        WritingGradingFailure failure = WritingGradingFailure.retryable("RATE_LIMITED", "Rate limit exceeded");
        when(generator.generate(any(), any(), any())).thenThrow(new WritingGradingException(failure));

        worker.process(101);

        verify(coordinator).claim(101);
        verify(coordinator).fail(claim, failure);
        verify(coordinator, never()).complete(any(), any());
    }

    @Test
    @DisplayName("process - khi imageLoader ném WritingGradingException: gọi coordinator.fail với đúng failure, không gọi generator")
    void process_whenImageLoaderThrowsWritingGradingException_callsCoordinatorFail() {
        WritingImageRef imgRef = new WritingImageRef("https://example.com/chart.png");
        WritingGradingContext context = new WritingGradingContext(
                1, "q1", "en", "prompt", "This is an essay with more than ten words for testing worker.", 12, List.of(imgRef)
        );
        Instant leaseUntil = Instant.now().plusSeconds(60);
        Claim claim = new Claim(101, 1, 1, "q1", "run-1", leaseUntil, 1, "hash-1", context);
        when(coordinator.claim(101)).thenReturn(new ClaimDecision.Granted(claim));

        WritingGradingFailure failure = WritingGradingFailure.unavailable("IMAGE_UNAVAILABLE", "Image not found");
        when(imageLoader.load(any(), any())).thenThrow(new WritingGradingException(failure));

        worker.process(101);

        verify(coordinator).claim(101);
        verify(coordinator).fail(claim, failure);
        verifyNoInteractions(generator);
        verify(coordinator, never()).complete(any(), any());
    }

    @Test
    @DisplayName("process - khi gặp exception bất ngờ: gọi coordinator.fail với retryable UNEXPECTED_ERROR")
    void process_whenUnexpectedExceptionOccurs_callsCoordinatorFailWithRetryable() {
        WritingGradingContext context = new WritingGradingContext(
                1, "q1", "en", "prompt", "This is an essay with more than ten words for testing worker.", 12, List.of()
        );
        Claim claim = new Claim(101, 1, 1, "q1", "run-1", Instant.now().plusSeconds(60), 1, "hash-1", context);
        when(coordinator.claim(101)).thenReturn(new ClaimDecision.Granted(claim));

        when(generator.generate(any(), any(), any())).thenThrow(new RuntimeException("Unexpected NPE or network error"));

        worker.process(101);

        verify(coordinator).claim(101);
        verify(coordinator).fail(eq(claim), argThat(failure ->
                failure.isRetryable() && "UNEXPECTED_ERROR".equals(failure.errorCode())
        ));
        verify(coordinator, never()).complete(any(), any());
    }

    @Test
    @DisplayName("process - kiểm chứng TransactionSynchronizationManager.isActualTransactionActive() == false trong khi load ảnh và generate")
    void process_assertsTransactionNotActive_duringImageLoadAndGenerate() {
        WritingImageRef imgRef = new WritingImageRef("https://example.com/chart.png");
        WritingGradingContext context = new WritingGradingContext(
                1, "q1", "en", "prompt", "This is an essay with more than ten words for testing worker.", 12, List.of(imgRef)
        );
        Instant leaseUntil = Instant.now().plusSeconds(60);
        Claim claim = new Claim(101, 1, 1, "q1", "run-1", leaseUntil, 1, "hash-1", context);
        when(coordinator.claim(101)).thenReturn(new ClaimDecision.Granted(claim));

        AtomicBoolean txActiveDuringImageLoad = new AtomicBoolean(true);
        AtomicBoolean txActiveDuringGenerate = new AtomicBoolean(true);

        when(imageLoader.load(any(), any())).thenAnswer(invocation -> {
            txActiveDuringImageLoad.set(TransactionSynchronizationManager.isActualTransactionActive());
            return new WritingGradingImageLoader.LoadedImages(List.of(), List.of());
        });

        when(generator.generate(any(), any(), any())).thenAnswer(invocation -> {
            txActiveDuringGenerate.set(TransactionSynchronizationManager.isActualTransactionActive());
            return new WritingGrade("WRITING_EN_V1", "vi", new BigDecimal("6.0"), List.of(), "fb", "corr", List.of(), List.of(), null, List.of());
        });

        worker.process(101);

        assertThat(txActiveDuringImageLoad.get()).isFalse();
        assertThat(txActiveDuringGenerate.get()).isFalse();
        verify(coordinator).complete(eq(claim), any());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"claim", "complete", "classified-fail", "unexpected-fail"})
    void process_exceptionLogsContainOnlySafeMetadata(String phase) {
        String[] secrets = {"ESSAY_SENTINEL", "PROMPT_SENTINEL", "FEEDBACK_SENTINEL",
                "https://signed.example.test/image?token=URL_SENTINEL", "RUN_TOKEN_SENTINEL"};
        RuntimeException unsafe = new RuntimeException(String.join(" ", secrets), new IllegalStateException("CAUSE_SENTINEL"));
        WritingGradingContext context = new WritingGradingContext(1, "q1", "en", secrets[1], secrets[0], 12, List.of());
        Claim claim = new Claim(101, 1, 1, "q1", secrets[4], Instant.now().plusSeconds(60), 1, "hash-1", context);
        if (phase.equals("claim")) {
            when(coordinator.claim(101)).thenThrow(unsafe);
        } else {
            when(coordinator.claim(101)).thenReturn(new ClaimDecision.Granted(claim));
            if (phase.equals("classified-fail")) {
                when(generator.generate(any(), any(), any())).thenThrow(new WritingGradingException(
                        WritingGradingFailure.retryable("TIMEOUT", secrets[0])));
            } else if (phase.equals("unexpected-fail")) {
                when(generator.generate(any(), any(), any())).thenThrow(unsafe);
            }
            if (phase.equals("complete")) {
                when(generator.generate(any(), any(), any())).thenReturn(WritingGrade.tooShort(context.originalText()));
                doThrow(unsafe).when(coordinator).complete(eq(claim), any());
            } else doThrow(unsafe).when(coordinator).fail(eq(claim), any());
        }
        var logger = (ch.qos.logback.classic.Logger)org.slf4j.LoggerFactory.getLogger(WritingGradingWorker.class);
        var appender = new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        appender.start(); logger.addAppender(appender);
        try {
            worker.process(101);
            assertThat(appender.list).isNotEmpty();
            for (var event : appender.list) {
                assertThat(event.getFormattedMessage()).doesNotContain(secrets).doesNotContain("CAUSE_SENTINEL");
                assertThat(event.getThrowableProxy()).isNull();
            }
            String code = phase.equals("claim") ? "CLAIM_FAILED"
                    : phase.equals("complete") ? "UNEXPECTED_ERROR" : "FAILURE_RECORD_FAILED";
            assertThat(appender.list.stream().map(e -> e.getFormattedMessage()).toList())
                    .anySatisfy(message -> assertThat(message).contains("101", code));
        } finally { logger.detachAppender(appender); appender.stop(); }
    }

    @Test
    void process_successDoesNotLogRunToken() {
        WritingGradingContext context = new WritingGradingContext(1, "q1", "en", "Prompt", "Essay", 12, List.of());
        Claim claim = new Claim(101, 1, 1, "q1", "RUN_TOKEN_SENTINEL", Instant.now().plusSeconds(60), 1, "hash-1", context);
        when(coordinator.claim(101)).thenReturn(new ClaimDecision.Granted(claim));
        when(generator.generate(any(), any(), any())).thenReturn(WritingGrade.tooShort(context.originalText()));
        var logger = (ch.qos.logback.classic.Logger)org.slf4j.LoggerFactory.getLogger(WritingGradingWorker.class);
        var appender = new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        appender.start(); logger.addAppender(appender);
        try {
            worker.process(101);
            assertThat(appender.list).anySatisfy(event -> assertThat(event.getFormattedMessage()).contains("101").doesNotContain("RUN_TOKEN_SENTINEL"));
            assertThat(appender.list).allSatisfy(event -> {
                assertThat(event.getFormattedMessage()).doesNotContain("RUN_TOKEN_SENTINEL");
                assertThat(event.getThrowableProxy()).isNull();
            });
        } finally { logger.detachAppender(appender); appender.stop(); }
    }
}
