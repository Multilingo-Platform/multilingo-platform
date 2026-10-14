package com.multilingo.backend.modules.auth.service;

import com.multilingo.backend.modules.auth.dto.GoogleTokenPayload;

public interface GoogleTokenVerifierService {
    GoogleTokenPayload verify(String idToken);
}
