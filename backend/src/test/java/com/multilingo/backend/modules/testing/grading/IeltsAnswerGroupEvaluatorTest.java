package com.multilingo.backend.modules.testing.grading;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.modules.testing.grading.dto.GradingKey;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class IeltsAnswerGroupEvaluatorTest {
    private final IeltsAnswerGroupEvaluator evaluator = new IeltsAnswerGroupEvaluator();

    @Test
    void acceptsBothCorrectChoicesIndependentOfAnswerMapOrder() {
        var keys = keys();
        Map<String, Object> userAnswers = new LinkedHashMap<>();
        userAnswers.put("l_018", "E");
        userAnswers.put("l_017", "A");

        var results = evaluator.evaluate(keys, userAnswers, keys.get("l_018"));

        assertThat(results.keySet()).containsExactly("l_017", "l_018");
        assertThat(results.get("l_017").getVerdict()).isEqualTo(GradingVerdict.CORRECT);
        assertThat(results.get("l_018").getVerdict()).isEqualTo(GradingVerdict.CORRECT);
        assertThat(results.values()).extracting(result -> result.getScore())
                .containsExactly(BigDecimal.ONE, BigDecimal.ONE);
    }

    @Test
    void awardsOnePointForOneCorrectAndDoesNotDoubleCountDuplicateChoice() {
        var keys = keys();
        var partial = evaluator.evaluate(keys, Map.of("l_017", "A", "l_018", "B"), keys.get("l_017"));
        assertThat(partial.get("l_017").getVerdict()).isEqualTo(GradingVerdict.CORRECT);
        assertThat(partial.get("l_018").getVerdict()).isEqualTo(GradingVerdict.WRONG);
        assertThat(partial.values()).extracting(result -> result.getScore())
                .containsExactly(BigDecimal.ONE, BigDecimal.ZERO);

        var duplicate = evaluator.evaluate(keys, Map.of("l_017", "A", "l_018", "A"), keys.get("l_018"));
        assertThat(duplicate.get("l_017").getVerdict()).isEqualTo(GradingVerdict.CORRECT);
        assertThat(duplicate.get("l_018").getVerdict()).isEqualTo(GradingVerdict.WRONG);
        assertThat(duplicate.values()).extracting(result -> result.getScore())
                .containsExactly(BigDecimal.ONE, BigDecimal.ZERO);
    }

    @Test
    void preservesBlankMemberAndRejectsMalformedOrIncompleteGroups() {
        var keys = keys();
        Map<String, Object> blanks = new LinkedHashMap<>();
        blanks.put("l_017", null);
        blanks.put("l_018", "   ");
        var results = evaluator.evaluate(keys, blanks, keys.get("l_017"));
        assertThat(results.values()).extracting(result -> result.getVerdict())
                .containsExactly(GradingVerdict.BLANK, GradingVerdict.BLANK);

        assertThatThrownBy(() -> evaluator.evaluate(Map.of("l_017", keys.get("l_017")),
                Map.of("l_017", "A"), keys.get("l_017"))).isInstanceOf(AppException.class);
    }

    private static Map<String, GradingKey> keys() {
        var pair = new GradingKey.AnswerGroup("listening-17-18", "DISTINCT_UNORDERED", List.of("l_017", "l_018"));
        return Map.of("l_017", key("l_017", pair), "l_018", key("l_018", pair));
    }

    private static GradingKey key(String id, GradingKey.AnswerGroup pair) {
        var key = new GradingKey();
        key.setQuestionId(id);
        key.setType("SINGLE_CHOICE");
        key.setCorrect(List.of("A", "E"));
        key.setAnswerGroup(pair);
        return key;
    }
}
