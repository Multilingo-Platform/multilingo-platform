package com.multilingo.backend.common.i18n;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LearningLanguageCatalogTest {

    private LearningLanguageCatalog defaultCatalog;
    private LearningLanguageCatalog extendedCatalog;

    @BeforeEach
    void setUp() {
        defaultCatalog = new LearningLanguageCatalog();
        extendedCatalog = new LearningLanguageCatalog(List.of("en", "vi", "ko", "zh", "ja", "fr", "de", "es", "it"));
    }

    @Test
    @DisplayName("Tám mã mặc định được hỗ trợ và chuẩn hóa chính xác")
    void defaultEightLanguagesSupported() {
        for (String code : List.of("en", "vi", "ko", "zh", "ja", "fr", "de", "es")) {
            assertThat(defaultCatalog.isSupported(code)).isTrue();
            assertThat(defaultCatalog.normalize(code)).isEqualTo(code);
        }
    }

    @Test
    @DisplayName("Hỗ trợ alias ISO 639-3 suy ra từ catalog (eng->en, vie->vi, fra->fr, deu->de, spa->es...)")
    void iso6393AliasesNormalizedToBaseCodes() {
        assertThat(defaultCatalog.normalize("eng")).isEqualTo("en");
        assertThat(defaultCatalog.normalize("vie")).isEqualTo("vi");
        assertThat(defaultCatalog.normalize("fra")).isEqualTo("fr");
        assertThat(defaultCatalog.normalize("deu")).isEqualTo("de");
        assertThat(defaultCatalog.normalize("spa")).isEqualTo("es");
        assertThat(defaultCatalog.normalize("kor")).isEqualTo("ko");
        assertThat(defaultCatalog.normalize("zho")).isEqualTo("zh");
        assertThat(defaultCatalog.normalize("jpn")).isEqualTo("ja");
    }

    @Test
    @DisplayName("Giữ nguyên region và script hợp lệ chuẩn BCP 47")
    void preservesRegionAndScriptTags() {
        assertThat(defaultCatalog.normalize("fr-CA")).isEqualTo("fr-CA");
        assertThat(defaultCatalog.normalize("zh-Hant")).isEqualTo("zh-Hant");
        assertThat(defaultCatalog.normalize("en-US")).isEqualTo("en-US");
        assertThat(defaultCatalog.normalize("en-GB")).isEqualTo("en-GB");
    }

    @Test
    @DisplayName("Chuẩn hóa đúng chữ hoa/chữ thường theo BCP 47 canonical casing")
    void normalizesCaseToCanonicalBcp47() {
        assertThat(defaultCatalog.normalize("FR-ca")).isEqualTo("fr-CA");
        assertThat(defaultCatalog.normalize("zh-hant")).isEqualTo("zh-Hant");
        assertThat(defaultCatalog.normalize("EN-us")).isEqualTo("en-US");
        assertThat(defaultCatalog.normalize("ENG")).isEqualTo("en");
    }

    @Test
    @DisplayName("Alias ISO 639-3 kết hợp region được chuẩn hóa đúng (fra-CA -> fr-CA)")
    void iso3WithRegionNormalizedProperly() {
        assertThat(defaultCatalog.normalize("fra-CA")).isEqualTo("fr-CA");
        assertThat(defaultCatalog.normalize("eng-US")).isEqualTo("en-US");
    }

    @Test
    @DisplayName("Cấu hình mở rộng thêm ngôn ngữ 'it' hoạt động chính xác")
    void extendedCatalogSupportsAddedLanguage() {
        assertThat(defaultCatalog.isSupported("it")).isFalse();
        assertThatThrownBy(() -> defaultCatalog.normalize("it"))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_LANGUAGE_UNSUPPORTED);

        assertThat(extendedCatalog.isSupported("it")).isTrue();
        assertThat(extendedCatalog.normalize("it")).isEqualTo("it");
        assertThat(extendedCatalog.normalize("ita")).isEqualTo("it");
        assertThat(extendedCatalog.normalize("it-IT")).isEqualTo("it-IT");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "en_US", "vi_VN", "fr_CA", // chứa dấu gạch dưới '_'
            "*", "en-*", "*/*", // wildcard
            "und", "und-US", "UND", // undetermined language
            "x-private", "en-x-priv", "-x-", // private-use subtags
            "en-u-ca-gregory", "en-u-co-phonebk", // Unicode extensions
            "en-t-m0-iso", // transformed content extension
            "123", "e", "toolongsubtagxyz", // malformed / invalid BCP 47
            "ru", "ar", "hi", "pt" // ngôn ngữ không có trong default catalog
    })
    @DisplayName("Từ chối các thẻ ngôn ngữ không hợp lệ, malformed, private-use hoặc unsupported")
    void rejectsInvalidAndUnsupportedTags(String tag) {
        assertThat(defaultCatalog.isSupported(tag)).isFalse();
        assertThat(defaultCatalog.findNormalized(tag)).isEmpty();
        assertThatThrownBy(() -> defaultCatalog.normalize(tag))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_LANGUAGE_UNSUPPORTED);
    }

    @Test
    @DisplayName("Từ chối null hoặc blank string với WRITING_HINTS_LANGUAGE_UNSUPPORTED")
    void rejectsNullOrBlank() {
        assertThat(defaultCatalog.isSupported(null)).isFalse();
        assertThat(defaultCatalog.isSupported("")).isFalse();
        assertThat(defaultCatalog.isSupported("   ")).isFalse();

        assertThatThrownBy(() -> defaultCatalog.normalize(null))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_LANGUAGE_UNSUPPORTED);

        assertThatThrownBy(() -> defaultCatalog.normalize("  "))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_LANGUAGE_UNSUPPORTED);
    }
}
