package com.multilingo.backend.modules.testing.service.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.ai.dictionary.DictionaryLookupV2Generator;
import com.multilingo.backend.modules.testing.ai.dictionary.DictionaryLookupV2OutputParser;
import com.multilingo.backend.modules.testing.config.DictionaryLookupProperties;
import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupRequest;
import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupV2Request;
import com.multilingo.backend.modules.testing.dto.response.DictionaryLookupV2Response;
import com.multilingo.backend.modules.testing.service.support.DictionaryLookupTransactionCoordinator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PracticeDictionaryV2ServiceTest {
    @Mock private DictionaryLookupProperties properties;
    @Mock private IdentityAdapter identityAdapter;
    @Mock private DictionaryLookupTransactionCoordinator coordinator;
    @Mock private DictionaryLookupV2Generator generator;

    private PracticeDictionaryV2ServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new PracticeDictionaryV2ServiceImpl(properties, identityAdapter, coordinator, generator);
    }

    @Test
    @DisplayName("throwsUnavailable_whenFeatureDisabled")
    void throwsUnavailable_whenFeatureDisabled() {
        when(properties.isEnabled()).thenReturn(false);
        var req = new DictionaryLookupV2Request("req-1", 1, "doc-1", "word", "word in context", "vi");
        assertThatThrownBy(() -> service.lookup(10, req))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.DICTIONARY_LOOKUP_UNAVAILABLE);
        verifyNoInteractions(coordinator, generator);
    }

    @Test
    @DisplayName("returnsReplay_whenReplayV2DecisionReturned")
    void returnsReplay_whenReplayV2DecisionReturned() {
        when(properties.isEnabled()).thenReturn(true);
        when(identityAdapter.getCurrentUserId()).thenReturn(100);
        var req = new DictionaryLookupV2Request("req-1", 1, "doc-1", "word", "word in context", "vi");
        var cached = new DictionaryLookupV2Response("req-1", 10, 1, "doc-1", "word", "word in context",
                new DictionaryLookupV2Response.DictionaryDefinitionV2(1, "en", "vi", "từ", null, "noun", "example", "ví dụ"));
        when(coordinator.beginV2(100, 10, req)).thenReturn(new DictionaryLookupTransactionCoordinator.ReplayV2(cached));

        DictionaryLookupV2Response result = service.lookup(10, req);
        assertThat(result).isSameAs(cached);
        verifyNoInteractions(generator);
        verify(coordinator, never()).completeV2(any(), any());
    }

    @Test
    @DisplayName("successfulLookup_callsGeneratorAndCompletesV2")
    void successfulLookup_callsGeneratorAndCompletesV2() {
        when(properties.isEnabled()).thenReturn(true);
        when(identityAdapter.getCurrentUserId()).thenReturn(100);
        var req = new DictionaryLookupV2Request("req-1", 1, "doc-1", "word", "word in context", "vi");
        var internalReq = new DictionaryLookupRequest("req-1", 1, "doc-1", "word", "word in context");
        var res = new DictionaryLookupTransactionCoordinator.Reservation(
                12, "run-1", 100, 10, internalReq, "word in context", 5,
                Instant.now().plusSeconds(3600), Instant.now().plusSeconds(30), "en", "vi");
        when(coordinator.beginV2(100, 10, req)).thenReturn(new DictionaryLookupTransactionCoordinator.Reserved(res));

        var def = new DictionaryLookupV2OutputParser.DictionaryLookupDefinitionV2(
                "từ", null, "noun", "example", "ví dụ");
        when(generator.generate("word", "word in context", "en", "vi")).thenReturn(def);

        var finalResponse = new DictionaryLookupV2Response("req-1", 10, 1, "doc-1", "word", "word in context",
                new DictionaryLookupV2Response.DictionaryDefinitionV2(1, "en", "vi", "từ", null, "noun", "example", "ví dụ"));
        when(coordinator.completeV2(res, def)).thenReturn(Optional.of(finalResponse));

        DictionaryLookupV2Response result = service.lookup(10, req);
        assertThat(result).isSameAs(finalResponse);
        verify(coordinator).completeV2(res, def);
    }

    @Test
    @DisplayName("handlesAppException_callsCoordinatorFailAndRethrows")
    void handlesAppException_callsCoordinatorFailAndRethrows() {
        when(properties.isEnabled()).thenReturn(true);
        when(identityAdapter.getCurrentUserId()).thenReturn(100);
        var req = new DictionaryLookupV2Request("req-1", 1, "doc-1", "word", "word in context", "vi");
        var internalReq = new DictionaryLookupRequest("req-1", 1, "doc-1", "word", "word in context");
        var res = new DictionaryLookupTransactionCoordinator.Reservation(
                12, "run-1", 100, 10, internalReq, "word in context", 5,
                Instant.now().plusSeconds(3600), Instant.now().plusSeconds(30), "en", "vi");
        when(coordinator.beginV2(100, 10, req)).thenReturn(new DictionaryLookupTransactionCoordinator.Reserved(res));

        when(generator.generate("word", "word in context", "en", "vi"))
                .thenThrow(new AppException(ErrorCode.DICTIONARY_LOOKUP_RATE_LIMITED));

        assertThatThrownBy(() -> service.lookup(10, req))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.DICTIONARY_LOOKUP_RATE_LIMITED);

        verify(coordinator).fail(res, "DICTIONARY_LOOKUP_RATE_LIMITED");
        verify(coordinator, never()).completeV2(any(), any());
    }

    @Test
    @DisplayName("handlesGenericException_callsCoordinatorFailAndThrowsUnavailable")
    void handlesGenericException_callsCoordinatorFailAndThrowsUnavailable() {
        when(properties.isEnabled()).thenReturn(true);
        when(identityAdapter.getCurrentUserId()).thenReturn(100);
        var req = new DictionaryLookupV2Request("req-1", 1, "doc-1", "word", "word in context", "vi");
        var internalReq = new DictionaryLookupRequest("req-1", 1, "doc-1", "word", "word in context");
        var res = new DictionaryLookupTransactionCoordinator.Reservation(
                12, "run-1", 100, 10, internalReq, "word in context", 5,
                Instant.now().plusSeconds(3600), Instant.now().plusSeconds(30), "en", "vi");
        when(coordinator.beginV2(100, 10, req)).thenReturn(new DictionaryLookupTransactionCoordinator.Reserved(res));

        when(generator.generate("word", "word in context", "en", "vi"))
                .thenThrow(new RuntimeException("Gemini network error"));

        assertThatThrownBy(() -> service.lookup(10, req))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.DICTIONARY_LOOKUP_UNAVAILABLE);

        verify(coordinator).fail(res, "PROVIDER_FAILURE");
    }

    @Test
    @DisplayName("throwsConflict_whenCompleteV2ReturnsEmpty")
    void throwsConflict_whenCompleteV2ReturnsEmpty() {
        when(properties.isEnabled()).thenReturn(true);
        when(identityAdapter.getCurrentUserId()).thenReturn(100);
        var req = new DictionaryLookupV2Request("req-1", 1, "doc-1", "word", "word in context", "vi");
        var internalReq = new DictionaryLookupRequest("req-1", 1, "doc-1", "word", "word in context");
        var res = new DictionaryLookupTransactionCoordinator.Reservation(
                12, "run-1", 100, 10, internalReq, "word in context", 5,
                Instant.now().plusSeconds(3600), Instant.now().plusSeconds(30), "en", "vi");
        when(coordinator.beginV2(100, 10, req)).thenReturn(new DictionaryLookupTransactionCoordinator.Reserved(res));

        var def = new DictionaryLookupV2OutputParser.DictionaryLookupDefinitionV2(
                "từ", null, "noun", "example", "ví dụ");
        when(generator.generate("word", "word in context", "en", "vi")).thenReturn(def);
        when(coordinator.completeV2(res, def)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.lookup(10, req))
                .isInstanceOf(AppException.class)
                .matches(e -> ((AppException) e).getErrorCode() == ErrorCode.CONFLICT);
    }
}
