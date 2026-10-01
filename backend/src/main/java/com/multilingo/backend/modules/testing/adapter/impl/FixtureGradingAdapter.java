package com.multilingo.backend.modules.testing.adapter.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.adapter.GradingAdapter;
import com.multilingo.backend.modules.testing.grading.dto.GradingKey;
import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Fixture-based GradingAdapter cho profile dev/test.
 * Đọc grading-fixture.json từ classpath.
 * KHÔNG bao giờ serialize dữ liệu này ra API response.
 */
@Component
@Profile({"dev", "test"})
public class FixtureGradingAdapter implements GradingAdapter {

    private final Map<Integer, Map<Integer, PartGradingKey>> examPartKeysMap;

    @SuppressWarnings("unchecked")
    public FixtureGradingAdapter(ObjectMapper objectMapper) throws Exception {
        this.examPartKeysMap = new HashMap<>();
        ClassPathResource resource = new ClassPathResource("fixtures/grading-fixture.json");
        Map<?, ?> root = objectMapper.readValue(resource.getInputStream(), Map.class);
        List<?> exams = (List<?>) root.get("exams");
        for (Object examObj : exams) {
            Map<?, ?> examMap = (Map<?, ?>) examObj;
            Integer examId = ((Number) examMap.get("exam_id")).intValue();
            List<?> parts = (List<?>) examMap.get("parts");
            Map<Integer, PartGradingKey> partMap = new HashMap<>();
            for (Object partObj : parts) {
                Map<?, ?> partRaw = (Map<?, ?>) partObj;
                Integer partId = ((Number) partRaw.get("part_id")).intValue();
                String sectionName = partRaw.get("section_name") != null
                    ? (String) partRaw.get("section_name") : null;
                Map<?, ?> answersRaw = (Map<?, ?>) partRaw.get("answers");
                Map<String, GradingKey> answers = new HashMap<>();
                for (Map.Entry<?, ?> entry : answersRaw.entrySet()) {
                    String qId = (String) entry.getKey();
                    GradingKey key = objectMapper.convertValue(entry.getValue(), GradingKey.class);
                    key.setQuestionId(qId);
                    answers.put(qId, key);
                }
                PartGradingKey pgk = new PartGradingKey();
                pgk.setPartId(partId);
                pgk.setSectionName(sectionName);
                pgk.setAnswers(answers);
                partMap.put(partId, pgk);
            }
            examPartKeysMap.put(examId, partMap);
        }
    }

    @Override
    public Map<Integer, PartGradingKey> loadPartKeys(Integer examId) {
        return examPartKeysMap.getOrDefault(examId, Collections.emptyMap());
    }
}
