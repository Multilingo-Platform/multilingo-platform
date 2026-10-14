package com.multilingo.backend.modules.auth.service.impl;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.auth.dto.GoogleTokenPayload;
import com.multilingo.backend.modules.auth.service.GoogleTokenVerifierService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Collections;

@Service
public class GoogleTokenVerifierServiceImpl implements GoogleTokenVerifierService {

    private final GoogleIdTokenVerifier verifier;

    @org.springframework.beans.factory.annotation.Autowired
    public GoogleTokenVerifierServiceImpl(@Value("${app.google.client-id:}") String clientId) {
        GoogleIdTokenVerifier.Builder builder = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), new GsonFactory());
        if (clientId != null && !clientId.isBlank()) {
            builder.setAudience(Collections.singletonList(clientId));
        }
        this.verifier = builder.build();
    }

    public GoogleTokenVerifierServiceImpl(GoogleIdTokenVerifier verifier) {
        this.verifier = verifier;
    }

    @Override
    public GoogleTokenPayload verify(String idToken) {
        if (idToken == null || idToken.isBlank()) {
            throw new AppException(ErrorCode.INVALID_GOOGLE_TOKEN);
        }

        try {
            GoogleIdToken googleIdToken = verifier.verify(idToken);
            if (googleIdToken == null) {
                throw new AppException(ErrorCode.INVALID_GOOGLE_TOKEN);
            }

            GoogleIdToken.Payload payload = googleIdToken.getPayload();
            if (!Boolean.TRUE.equals(payload.getEmailVerified())) {
                throw new AppException(ErrorCode.GOOGLE_EMAIL_NOT_VERIFIED);
            }

            return GoogleTokenPayload.builder()
                    .sub(payload.getSubject())
                    .email(payload.getEmail())
                    .fullName((String) payload.get("name"))
                    .avatarUrl((String) payload.get("picture"))
                    .emailVerified(true)
                    .build();
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            throw new AppException(ErrorCode.INVALID_GOOGLE_TOKEN);
        }
    }
}
