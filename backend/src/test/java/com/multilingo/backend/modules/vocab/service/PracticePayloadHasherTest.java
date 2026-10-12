package com.multilingo.backend.modules.vocab.service;

import com.multilingo.backend.modules.vocab.dto.request.SubmitPracticeAnswerDto;
import com.multilingo.backend.modules.vocab.service.quiz.PracticePayloadHasher;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("PracticePayloadHasher Unit Tests - Canonical SHA-256")
class PracticePayloadHasherTest {

    private final PracticePayloadHasher hasher = new PracticePayloadHasher();

    @Test
    @DisplayName("TC_HASH_01: Thứ tự danh sách câu trả lời bị đảo ngược vẫn tạo ra canonical hash giống nhau")
    void testArrayOrderStable() {
        String sessionId = "sess-12345";
        int duration = 65;

        SubmitPracticeAnswerDto a1 = SubmitPracticeAnswerDto.builder().questionId(1).selectedOptionId("B").build();
        SubmitPracticeAnswerDto a2 = SubmitPracticeAnswerDto.builder().questionId(2).selectedOptionId("A").build();

        List<SubmitPracticeAnswerDto> answersAB = List.of(a1, a2);
        List<SubmitPracticeAnswerDto> answersBA = List.of(a2, a1);

        String hash1 = hasher.computeCanonicalHash(sessionId, duration, answersAB);
        String hash2 = hasher.computeCanonicalHash(sessionId, duration, answersBA);

        assertThat(hash1).isNotEmpty();
        assertThat(hash1).hasSize(64);
        assertThat(hash1).isEqualTo(hash2);
    }

    @Test
    @DisplayName("TC_HASH_02: Thay đổi durationSeconds tạo ra mã hash khác nhau")
    void testDifferentDurationGeneratesDifferentHash() {
        String sessionId = "sess-12345";

        SubmitPracticeAnswerDto a1 = SubmitPracticeAnswerDto.builder().questionId(1).selectedOptionId("B").build();
        SubmitPracticeAnswerDto a2 = SubmitPracticeAnswerDto.builder().questionId(2).selectedOptionId("A").build();

        List<SubmitPracticeAnswerDto> answers = List.of(a1, a2);

        String hash1 = hasher.computeCanonicalHash(sessionId, 65, answers);
        String hash2 = hasher.computeCanonicalHash(sessionId, 66, answers);

        assertThat(hash1).isNotEqualTo(hash2);
    }

    @Test
    @DisplayName("TC_HASH_03: Thay đổi đáp án chọn tạo ra mã hash khác nhau")
    void testDifferentSelectedOptionGeneratesDifferentHash() {
        String sessionId = "sess-12345";
        int duration = 65;

        SubmitPracticeAnswerDto a1 = SubmitPracticeAnswerDto.builder().questionId(1).selectedOptionId("B").build();
        SubmitPracticeAnswerDto a2OptionA = SubmitPracticeAnswerDto.builder().questionId(2).selectedOptionId("A").build();
        SubmitPracticeAnswerDto a2OptionC = SubmitPracticeAnswerDto.builder().questionId(2).selectedOptionId("C").build();

        String hash1 = hasher.computeCanonicalHash(sessionId, duration, List.of(a1, a2OptionA));
        String hash2 = hasher.computeCanonicalHash(sessionId, duration, List.of(a1, a2OptionC));

        assertThat(hash1).isNotEqualTo(hash2);
    }
}
