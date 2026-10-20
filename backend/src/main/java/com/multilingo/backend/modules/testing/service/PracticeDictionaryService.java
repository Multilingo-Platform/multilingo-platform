package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupRequest;
import com.multilingo.backend.modules.testing.dto.response.DictionaryLookupResponse;

public interface PracticeDictionaryService {
    DictionaryLookupResponse lookup(Integer attemptId, DictionaryLookupRequest request);
}
