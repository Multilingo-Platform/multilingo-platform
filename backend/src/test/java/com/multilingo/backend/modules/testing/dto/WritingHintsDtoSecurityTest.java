package com.multilingo.backend.modules.testing.dto;

import com.multilingo.backend.modules.testing.dto.request.WritingHintsRequest;
import com.multilingo.backend.modules.testing.dto.response.WritingHintsResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class WritingHintsDtoSecurityTest {

    @Test
    @DisplayName("WritingHintsRequest.toString() không bao giờ in questionId hay sensitive languages (P2-01)")
    void writingHintsRequestToStringMasksQuestionIdAndLanguages() {
        String sentinelQId = "SECRET_QUESTION_ID_SENTINEL_12345\nFORGED_LOG_LINE";
        String sentinelLearnLang = "SECRET_LEARN_LANG_SENTINEL";
        String sentinelHintLang = "SECRET_HINT_LANG_SENTINEL";

        WritingHintsRequest request = new WritingHintsRequest(
                30,
                sentinelQId,
                "c5430ff2-6f41-4eb4-b287-e1e1fdab47aa",
                sentinelLearnLang,
                sentinelHintLang
        );

        String str = request.toString();

        // Không bao giờ chứa raw questionId
        assertThat(str).doesNotContain("SECRET_QUESTION_ID_SENTINEL");
        assertThat(str).doesNotContain("FORGED_LOG_LINE");
        assertThat(str).doesNotContain("\n");

        // Không chứa languages
        assertThat(str).doesNotContain("SECRET_LEARN_LANG_SENTINEL");
        assertThat(str).doesNotContain("SECRET_HINT_LANG_SENTINEL");

        // Chứa các metadata an toàn
        assertThat(str).contains("30");
        assertThat(str).contains("c5430ff2-6f41-4eb4-b287-e1e1fdab47aa");
    }

    @Test
    @DisplayName("WritingHintsResponse.toString() không bao giờ in questionId hay generated payload (P2-01)")
    void writingHintsResponseToStringMasksQuestionIdAndGeneratedContent() {
        String sentinelQId = "SECRET_QUESTION_ID_SENTINEL_67890\nFORGED_LOG_LINE";
        String sentinelOutline = "SECRET_OUTLINE_HEADING_SENTINEL";
        String sentinelPoint = "SECRET_OUTLINE_POINT_SENTINEL";
        String sentinelVocabTerm = "SECRET_VOCAB_TERM_SENTINEL";
        String sentinelVocabDef = "SECRET_VOCAB_DEF_SENTINEL";
        String sentinelVocabExp = "SECRET_VOCAB_EXP_SENTINEL";
        String sentinelVocabEx = "SECRET_VOCAB_EX_SENTINEL";
        String sentinelLimitation = "SECRET_LIMITATION_SENTINEL";
        String sentinelLearnLang = "SECRET_LEARN_LANG_RESPONSE_SENTINEL";
        String sentinelHintLang = "SECRET_HINT_LANG_RESPONSE_SENTINEL";

        WritingHintsResponse response = new WritingHintsResponse(
                100,
                30,
                sentinelQId,
                "d9999ff2-6f41-4eb4-b287-e1e1fdab47bb",
                sentinelLearnLang,
                sentinelHintLang,
                Instant.now(),
                List.of(new WritingHintsResponse.OutlineSection(sentinelOutline, List.of(sentinelPoint))),
                List.of(new WritingHintsResponse.VocabularyItem(sentinelVocabTerm, sentinelVocabDef, sentinelVocabExp, sentinelVocabEx)),
                List.of(sentinelLimitation)
        );

        String str = response.toString();

        // Không bao giờ chứa raw questionId
        assertThat(str).doesNotContain("SECRET_QUESTION_ID_SENTINEL");
        assertThat(str).doesNotContain("FORGED_LOG_LINE");
        assertThat(str).doesNotContain("\n");

        // Không chứa generated outline, vocabulary, limitations
        assertThat(str).doesNotContain("SECRET_OUTLINE_HEADING_SENTINEL");
        assertThat(str).doesNotContain("SECRET_OUTLINE_POINT_SENTINEL");
        assertThat(str).doesNotContain("SECRET_VOCAB_TERM_SENTINEL");
        assertThat(str).doesNotContain("SECRET_VOCAB_DEF_SENTINEL");
        assertThat(str).doesNotContain("SECRET_VOCAB_EXP_SENTINEL");
        assertThat(str).doesNotContain("SECRET_VOCAB_EX_SENTINEL");
        assertThat(str).doesNotContain("SECRET_LIMITATION_SENTINEL");

        // Không chứa languages
        assertThat(str).doesNotContain("SECRET_LEARN_LANG_RESPONSE_SENTINEL");
        assertThat(str).doesNotContain("SECRET_HINT_LANG_RESPONSE_SENTINEL");

        // Chứa các metadata an toàn
        assertThat(str).contains("100");
        assertThat(str).contains("30");
        assertThat(str).contains("d9999ff2-6f41-4eb4-b287-e1e1fdab47bb");
    }
}
