package com.multilingo.backend.modules.testing.adapter.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.adapter.ExamAdapter;
import com.multilingo.backend.modules.testing.adapter.dto.ExamFixture;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Fixture exam adapter for dev/test profile.
 * Reads exam data from classpath:fixtures/exam-fixture.json.
 *
 * In production, this will be replaced by an adapter backed by TV2's exam module
 * (either direct JPA repository or REST client call, depending on module boundary decision).
 *
 * TODO: Wire production ExamAdapter pointing to TV2 ExamRepository when TV2 is ready.
 */
@Component
@Profile({"dev", "test"})
public class FixtureExamAdapter implements ExamAdapter {

    private final List<ExamFixture> exams;

    public FixtureExamAdapter(ObjectMapper objectMapper) throws Exception {
        ClassPathResource resource = new ClassPathResource("fixtures/exam-fixture.json");
        Map<?, ?> root = objectMapper.readValue(resource.getInputStream(), Map.class);
        List<?> rawList = (List<?>) root.get("exams");
        this.exams = rawList.stream()
                .map(item -> objectMapper.convertValue(item, ExamFixture.class))
                .toList();
    }

    @Override
    public Optional<ExamFixture> findById(Integer examId) {
        if (examId == null) return Optional.empty();
        return exams.stream()
                .filter(e -> examId.equals(e.getId()))
                .findFirst();
    }
}
