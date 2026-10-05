package com.multilingo.backend.modules.testing.adapter;

import com.multilingo.backend.modules.testing.grading.dto.GradingKey;
import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
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
        // Pinned values from grading-fixture.json
        assertThat(part3.getAnswers().get("q_5").getAlternates())
                .containsExactlyInAnyOrder("neural plasticity", "neuroplasticity");
    }

    @Test
    void loadPartKeys_for_unknown_exam_returns_empty_map() {
        Map<Integer, PartGradingKey> keys = gradingAdapter.loadPartKeys(9999);
        assertThat(keys).isEmpty();
    }

    // ─── section_name parsing ───────────────────────────────────────────────────

    @Test
    void loadPartKeys_parses_sectionName() {
        Map<Integer, PartGradingKey> keys = gradingAdapter.loadPartKeys(1);
        assertThat(keys.get(1).getSectionName()).isEqualTo("Reading");
        assertThat(keys.get(4).getSectionName()).isEqualTo("Listening");
    }

    // ─── MULTIPLE_CHOICE + MATCHING round-trip via fixture ──────────────────────

    @Test
    void loadPartKeys_part4_has_multiple_choice_question() {
        Map<Integer, PartGradingKey> keys = gradingAdapter.loadPartKeys(1);
        GradingKey q8 = keys.get(4).getAnswers().get("q_8");
        assertThat(q8).isNotNull();
        assertThat(q8.getType()).isEqualTo("MULTIPLE_CHOICE");
        assertThat(q8.getCorrect()).isInstanceOf(List.class);
        @SuppressWarnings("unchecked")
        List<String> correctList = (List<String>) q8.getCorrect();
        assertThat(correctList).containsExactlyInAnyOrder("A", "C");
    }

    @Test
    void loadPartKeys_part5_has_matching_question() {
        Map<Integer, PartGradingKey> keys = gradingAdapter.loadPartKeys(1);
        GradingKey q9 = keys.get(5).getAnswers().get("q_9");
        assertThat(q9).isNotNull();
        assertThat(q9.getType()).isEqualTo("MATCHING");
        assertThat(q9.getCorrect()).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, String> correctMap = (Map<String, String>) q9.getCorrect();
        assertThat(correctMap).containsEntry("s1", "B");
        assertThat(correctMap).containsEntry("s2", "A");
        assertThat(correctMap).containsEntry("s3", "C");
    }
}
