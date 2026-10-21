package com.multilingo.backend.modules.testing.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WritingLengthCounterTest {
    private final WritingLengthCounter counter = new WritingLengthCounter();

    @Test
    void countsCjkLettersAndNumbersWithoutSpacesOrPunctuation() {
        assertThat(counter.count("日本語、猫 42!", "ja-JP"))
                .isEqualTo(new WritingLengthCounter.WritingLengthMetric(6, WritingLengthCounter.Unit.CHARACTERS, "TV3_LENGTH_V1"));
        assertThat(counter.count("漢①Ⅷ", "ja"))
                .isEqualTo(new WritingLengthCounter.WritingLengthMetric(3, WritingLengthCounter.Unit.CHARACTERS, "TV3_LENGTH_V1"));
        assertThat(counter.count("한국어 123", "ko"))
                .isEqualTo(new WritingLengthCounter.WritingLengthMetric(2, WritingLengthCounter.Unit.WORDS, "TV3_LENGTH_V1"));
        assertThat(counter.count("中文测试", "zh-Hans-CN").unit()).isEqualTo(WritingLengthCounter.Unit.CHARACTERS);
    }

    @Test
    void countsWhitespaceTokensForNonCjkAndPreservesAccentedLettersAsWords() {
        assertThat(counter.count("  Über\u00a0die Straße\nlernen  ", "de-DE").value()).isEqualTo(4);
        assertThat(counter.count("", "fr").value()).isZero();
        assertThat(counter.count("abc", "en").policyVersion()).isEqualTo("TV3_LENGTH_V1");
    }
}
