package com.multilingo.backend.modules.testing.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class WritingWordCounterTest {

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "\t\t", "\n\r\n", "   \t \n "})
    @DisplayName("Should return 0 for null, empty or whitespace-only strings")
    void count_blankOrNull_returnsZero(String text) {
        assertThat(WritingWordCounter.count(text)).isZero();
    }

    @Test
    @DisplayName("Should count standard English words accurately")
    void count_standardEnglish_returnsAccurateCount() {
        String essay = "Learning a foreign language opens up numerous cultural and professional opportunities in today's globalized economy.";
        assertThat(WritingWordCounter.count(essay)).isEqualTo(15);
    }

    @Test
    @DisplayName("Should count words with various whitespace delimiters")
    void count_whitespaceVariations_returnsAccurateCount() {
        String text = "Word1 \t Word2 \n\n Word3 \r\n Word4 \f Word5";
        assertThat(WritingWordCounter.count(text)).isEqualTo(5);
    }

    @Test
    @DisplayName("Should handle Unicode and accented text appropriately")
    void count_unicodeAccentedText_returnsAccurateCount() {
        String text = "Đây là bài kiểm tra viết tiếng Việt tự động.";
        assertThat(WritingWordCounter.count(text)).isEqualTo(10);
    }

    @Test
    @DisplayName("Should count 9, 10, and 11 words for boundary checks")
    void count_boundaryWordCounts() {
        String nineWords = "one two three four five six seven eight nine";
        String tenWords = "one two three four five six seven eight nine ten";
        String elevenWords = "one two three four five six seven eight nine ten eleven";

        assertThat(WritingWordCounter.count(nineWords)).isEqualTo(9);
        assertThat(WritingWordCounter.count(tenWords)).isEqualTo(10);
        assertThat(WritingWordCounter.count(elevenWords)).isEqualTo(11);
    }

    @Test
    @DisplayName("Should count punctuation attached to words as single tokens")
    void count_punctuationAndSymbols() {
        String text = "Well-known, high-tech; state-of-the-art solution!";
        assertThat(WritingWordCounter.count(text)).isEqualTo(4);
    }
}
