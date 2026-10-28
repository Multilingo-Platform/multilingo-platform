package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import com.multilingo.backend.modules.testing.adapter.LearningLanguageAdapter;
import com.multilingo.backend.modules.testing.dto.response.DictionaryLanguageContextResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Objects;
import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class DictionaryNativeLanguageResolver {

    private final LearningLanguageCatalog catalog;
    private final LearningLanguageAdapter userLanguages;

    /**
     * Resolves the dictionary language context for a workspace attempt.
     * Prevents leaking owner's native language if currentUserId is not the owner.
     * Returns an unavailable response instead of throwing exceptions, ensuring workspace load is never broken.
     *
     * @param attemptOwnerId user ID who owns the attempt
     * @param currentUserId  user ID of the current authenticated user
     * @return DictionaryLanguageContextResponse
     */
    public DictionaryLanguageContextResponse resolve(Integer attemptOwnerId, Integer currentUserId) {
        if (attemptOwnerId == null) {
            return DictionaryLanguageContextResponse.unavailable(DictionaryLanguageContextResponse.REASON_REQUIRED);
        }
        if (currentUserId == null || !Objects.equals(attemptOwnerId, currentUserId)) {
            return DictionaryLanguageContextResponse.unavailable(DictionaryLanguageContextResponse.REASON_NOT_OWNER);
        }

        if (userLanguages == null || catalog == null) {
            return DictionaryLanguageContextResponse.unavailable(DictionaryLanguageContextResponse.REASON_REQUIRED);
        }

        Optional<String> nativeLangOpt = userLanguages.findNativeLanguage(attemptOwnerId);
        if (nativeLangOpt.isEmpty() || nativeLangOpt.get().isBlank()) {
            return DictionaryLanguageContextResponse.unavailable(DictionaryLanguageContextResponse.REASON_REQUIRED);
        }

        String rawTag = nativeLangOpt.get().trim();
        Optional<String> normalizedOpt = catalog.findNormalized(rawTag);
        if (normalizedOpt.isEmpty()) {
            return DictionaryLanguageContextResponse.unavailable(DictionaryLanguageContextResponse.REASON_UNSUPPORTED);
        }

        return DictionaryLanguageContextResponse.available(normalizedOpt.get());
    }

    /**
     * Convenience method to resolve native language for a single user (assumes caller is self).
     *
     * @param userId user ID
     * @return DictionaryLanguageContextResponse
     */
    public DictionaryLanguageContextResponse resolve(Integer userId) {
        return resolve(userId, userId);
    }

    /**
     * Validates and returns the normalized native language for an attempt and current user,
     * or throws an AppException if unauthorized, missing, or unsupported.
     * Used by Dictionary lookup services (RD-03) before quota reservation or AI provider invocation.
     *
     * @param attemptOwnerId user ID who owns the attempt
     * @param currentUserId  user ID of the current authenticated user
     * @return normalized BCP 47 language code
     * @throws AppException(ErrorCode.FORBIDDEN) if caller does not own attempt
     * @throws AppException(ErrorCode.DICTIONARY_NATIVE_LANGUAGE_REQUIRED) if native language is missing or unsupported
     */
    public String requireNativeLanguage(Integer attemptOwnerId, Integer currentUserId) {
        if (attemptOwnerId == null || currentUserId == null || !Objects.equals(attemptOwnerId, currentUserId)) {
            throw new AppException(ErrorCode.FORBIDDEN, "Not the owner of this attempt");
        }

        if (userLanguages == null || catalog == null) {
            throw new AppException(ErrorCode.DICTIONARY_NATIVE_LANGUAGE_REQUIRED, "Language services unavailable");
        }

        Optional<String> nativeLangOpt = userLanguages.findNativeLanguage(attemptOwnerId);
        if (nativeLangOpt.isEmpty() || nativeLangOpt.get().isBlank()) {
            throw new AppException(ErrorCode.DICTIONARY_NATIVE_LANGUAGE_REQUIRED,
                    "Native language is required in user profile for dictionary lookup");
        }

        String rawTag = nativeLangOpt.get().trim();
        return catalog.findNormalized(rawTag).orElseThrow(() ->
                new AppException(ErrorCode.DICTIONARY_NATIVE_LANGUAGE_REQUIRED,
                        "Native language in user profile is unsupported for dictionary lookup"));
    }
}
