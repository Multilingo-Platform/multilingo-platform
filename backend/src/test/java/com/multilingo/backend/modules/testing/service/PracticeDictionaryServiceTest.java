package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.ai.dictionary.DictionaryLookupGenerator;
import com.multilingo.backend.modules.testing.config.DictionaryLookupProperties;
import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupRequest;
import com.multilingo.backend.modules.testing.dto.response.DictionaryLookupResponse;
import com.multilingo.backend.modules.testing.service.impl.PracticeDictionaryServiceImpl;
import com.multilingo.backend.modules.testing.service.support.DictionaryLookupTransactionCoordinator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PracticeDictionaryServiceTest {
    private DictionaryLookupProperties properties;
    private IdentityAdapter identity;
    private DictionaryLookupTransactionCoordinator coordinator;
    private DictionaryLookupGenerator generator;
    private PracticeDictionaryServiceImpl service;

    @BeforeEach
    void setup() {
        properties = new DictionaryLookupProperties();
        identity = mock(IdentityAdapter.class);
        coordinator = mock(DictionaryLookupTransactionCoordinator.class);
        generator = mock(DictionaryLookupGenerator.class);
        service = new PracticeDictionaryServiceImpl(properties, identity, coordinator, generator);
    }

    @Test
    void disabledFeatureFailsBeforeIdentityQuotaOrProvider() {
        assertThatThrownBy(() -> service.lookup(5, request())).isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode()).isEqualTo(ErrorCode.DICTIONARY_LOOKUP_UNAVAILABLE);
        verifyNoInteractions(identity, coordinator, generator);
    }

    @Test
    void successfulLookupUsesReplayOrRunsProviderOutsideCoordinatorAndCompletes() {
        properties.setEnabled(true);
        when(identity.getCurrentUserId()).thenReturn(21);
        var reservation = new DictionaryLookupTransactionCoordinator.Reservation(1, "run", 21, 5, request(),
                "A verified reading sentence.", 2, java.time.Instant.now().plusSeconds(50), java.time.Instant.now().plusSeconds(20));
        var generated = response();
        when(coordinator.begin(21, 5, request())).thenReturn(new DictionaryLookupTransactionCoordinator.Reserved(reservation));
        when(generator.generate(reservation)).thenReturn(generated);
        when(coordinator.complete(reservation, generated)).thenReturn(Optional.of(generated));

        assertThat(service.lookup(5, request())).isEqualTo(generated);
        verify(coordinator).complete(reservation, generated);
        verify(coordinator, never()).fail(any(), anyString());
    }

    @Test
    void cachedIdempotentReplayDoesNotCallProviderOrCompleteAgain() {
        properties.setEnabled(true);
        when(identity.getCurrentUserId()).thenReturn(21);
        var cached = response();
        when(coordinator.begin(21, 5, request())).thenReturn(new DictionaryLookupTransactionCoordinator.Replay(cached));

        assertThat(service.lookup(5, request())).isEqualTo(cached);
        verifyNoInteractions(generator);
        verify(coordinator, never()).complete(any(), any());
    }

    @Test
    void providerFailureRefundsThroughCoordinatorAndNeverReturnsMockResult() {
        properties.setEnabled(true);
        when(identity.getCurrentUserId()).thenReturn(21);
        var reservation = new DictionaryLookupTransactionCoordinator.Reservation(1, "run", 21, 5, request(),
                "A verified reading sentence.", 2, java.time.Instant.now().plusSeconds(50), java.time.Instant.now().plusSeconds(20));
        when(coordinator.begin(21, 5, request())).thenReturn(new DictionaryLookupTransactionCoordinator.Reserved(reservation));
        when(generator.generate(reservation)).thenThrow(new AppException(ErrorCode.DICTIONARY_LOOKUP_TIMEOUT));

        assertThatThrownBy(() -> service.lookup(5, request())).isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode()).isEqualTo(ErrorCode.DICTIONARY_LOOKUP_TIMEOUT);
        verify(coordinator).fail(reservation, ErrorCode.DICTIONARY_LOOKUP_TIMEOUT.name());
        verify(coordinator, never()).complete(any(), any());
    }

    private DictionaryLookupRequest request() {
        return new DictionaryLookupRequest(UUID.fromString("7b2d4a6a-d1a0-4b22-83c1-18f860288231").toString(),
                2, "reading-group", "contextual", "A verified reading sentence.");
    }

    private DictionaryLookupResponse response() {
        return new DictionaryLookupResponse(request().requestId(), 5, 2, "reading-group", "contextual",
                "A verified reading sentence.", "en", "vi", "theo ngữ cảnh", null, "adjective", "A contextual example.", "Ví dụ theo ngữ cảnh.");
    }
}
