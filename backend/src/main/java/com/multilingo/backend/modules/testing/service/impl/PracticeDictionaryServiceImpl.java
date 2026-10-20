package com.multilingo.backend.modules.testing.service.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.ai.dictionary.DictionaryLookupGenerator;
import com.multilingo.backend.modules.testing.config.DictionaryLookupProperties;
import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupRequest;
import com.multilingo.backend.modules.testing.dto.response.DictionaryLookupResponse;
import com.multilingo.backend.modules.testing.service.PracticeDictionaryService;
import com.multilingo.backend.modules.testing.service.support.DictionaryLookupTransactionCoordinator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PracticeDictionaryServiceImpl implements PracticeDictionaryService {
    private final DictionaryLookupProperties properties;
    private final IdentityAdapter identityAdapter;
    private final DictionaryLookupTransactionCoordinator coordinator;
    private final DictionaryLookupGenerator generator;

    @Override
    public DictionaryLookupResponse lookup(Integer attemptId, DictionaryLookupRequest request) {
        if (!properties.isEnabled()) throw new AppException(ErrorCode.DICTIONARY_LOOKUP_UNAVAILABLE);
        Integer userId = identityAdapter.getCurrentUserId();
        DictionaryLookupTransactionCoordinator.BeginDecision decision = coordinator.begin(userId, attemptId, request);
        if (decision instanceof DictionaryLookupTransactionCoordinator.Replay replay) return replay.response();
        var reservation = ((DictionaryLookupTransactionCoordinator.Reserved) decision).reservation();

        DictionaryLookupResponse generated;
        try {
            generated = generator.generate(reservation);
        } catch (AppException e) {
            coordinator.fail(reservation, e.getErrorCode().name());
            throw e;
        } catch (Exception e) {
            coordinator.fail(reservation, "PROVIDER_FAILURE");
            throw new AppException(ErrorCode.DICTIONARY_LOOKUP_UNAVAILABLE);
        }

        return coordinator.complete(reservation, generated)
                .orElseThrow(() -> new AppException(ErrorCode.CONFLICT,
                        "The attempt changed while the dictionary lookup was running"));
    }
}
