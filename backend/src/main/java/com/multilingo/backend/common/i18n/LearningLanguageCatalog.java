package com.multilingo.backend.common.i18n;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;

import java.util.*;

/**
 * Quản lý danh mục ngôn ngữ học tập hợp lệ chuẩn BCP 47.
 * Hỗ trợ các mã cơ sở cấu hình được, alias ISO 639-3 suy ra từ catalog, và bảo toàn region/script.
 */
public class LearningLanguageCatalog {

    public static final List<String> DEFAULT_LANGUAGES = List.of(
            "en", "vi", "ko", "zh", "ja", "fr", "de", "es"
    );

    private final Set<String> supportedBaseLanguages;
    private final Map<String, String> iso3Aliases;

    public LearningLanguageCatalog() {
        this(DEFAULT_LANGUAGES);
    }

    public LearningLanguageCatalog(Collection<String> supportedLanguages) {
        if (supportedLanguages == null || supportedLanguages.isEmpty()) {
            supportedLanguages = DEFAULT_LANGUAGES;
        }

        Set<String> baseSet = new LinkedHashSet<>();
        Map<String, String> aliases = new HashMap<>();

        for (String code : supportedLanguages) {
            if (code == null || code.isBlank()) {
                continue;
            }
            String normalizedCode = code.trim().toLowerCase(Locale.ROOT);
            baseSet.add(normalizedCode);

            // Suy ra alias ISO 639-3 từ mã ngôn ngữ cơ sở
            try {
                Locale loc = Locale.forLanguageTag(normalizedCode);
                String iso3 = loc.getISO3Language();
                if (iso3 != null && !iso3.isBlank() && !iso3.equalsIgnoreCase(normalizedCode)) {
                    aliases.put(iso3.toLowerCase(Locale.ROOT), normalizedCode);
                }
            } catch (MissingResourceException ignored) {
                // Bỏ qua nếu JVM không có ISO3 cho tag đặc thù
            }
        }

        this.supportedBaseLanguages = Collections.unmodifiableSet(baseSet);
        this.iso3Aliases = Collections.unmodifiableMap(aliases);
    }

    /**
     * Chuẩn hóa và xác thực thẻ ngôn ngữ BCP 47.
     *
     * @param rawTag thẻ ngôn ngữ thô
     * @return thẻ BCP 47 chuẩn hóa
     * @throws AppException(ErrorCode.WRITING_HINTS_LANGUAGE_UNSUPPORTED) nếu không hợp lệ hoặc không được hỗ trợ
     */
    public String normalize(String rawTag) {
        return findNormalized(rawTag).orElseThrow(() ->
                new AppException(ErrorCode.WRITING_HINTS_LANGUAGE_UNSUPPORTED));
    }

    /**
     * Kiểm tra và tìm thẻ BCP 47 chuẩn hóa nếu được hỗ trợ.
     *
     * @param rawTag thẻ ngôn ngữ thô
     * @return Optional chứa thẻ chuẩn hóa, hoặc Optional.empty()
     */
    public Optional<String> findNormalized(String rawTag) {
        if (rawTag == null || rawTag.isBlank()) {
            return Optional.empty();
        }

        String tag = rawTag.trim();

        // Từ chối ký tự gạch dưới '_', wildcard '*', private-use 'x-' hoặc format dị dạng
        if (tag.contains("_") || tag.contains("*") || tag.contains("--") || tag.startsWith("-") || tag.endsWith("-")) {
            return Optional.empty();
        }

        String lowerTag = tag.toLowerCase(Locale.ROOT);
        if (lowerTag.equals("und") || lowerTag.startsWith("und-") || lowerTag.startsWith("x-") || lowerTag.contains("-x-")) {
            return Optional.empty();
        }

        Locale parsedLocale;
        try {
            parsedLocale = new Locale.Builder().setLanguageTag(tag).build();
        } catch (IllformedLocaleException | IllegalArgumentException e) {
            return Optional.empty();
        }

        // Từ chối nếu ngôn ngữ rỗng, undetermined, có private-use/extensions, hoặc có variant
        if (parsedLocale.getLanguage().isBlank() || parsedLocale.getLanguage().equalsIgnoreCase("und")) {
            return Optional.empty();
        }
        if (!parsedLocale.getExtensionKeys().isEmpty() || !parsedLocale.getVariant().isBlank()) {
            return Optional.empty();
        }

        String lang = parsedLocale.getLanguage().toLowerCase(Locale.ROOT);

        // Ánh xạ alias ISO 639-3 nếu có (ví dụ eng -> en, vie -> vi, fra -> fr)
        if (iso3Aliases.containsKey(lang)) {
            lang = iso3Aliases.get(lang);
        }

        // Kiểm tra xem mã cơ sở có thuộc danh mục được hỗ trợ không
        if (!supportedBaseLanguages.contains(lang)) {
            return Optional.empty();
        }

        // Tái tạo thẻ canonical BCP 47 với language đã resolved, giữ nguyên region và script
        Locale.Builder canonicalBuilder = new Locale.Builder().setLanguage(lang);
        if (!parsedLocale.getScript().isBlank()) {
            canonicalBuilder.setScript(parsedLocale.getScript());
        }
        if (!parsedLocale.getCountry().isBlank()) {
            canonicalBuilder.setRegion(parsedLocale.getCountry());
        }

        return Optional.of(canonicalBuilder.build().toLanguageTag());
    }

    /**
     * Kiểm tra xem thẻ ngôn ngữ có được hỗ trợ hay không.
     *
     * @param rawTag thẻ ngôn ngữ thô
     * @return true nếu hợp lệ và được hỗ trợ
     */
    public boolean isSupported(String rawTag) {
        return findNormalized(rawTag).isPresent();
    }
}
