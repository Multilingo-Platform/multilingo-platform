package com.multilingo.backend.modules.testing.service.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.ai.dictionary.DictionaryLookupV2Generator;
import com.multilingo.backend.modules.testing.config.DictionaryLookupProperties;
import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupV2Request;
import com.multilingo.backend.modules.testing.dto.response.DictionaryLookupV2Response;
import com.multilingo.backend.modules.testing.service.PracticeDictionaryV2Service;
import com.multilingo.backend.modules.testing.service.support.DictionaryLookupTransactionCoordinator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PracticeDictionaryV2ServiceImpl implements PracticeDictionaryV2Service {
    private final DictionaryLookupProperties properties;
    private final IdentityAdapter identityAdapter;
    private final DictionaryLookupTransactionCoordinator coordinator;
    private final DictionaryLookupV2Generator generator;

    @Override
    public DictionaryLookupV2Response lookup(Integer attemptId, DictionaryLookupV2Request request) {
        if (!properties.isEnabled()) throw new AppException(ErrorCode.DICTIONARY_LOOKUP_UNAVAILABLE);
        var decision = coordinator.beginV2(identityAdapter.getCurrentUserId(), attemptId, request);
        if (decision instanceof DictionaryLookupTransactionCoordinator.ReplayV2 replay) return replay.response();
        if (!(decision instanceof DictionaryLookupTransactionCoordinator.Reserved reserved)) {
            throw new AppException(ErrorCode.DICTIONARY_LOOKUP_INVALID_RESPONSE);
        }
        var reservation = reserved.reservation();
        try {
            var definition = generator.generate(reservation.request().selectedText(), reservation.sourceContext(),
                    reservation.learningLanguage(), reservation.meaningLanguage());
            return coordinator.completeV2(reservation, definition).orElseThrow(() ->
                    new AppException(ErrorCode.CONFLICT, "The attempt changed while the dictionary lookup was running"));
        } catch (AppException e) {
            coordinator.fail(reservation, e.getErrorCode().name());
            throw e;
        } catch (Exception e) {
            coordinator.fail(reservation, "PROVIDER_FAILURE");
            throw new AppException(ErrorCode.DICTIONARY_LOOKUP_UNAVAILABLE);
        }
    }
}
