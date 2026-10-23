package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import com.multilingo.backend.modules.testing.adapter.LearningLanguageAdapter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;

/**
 * Xử lý thứ tự ưu tiên (precedence) và chuẩn hóa ngôn ngữ cho Writing Hints.
 *
 * Precedence:
 * - learningLanguage: request -> User.targetLanguage -> lỗi LANGUAGE_REQUIRED/LANGUAGE_UNSUPPORTED.
 * - hintLanguage: request -> resolved learning language.
 */
@Component
@RequiredArgsConstructor
public class WritingHintLanguageResolver {

    private final LearningLanguageCatalog catalog;
    private final LearningLanguageAdapter learningLanguageAdapter;

    public ResolvedLanguages resolve(Integer userId, String learningLanguage, String hintLanguage) {
        String resolvedLearning;

        if (learningLanguage != null) {
            if (learningLanguage.isBlank()) {
                throw new AppException(ErrorCode.WRITING_HINTS_LANGUAGE_UNSUPPORTED);
            }
            resolvedLearning = catalog.normalize(learningLanguage);
        } else {
            if (userId == null) {
                throw new AppException(ErrorCode.WRITING_HINTS_LANGUAGE_REQUIRED);
            }
            Optional<String> targetLangOpt = learningLanguageAdapter.findTargetLanguage(userId);
            if (targetLangOpt.isEmpty() || targetLangOpt.get().isBlank()) {
                throw new AppException(ErrorCode.WRITING_HINTS_LANGUAGE_REQUIRED);
            }
            resolvedLearning = catalog.normalize(targetLangOpt.get());
        }

        String resolvedHint;
        if (hintLanguage != null) {
            if (hintLanguage.isBlank()) {
                throw new AppException(ErrorCode.WRITING_HINTS_LANGUAGE_UNSUPPORTED);
            }
            resolvedHint = catalog.normalize(hintLanguage);
        } else {
            resolvedHint = resolvedLearning;
        }

        return new ResolvedLanguages(resolvedLearning, resolvedHint);
    }

    /** Resolves a new AI request against the immutable learning language of its attempt. */
    public ResolvedLanguages resolveForAttempt(Integer userId, String learningLanguage,
            String hintLanguage, String examLanguage) {
        if (examLanguage == null || examLanguage.isBlank()) {
            throw new AppException(ErrorCode.WRITING_HINTS_LANGUAGE_REQUIRED);
        }
        String source = catalog.normalize(examLanguage);
        String requestedLearning = learningLanguage == null ? source : catalog.normalize(learningLanguage);
        if (!source.equals(requestedLearning)) {
            throw new AppException(ErrorCode.WRITING_HINTS_LANGUAGE_UNSUPPORTED);
        }

        String explanation;
        if (hintLanguage != null) {
            if (hintLanguage.isBlank()) throw new AppException(ErrorCode.WRITING_HINTS_LANGUAGE_UNSUPPORTED);
            explanation = catalog.normalize(hintLanguage);
        } else {
            explanation = userId == null ? null : learningLanguageAdapter.findNativeLanguage(userId)
                    .filter(value -> !value.isBlank())
                    .flatMap(catalog::findNormalized)
                    .orElse(source);
        }
        return new ResolvedLanguages(source, explanation);
    }

    public String resolveSnapshotExamLanguage(Map<String, Object> snapshot) {
        if (snapshot == null) return null;
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
        Object value = camel != null ? camel : snake;
        return value instanceof String text ? catalog.findNormalized(text).orElse(null) : null;
    }

    public record ResolvedLanguages(String learningLanguage, String hintLanguage) {}
}
