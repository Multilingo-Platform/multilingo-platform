package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupV3Request;
import com.multilingo.backend.modules.testing.dto.response.DictionaryLookupV3Response;

public interface PracticeDictionaryV3Service {
    DictionaryLookupV3Response lookup(Integer attemptId, DictionaryLookupV3Request request);
}
