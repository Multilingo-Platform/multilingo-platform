package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.ai.hints.WritingHintGenerator;
import com.multilingo.backend.modules.testing.dto.request.WritingHintsRequest;
import com.multilingo.backend.modules.testing.dto.response.WritingHintsResponse;
import com.multilingo.backend.modules.testing.service.impl.WritingHintsServiceImpl;
import com.multilingo.backend.modules.testing.service.support.WritingHintContextReader;
import com.multilingo.backend.modules.testing.service.support.WritingHintLanguageResolver;
import com.multilingo.backend.modules.testing.service.support.WritingHintTransactionCoordinator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WritingHintsServiceTest {

    @Mock
    private WritingHintTransactionCoordinator coordinator;

    @Mock
    private WritingHintGenerator hintGenerator;

    @Mock
    private IdentityAdapter identityAdapter;

    private WritingHintsServiceImpl service;

    private final Instant now = Instant.parse("2026-10-12T18:00:00Z");

    @BeforeEach
    void setUp() {
        service = new WritingHintsServiceImpl(coordinator, hintGenerator, identityAdapter);
    }

    @Test
    @DisplayName("generate thành công: điều phối qua 3 pha begin -> call -> complete")
    void generateCoordinatesThreePhasesSuccessfully() {
        when(identityAdapter.getCurrentUserId()).thenReturn(1);

        WritingHintsRequest request = new WritingHintsRequest(30, "q-1", "req-1", "en", "vi");

        WritingHintContextReader.HintContext hintCtx = new WritingHintContextReader.HintContext(
                30, "q-1", "Part title", "Part inst", "Group inst", "Prompt", false
        );
        WritingHintLanguageResolver.ResolvedLanguages languages =
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi");

        WritingHintTransactionCoordinator.Reservation reservation = new WritingHintTransactionCoordinator.Reservation(
                100, "run-123", 1, 10, 30, "q-1", "req-1",
                languages, hintCtx, now.plusSeconds(45), 50, now.plusSeconds(3600)
        );

        when(coordinator.begin(1, 10, request))
                .thenReturn(WritingHintTransactionCoordinator.BeginDecision.reserved(reservation));

        WritingHintsResponse.Content content = new WritingHintsResponse.Content(
                List.of(new WritingHintsResponse.OutlineSection("Title", List.of("P1"))),
                List.of(new WritingHintsResponse.VocabularyItem("T1", "D1", "E1", "Ex1")),
                List.of()
        );

        when(hintGenerator.generate(hintCtx, languages))
                .thenReturn(content);

        WritingHintsResponse expectedResponse = WritingHintsResponse.of(
                10, 30, "q-1", "req-1", "en", "vi", now, content
        );

        when(coordinator.complete(reservation, content))
                .thenReturn(WritingHintTransactionCoordinator.TerminalDecision.success(expectedResponse));

        WritingHintsResponse actual = service.generate(10, request);

        assertThat(actual).isNotNull();
        assertThat(actual.attemptId()).isEqualTo(10);
        assertThat(actual.requestId()).isEqualTo("req-1");
        verify(coordinator).begin(1, 10, request);
        verify(hintGenerator).generate(hintCtx, languages);
        verify(coordinator).complete(reservation, content);
    }

    @Test
    @DisplayName("Assert provider chạy ngoài transaction (TransactionSynchronizationManager active is false)")
    void providerRunsOutsideTransaction() {
        when(identityAdapter.getCurrentUserId()).thenReturn(1);

        WritingHintsRequest request = new WritingHintsRequest(30, "q-1", "req-1", "en", "vi");
        WritingHintContextReader.HintContext hintCtx = new WritingHintContextReader.HintContext(
                30, "q-1", "Part title", "Part inst", "Group inst", "Prompt", false
        );
        WritingHintLanguageResolver.ResolvedLanguages languages =
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi");

        WritingHintTransactionCoordinator.Reservation reservation = new WritingHintTransactionCoordinator.Reservation(
                100, "run-123", 1, 10, 30, "q-1", "req-1",
                languages, hintCtx, now.plusSeconds(45), 50, now.plusSeconds(3600)
        );

        when(coordinator.begin(1, 10, request))
                .thenReturn(WritingHintTransactionCoordinator.BeginDecision.reserved(reservation));

        // When generator is called, verify that no DB transaction is active
        when(hintGenerator.generate(hintCtx, languages))
                .thenAnswer(inv -> {
                    assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
                    return new WritingHintsResponse.Content(List.of(), List.of(), List.of());
                });

        WritingHintsResponse expectedResponse = WritingHintsResponse.of(
                10, 30, "q-1", "req-1", "en", "vi", now,
                new WritingHintsResponse.Content(List.of(), List.of(), List.of())
        );
        when(coordinator.complete(eq(reservation), any()))
                .thenReturn(WritingHintTransactionCoordinator.TerminalDecision.success(expectedResponse));

        service.generate(10, request);
        verify(hintGenerator).generate(hintCtx, languages);
    }

    @Test
    @DisplayName("generate Replay: trả về kết quả đã lưu mà không gọi provider")
    void generateReplayDoesNotCallProvider() {
        when(identityAdapter.getCurrentUserId()).thenReturn(1);

        WritingHintsRequest request = new WritingHintsRequest(30, "q-1", "req-1", "en", "vi");

        WritingHintsResponse cachedResponse = WritingHintsResponse.of(
                10, 30, "q-1", "req-1", "en", "vi", now,
                new WritingHintsResponse.Content(List.of(), List.of(), List.of())
        );

        when(coordinator.begin(1, 10, request))
                .thenReturn(WritingHintTransactionCoordinator.BeginDecision.replay(cachedResponse));

        WritingHintsResponse actual = service.generate(10, request);

        assertThat(actual).isEqualTo(cachedResponse);
        verifyNoInteractions(hintGenerator);
        verify(coordinator, never()).complete(any(), any());
    }

    @Test
    @DisplayName("generate khi provider ném lỗi: gọi fail để hoàn quota/ghi FAILED trước khi ném ngoại lệ")
    void generateCallsFailWhenProviderThrowsException() {
        when(identityAdapter.getCurrentUserId()).thenReturn(1);

        WritingHintsRequest request = new WritingHintsRequest(30, "q-1", "req-1", "en", "vi");
        WritingHintContextReader.HintContext hintCtx = new WritingHintContextReader.HintContext(
                30, "q-1", "Part title", "Part inst", "Group inst", "Prompt", false
        );
        WritingHintLanguageResolver.ResolvedLanguages languages =
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi");

        WritingHintTransactionCoordinator.Reservation reservation = new WritingHintTransactionCoordinator.Reservation(
                100, "run-123", 1, 10, 30, "q-1", "req-1",
                languages, hintCtx, now.plusSeconds(45), 50, now.plusSeconds(3600)
        );

        when(coordinator.begin(1, 10, request))
                .thenReturn(WritingHintTransactionCoordinator.BeginDecision.reserved(reservation));

        when(hintGenerator.generate(hintCtx, languages))
                .thenThrow(new AppException(ErrorCode.WRITING_HINTS_TIMEOUT, "Gemini timed out"));

        when(coordinator.fail(reservation, ErrorCode.WRITING_HINTS_TIMEOUT, "Gemini timed out"))
                .thenReturn(WritingHintTransactionCoordinator.TerminalDecision.failure(ErrorCode.WRITING_HINTS_TIMEOUT, "Gemini timed out"));

        assertThatThrownBy(() -> service.generate(10, request))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.WRITING_HINTS_TIMEOUT));

        verify(coordinator).fail(reservation, ErrorCode.WRITING_HINTS_TIMEOUT, "Gemini timed out");
        verify(coordinator, never()).complete(any(), any());
    }

    @Test
    @DisplayName("generate khi attempt bị kết thúc giữa chừng: complete trả failure và service ném lỗi")
    void generateThrowsWhenAttemptEndedDuringGeneration() {
        when(identityAdapter.getCurrentUserId()).thenReturn(1);

        WritingHintsRequest request = new WritingHintsRequest(30, "q-1", "req-1", "en", "vi");
        WritingHintContextReader.HintContext hintCtx = new WritingHintContextReader.HintContext(
                30, "q-1", "Part title", "Part inst", "Group inst", "Prompt", false
        );
        WritingHintLanguageResolver.ResolvedLanguages languages =
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi");

        WritingHintTransactionCoordinator.Reservation reservation = new WritingHintTransactionCoordinator.Reservation(
                100, "run-123", 1, 10, 30, "q-1", "req-1",
                languages, hintCtx, now.plusSeconds(45), 50, now.plusSeconds(3600)
        );

        when(coordinator.begin(1, 10, request))
                .thenReturn(WritingHintTransactionCoordinator.BeginDecision.reserved(reservation));

        WritingHintsResponse.Content content = new WritingHintsResponse.Content(List.of(), List.of(), List.of());
        when(hintGenerator.generate(hintCtx, languages)).thenReturn(content);

        when(coordinator.complete(reservation, content))
                .thenReturn(WritingHintTransactionCoordinator.TerminalDecision.failure(
                        ErrorCode.ATTEMPT_ALREADY_SUBMITTED, "Bài thi đã kết thúc"
                ));

        assertThatThrownBy(() -> service.generate(10, request))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.ATTEMPT_ALREADY_SUBMITTED));
    }

    @Test
    @DisplayName("Hai request cùng requestId chỉ gọi Gemini một lần và trả về cùng response")
    void twoRequestsSameRequestIdCallsGeminiOnlyOnce() {
        when(identityAdapter.getCurrentUserId()).thenReturn(1);

        WritingHintsRequest request = new WritingHintsRequest(30, "q-1", "req-idempotent", "en", "vi");
        WritingHintContextReader.HintContext hintCtx = new WritingHintContextReader.HintContext(
                30, "q-1", "Part title", "Part inst", "Group inst", "Prompt", false
        );
        WritingHintLanguageResolver.ResolvedLanguages languages =
                new WritingHintLanguageResolver.ResolvedLanguages("en", "vi");

        WritingHintTransactionCoordinator.Reservation reservation = new WritingHintTransactionCoordinator.Reservation(
                100, "run-123", 1, 10, 30, "q-1", "req-idempotent",
                languages, hintCtx, now.plusSeconds(45), 50, now.plusSeconds(3600)
        );

        WritingHintsResponse.Content content = new WritingHintsResponse.Content(
                List.of(new WritingHintsResponse.OutlineSection("Title", List.of("Point 1"))),
                List.of(new WritingHintsResponse.VocabularyItem("Term", "Def", "Exp", "Ex")),
                List.of()
        );

        WritingHintsResponse response = WritingHintsResponse.of(
                10, 30, "q-1", "req-idempotent", "en", "vi", now, content
        );

        // Request 1: Reserved -> generate -> complete -> success
        when(coordinator.begin(1, 10, request))
                .thenReturn(WritingHintTransactionCoordinator.BeginDecision.reserved(reservation));
        when(hintGenerator.generate(hintCtx, languages))
                .thenReturn(content);
        when(coordinator.complete(reservation, content))
                .thenReturn(WritingHintTransactionCoordinator.TerminalDecision.success(response));

        WritingHintsResponse response1 = service.generate(10, request);
        assertThat(response1).isEqualTo(response);

        // Request 2: Replay -> immediately returns response without calling Gemini
        when(coordinator.begin(1, 10, request))
                .thenReturn(WritingHintTransactionCoordinator.BeginDecision.replay(response));

        WritingHintsResponse response2 = service.generate(10, request);
        assertThat(response2).isEqualTo(response);

        // Verify Gemini generator was invoked exactly 1 time across both requests!
        verify(hintGenerator, times(1)).generate(hintCtx, languages);
    }
}
