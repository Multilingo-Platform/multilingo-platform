package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import com.multilingo.backend.modules.testing.adapter.LearningLanguageAdapter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WritingHintLanguageResolverTest {

    @Mock
    private LearningLanguageAdapter learningLanguageAdapter;

    private LearningLanguageCatalog catalog;
    private WritingHintLanguageResolver resolver;

    @BeforeEach
    void setUp() {
        catalog = new LearningLanguageCatalog();
        resolver = new WritingHintLanguageResolver(catalog, learningLanguageAdapter);
    }

    @Test
    @DisplayName("Cả hai ngôn ngữ đều truyền trong request: chuẩn hóa ISO 639-3 và không truy vấn DB")
    void resolvesBothLanguagesFromRequest() {
        var resolved = resolver.resolve(100, "eng", "fra");

        assertThat(resolved).isEqualTo(new WritingHintLanguageResolver.ResolvedLanguages("en", "fr"));
        verifyNoInteractions(learningLanguageAdapter);
    }

    @Test
    @DisplayName("hintLanguage null: mặc định nhận theo resolved learningLanguage")
    void defaultsHintLanguageToResolvedLearningLanguage() {
        var resolved = resolver.resolve(100, "vi", null);

        assertThat(resolved.learningLanguage()).isEqualTo("vi");
        assertThat(resolved.hintLanguage()).isEqualTo("vi");
        verifyNoInteractions(learningLanguageAdapter);
    }

    @Test
    @DisplayName("learningLanguage null: fallback sang User.targetLanguage của user")
    void fallsBackToUserTargetLanguageWhenLearningLanguageAbsent() {
        when(learningLanguageAdapter.findTargetLanguage(100)).thenReturn(Optional.of("en"));

        var resolved = resolver.resolve(100, null, "fr");

        assertThat(resolved.learningLanguage()).isEqualTo("en");
        assertThat(resolved.hintLanguage()).isEqualTo("fr");
        verify(learningLanguageAdapter).findTargetLanguage(100);
    }

    @Test
    @DisplayName("Cả hai ngôn ngữ đều null: learning lấy từ User.targetLanguage, hint lấy theo learning")
    void fallsBackBothWhenBothAbsent() {
        when(learningLanguageAdapter.findTargetLanguage(100)).thenReturn(Optional.of("vie"));

        var resolved = resolver.resolve(100, null, null);

        assertThat(resolved.learningLanguage()).isEqualTo("vi");
        assertThat(resolved.hintLanguage()).isEqualTo("vi");
    }

    @Test
    @DisplayName("learningLanguage null và User.targetLanguage cũng null: ném WRITING_HINTS_LANGUAGE_REQUIRED")
    void throwsLanguageRequiredWhenTargetLanguageMissing() {
        when(learningLanguageAdapter.findTargetLanguage(100)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> resolver.resolve(100, null, null))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_LANGUAGE_REQUIRED);
    }

    @Test
    @DisplayName("learningLanguage null và userId null: ném WRITING_HINTS_LANGUAGE_REQUIRED")
    void throwsLanguageRequiredWhenUserIdNullAndLearningLanguageNull() {
        assertThatThrownBy(() -> resolver.resolve(null, null, null))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_LANGUAGE_REQUIRED);
    }

    @Test
    @DisplayName("learningLanguage null nhưng User.targetLanguage không hợp lệ: ném WRITING_HINTS_LANGUAGE_UNSUPPORTED")
    void throwsLanguageUnsupportedWhenStoredPreferenceInvalid() {
        when(learningLanguageAdapter.findTargetLanguage(100)).thenReturn(Optional.of("unsupported_lang"));

        assertThatThrownBy(() -> resolver.resolve(100, null, null))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_LANGUAGE_UNSUPPORTED);
    }

    @Test
    @DisplayName("learningLanguage truyền blank trong request: ném WRITING_HINTS_LANGUAGE_UNSUPPORTED, KHÔNG fallback DB")
    void throwsLanguageUnsupportedWhenRequestLearningLanguageBlank() {
        assertThatThrownBy(() -> resolver.resolve(100, "   ", null))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_LANGUAGE_UNSUPPORTED);

        verifyNoInteractions(learningLanguageAdapter);
    }

    @Test
    @DisplayName("hintLanguage truyền blank trong request: ném WRITING_HINTS_LANGUAGE_UNSUPPORTED")
    void throwsLanguageUnsupportedWhenRequestHintLanguageBlank() {
        assertThatThrownBy(() -> resolver.resolve(100, "en", "   "))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_LANGUAGE_UNSUPPORTED);
    }

    @Test
    @DisplayName("hintLanguage truyền không hợp lệ trong request: ném WRITING_HINTS_LANGUAGE_UNSUPPORTED")
    void throwsLanguageUnsupportedWhenRequestHintLanguageInvalid() {
        assertThatThrownBy(() -> resolver.resolve(100, "en", "xyz-invalid"))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_LANGUAGE_UNSUPPORTED);
    }
}
