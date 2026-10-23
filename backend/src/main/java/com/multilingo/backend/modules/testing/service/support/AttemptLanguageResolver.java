package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import com.multilingo.backend.modules.testing.adapter.LearningLanguageAdapter;
import com.multilingo.backend.modules.testing.config.TestingLanguageProperties;
import com.multilingo.backend.modules.testing.dto.response.AttemptLanguageContextResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Objects;

@Component
@RequiredArgsConstructor
public class AttemptLanguageResolver {
    private final LearningLanguageCatalog catalog;
    private final LearningLanguageAdapter userLanguages;
    private final TestingLanguageProperties properties;

    public AttemptLanguageContextResponse resolve(Map<String, Object> snapshot, Integer userId) {
        String examLanguage = resolveSnapshotLanguage(snapshot);
        String explanationLanguage = resolveDefaultExplanationLanguage(examLanguage, userId);
        List<String> supported = properties.getSupported().stream()
                .map(catalog::findNormalized)
                .flatMap(java.util.Optional::stream)
                .distinct()
                .toList();

        return new AttemptLanguageContextResponse(
                AttemptLanguageContextResponse.CURRENT_POLICY_VERSION,
                examLanguage,
                explanationLanguage,
                supported);
    }

    private String resolveSnapshotLanguage(Map<String, Object> snapshot) {
        if (snapshot == null) {
            return null;
        }
        Object camel = snapshot.get("examLanguage");
        Object snake = snapshot.get("exam_language");
        if (camel != null && snake != null) {
            if (!(camel instanceof String camelValue) || !(snake instanceof String snakeValue)) {
                return null;
            }
            var normalizedCamel = catalog.findNormalized(camelValue);
            var normalizedSnake = catalog.findNormalized(snakeValue);
            if (normalizedCamel.isEmpty() || !normalizedCamel.equals(normalizedSnake)) {
                return null;
            }
            return normalizedCamel.get();
        }
        Object raw = camel != null ? camel : snake;
        return raw instanceof String tag ? catalog.findNormalized(tag).orElse(null) : null;
    }

    private String resolveDefaultExplanationLanguage(String examLanguage, Integer userId) {
        if (examLanguage == null || userId == null) {
            return null;
        }
        return userLanguages.findNativeLanguage(userId)
                .flatMap(catalog::findNormalized)
                .orElse(examLanguage);
    }
}
