package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupV2Request;
import com.multilingo.backend.modules.testing.dto.response.DictionaryLookupV2Response;

public interface PracticeDictionaryV2Service {
    DictionaryLookupV2Response lookup(Integer attemptId, DictionaryLookupV2Request request);
}
