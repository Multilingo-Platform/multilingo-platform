package com.multilingo.backend.modules.testing.adapter;

import com.multilingo.backend.modules.testing.adapter.dto.ExamFixture;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class FixtureExamAdapterTest {

    @Autowired
    ExamAdapter examAdapter;

    @Autowired
    IdentityAdapter identityAdapter;

    @Test
    void findById_returns_exam_from_fixture_file() {
        Optional<ExamFixture> result = examAdapter.findById(1);
        assertThat(result).isPresent();
        assertThat(result.get().getId()).isEqualTo(1);
        assertThat(result.get().getDurationMinutes()).isEqualTo(180);
        assertThat(result.get().getSections()).hasSize(3);
    }

    @Test
    void findById_returns_empty_for_unknown_exam() {
        Optional<ExamFixture> result = examAdapter.findById(9999);
        assertThat(result).isEmpty();
    }

    @Test
    void findById_handles_null_duration_gracefully() {
        // exam id=2 has durationMinutes=null in fixture — must not NPE
        Optional<ExamFixture> result = examAdapter.findById(2);
        assertThat(result).isPresent();
        assertThat(result.get().getDurationMinutes()).isNull();
    }

    @Test
    void identityAdapter_returns_fixture_userId_1() {
        Integer userId = identityAdapter.getCurrentUserId();
        assertThat(userId).isEqualTo(1);
    }

    @Test
    void findById_returns_parts_with_contentHtml() {
        ExamFixture exam = examAdapter.findById(1).orElseThrow();
        com.multilingo.backend.modules.testing.adapter.dto.PartFixture part1 = exam.getSections().get(0).getParts().get(0);
        assertThat(part1.getContentHtml()).isNotNull();
        assertThat(part1.getContentHtml()).contains("reading-passage");
    }
}
