package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import com.multilingo.backend.modules.testing.adapter.LearningLanguageAdapter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

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

    public record ResolvedLanguages(String learningLanguage, String hintLanguage) {}
}
