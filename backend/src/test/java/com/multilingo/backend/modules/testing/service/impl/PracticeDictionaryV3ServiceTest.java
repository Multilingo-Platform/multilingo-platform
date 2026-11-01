package com.multilingo.backend.modules.testing.service.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.ai.dictionary.DictionaryLookupV2Generator;
import com.multilingo.backend.modules.testing.ai.dictionary.DictionaryLookupV2OutputParser;
import com.multilingo.backend.modules.testing.config.DictionaryLookupProperties;
import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupV3Request;
import com.multilingo.backend.modules.testing.dto.request.WorkspaceTextSource;
import com.multilingo.backend.modules.testing.dto.response.DictionaryLookupV2Response;
import com.multilingo.backend.modules.testing.dto.response.DictionaryLookupV3Response;
import com.multilingo.backend.modules.testing.service.support.DictionaryLookupTransactionCoordinator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PracticeDictionaryV3ServiceTest {
    @Mock private DictionaryLookupProperties properties;
    @Mock private IdentityAdapter identityAdapter;
    @Mock private DictionaryLookupTransactionCoordinator coordinator;
    @Mock private DictionaryLookupV2Generator generator;

    private PracticeDictionaryV3ServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new PracticeDictionaryV3ServiceImpl(properties, identityAdapter, coordinator, generator);
    }

    @Test
    @DisplayName("throwsUnavailable_whenFeatureDisabled")
    void throwsUnavailable_whenFeatureDisabled() {
        when(properties.isEnabled()).thenReturn(false);
        var req = sampleRequest();
        assertThatThrownBy(() -> service.lookup(10, req))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.DICTIONARY_LOOKUP_UNAVAILABLE);
        verifyNoInteractions(coordinator, generator);
    }

    @Test
    @DisplayName("returnsReplay_whenReplayV3DecisionReturned")
    void returnsReplay_whenReplayV3DecisionReturned() {
        when(properties.isEnabled()).thenReturn(true);
        when(identityAdapter.getCurrentUserId()).thenReturn(100);
        var req = sampleRequest();
        var cached = new DictionaryLookupV3Response(
                req.requestId(), 10, 1, req.source(), "word", "word in context",
                DictionaryLookupV3Response.CURRENT_POLICY_VERSION,
                new DictionaryLookupV2Response.DictionaryDefinitionV2(2, "en", "vi", "từ", null, "noun", "example", "ví dụ"));
        when(coordinator.beginV3(100, 10, req)).thenReturn(new DictionaryLookupTransactionCoordinator.ReplayV3(cached));

        DictionaryLookupV3Response result = service.lookup(10, req);
        assertThat(result).isSameAs(cached);
        verifyNoInteractions(generator);
        verify(coordinator, never()).completeV3(any(), any());
    }

    @Test
    @DisplayName("successfulLookup_callsGeneratorAndCompletesV3")
    void successfulLookup_callsGeneratorAndCompletesV3() {
        when(properties.isEnabled()).thenReturn(true);
        when(identityAdapter.getCurrentUserId()).thenReturn(100);
        var req = sampleRequest();
        var res = new DictionaryLookupTransactionCoordinator.Reservation(
                12, "run-1", 100, 10, null, req, "word in context", 5,
                Instant.now().plusSeconds(3600), Instant.now().plusSeconds(30), "en", "vi");
        when(coordinator.beginV3(100, 10, req)).thenReturn(new DictionaryLookupTransactionCoordinator.Reserved(res));

        var def = new DictionaryLookupV2OutputParser.DictionaryLookupDefinitionV2(
                "từ", null, "noun", "example", "ví dụ");
        when(generator.generate("word", "word in context", "en", "vi")).thenReturn(def);

        var finalResponse = new DictionaryLookupV3Response(
                req.requestId(), 10, 1, req.source(), "word", "word in context",
                DictionaryLookupV3Response.CURRENT_POLICY_VERSION,
                new DictionaryLookupV2Response.DictionaryDefinitionV2(2, "en", "vi", "từ", null, "noun", "example", "ví dụ"));
        when(coordinator.completeV3(res, def)).thenReturn(Optional.of(finalResponse));

        DictionaryLookupV3Response result = service.lookup(10, req);
        assertThat(result).isSameAs(finalResponse);
        verify(coordinator).completeV3(res, def);
    }

    @Test
    @DisplayName("handlesAppException_callsCoordinatorFailAndRethrows")
    void handlesAppException_callsCoordinatorFailAndRethrows() {
        when(properties.isEnabled()).thenReturn(true);
        when(identityAdapter.getCurrentUserId()).thenReturn(100);
        var req = sampleRequest();
        var res = new DictionaryLookupTransactionCoordinator.Reservation(
                12, "run-1", 100, 10, null, req, "word in context", 5,
                Instant.now().plusSeconds(3600), Instant.now().plusSeconds(30), "en", "vi");
        when(coordinator.beginV3(100, 10, req)).thenReturn(new DictionaryLookupTransactionCoordinator.Reserved(res));
        when(generator.generate("word", "word in context", "en", "vi"))
                .thenThrow(new AppException(ErrorCode.DICTIONARY_LOOKUP_RATE_LIMITED));

        assertThatThrownBy(() -> service.lookup(10, req))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.DICTIONARY_LOOKUP_RATE_LIMITED);

        verify(coordinator).fail(res, ErrorCode.DICTIONARY_LOOKUP_RATE_LIMITED.name());
        verify(coordinator, never()).completeV3(any(), any());
    }

    @Test
    @DisplayName("handlesGenericException_callsCoordinatorFailAndThrowsUnavailable")
    void handlesGenericException_callsCoordinatorFailAndThrowsUnavailable() {
        when(properties.isEnabled()).thenReturn(true);
        when(identityAdapter.getCurrentUserId()).thenReturn(100);
        var req = sampleRequest();
        var res = new DictionaryLookupTransactionCoordinator.Reservation(
                12, "run-1", 100, 10, null, req, "word in context", 5,
                Instant.now().plusSeconds(3600), Instant.now().plusSeconds(30), "en", "vi");
        when(coordinator.beginV3(100, 10, req)).thenReturn(new DictionaryLookupTransactionCoordinator.Reserved(res));
        when(generator.generate("word", "word in context", "en", "vi"))
                .thenThrow(new RuntimeException("Provider connection failed"));

        assertThatThrownBy(() -> service.lookup(10, req))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.DICTIONARY_LOOKUP_UNAVAILABLE);

        verify(coordinator).fail(res, "PROVIDER_FAILURE");
        verify(coordinator, never()).completeV3(any(), any());
    }

    @Test
    @DisplayName("throwsConflict_whenCompleteV3ReturnsEmpty")
    void throwsConflict_whenCompleteV3ReturnsEmpty() {
        when(properties.isEnabled()).thenReturn(true);
        when(identityAdapter.getCurrentUserId()).thenReturn(100);
        var req = sampleRequest();
        var res = new DictionaryLookupTransactionCoordinator.Reservation(
                12, "run-1", 100, 10, null, req, "word in context", 5,
                Instant.now().plusSeconds(3600), Instant.now().plusSeconds(30), "en", "vi");
        when(coordinator.beginV3(100, 10, req)).thenReturn(new DictionaryLookupTransactionCoordinator.Reserved(res));

        var def = new DictionaryLookupV2OutputParser.DictionaryLookupDefinitionV2(
                "từ", null, "noun", "example", "ví dụ");
        when(generator.generate("word", "word in context", "en", "vi")).thenReturn(def);
        when(coordinator.completeV3(res, def)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.lookup(10, req))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.CONFLICT);
    }

    private DictionaryLookupV3Request sampleRequest() {
        return new DictionaryLookupV3Request(
                UUID.randomUUID().toString(),
                1,
                WorkspaceTextSource.part(WorkspaceTextSource.Kind.PART_CONTENT),
                "word",
                "word in context");
    }
}
