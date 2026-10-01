package com.multilingo.backend.modules.testing.adapter;

import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class FixtureGradingAdapterTest {

    @Autowired
    GradingAdapter gradingAdapter;

    @Test
    void loadPartKeys_for_exam1_returns_5_parts() {
        Map<Integer, PartGradingKey> keys = gradingAdapter.loadPartKeys(1);
        // exam 1 có 5 parts khách quan (1,2,3,4,5) — Writing parts bị bỏ qua
        assertThat(keys).hasSize(5);
    }

    @Test
    void loadPartKeys_part1_has_correct_answer_for_q1() {
        Map<Integer, PartGradingKey> keys = gradingAdapter.loadPartKeys(1);
        PartGradingKey part1 = keys.get(1);
        assertThat(part1).isNotNull();
        assertThat(part1.getAnswers()).containsKey("q_1");
        assertThat(part1.getAnswers().get("q_1").getCorrect()).isEqualTo("A");
    }

    @Test
    void loadPartKeys_fill_in_has_alternates() {
        Map<Integer, PartGradingKey> keys = gradingAdapter.loadPartKeys(1);
        PartGradingKey part3 = keys.get(3);
        assertThat(part3.getAnswers().get("q_5").getAlternates())
                .containsExactlyInAnyOrder("neural plasticity", "neuroplasticity");
    }

    @Test
    void loadPartKeys_for_unknown_exam_returns_empty_map() {
        Map<Integer, PartGradingKey> keys = gradingAdapter.loadPartKeys(9999);
        assertThat(keys).isEmpty();
    }
}
