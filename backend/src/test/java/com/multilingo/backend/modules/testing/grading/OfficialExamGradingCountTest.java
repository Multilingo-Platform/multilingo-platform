package com.multilingo.backend.modules.testing.grading;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import com.multilingo.backend.modules.exam.dto.request.PartBuilderRequest;
import com.multilingo.backend.modules.exam.service.ExamParserService;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.grading.dto.GradingResult;
import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;
import com.multilingo.backend.modules.testing.grading.impl.ObjectiveGradingServiceImpl;
import com.multilingo.backend.modules.testing.util.SnapshotGradingKeyExtractor;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class OfficialExamGradingCountTest {
    private static final String IELTS_RESOURCE = "/datasets/official-source/cambridge-ielts-20-test-1.xlsx";
    private static final String TOEIC_RESOURCE = "/datasets/official-source/ets-2024-test-1-completed.xlsx";

    @Test
    void allCambridgeObjectiveQuestionsGradeToRaw80IncludingFiveTwoSlotGroups() throws Exception {
        GradingResult result = grade(parse(IELTS_RESOURCE, "Cambridge.xlsx"));

        assertThat(result.getTotalObjectiveCount()).isEqualTo(80);
        assertThat(result.getCorrectCount()).isEqualTo(80);
        assertThat(result.getTotalScore()).isEqualByComparingTo("80");
    }

    @Test
    void allEtsObjectiveQuestionsKeepExistingRaw200Scoring() throws Exception {
        GradingResult result = grade(parse(TOEIC_RESOURCE, "ETS_completed.xlsx"));

        assertThat(result.getTotalObjectiveCount()).isEqualTo(200);
        assertThat(result.getCorrectCount()).isEqualTo(200);
        assertThat(result.getTotalScore()).isEqualByComparingTo("200");
    }

    private static ExamBuilderRequest parse(String resource, String filename) throws Exception {
        try (InputStream input = OfficialExamGradingCountTest.class.getResourceAsStream(resource)) {
            byte[] bytes = input.readAllBytes();
            return new ExamParserService(new ObjectMapper()).parseExamFile(new MockMultipartFile("file", filename,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes));
        }
    }

    private static GradingResult grade(ExamBuilderRequest request) {
        List<Map<String, Object>> sections = new ArrayList<>();
        int nextPartId = 1;
        for (var section : request.getSections()) {
            List<Map<String, Object>> parts = new ArrayList<>();
            for (PartBuilderRequest part : section.getParts()) {
                Map<String, Object> data = new LinkedHashMap<>(part.getContentData());
                data.put("id", nextPartId++);
                parts.add(data);
            }
            sections.add(Map.of("name", section.getSkillType(), "parts", parts));
        }
        Map<String, Object> snapshot = Map.of("sections", sections);
        Map<Integer, PartGradingKey> keys = SnapshotGradingKeyExtractor.extractFromSnapshot(snapshot);
        List<AttemptAnswer> answers = new ArrayList<>();
        for (Map.Entry<Integer, PartGradingKey> entry : keys.entrySet()) {
            Map<String, Object> userAnswers = new LinkedHashMap<>();
            for (var keyEntry : entry.getValue().getAnswers().entrySet()) {
                var key = keyEntry.getValue();
                Object correct = key.getCorrect();
                Object answer;
                if (key.getAnswerGroup() != null) {
                    int memberIndex = key.getAnswerGroup().questionIds().indexOf(key.getQuestionId());
                    answer = ((List<?>) correct).get(memberIndex);
                } else if (correct instanceof List<?> list) {
                    answer = list.getFirst();
                } else {
                    answer = correct;
                }
                userAnswers.put(keyEntry.getKey(), answer);
            }
            answers.add(AttemptAnswer.builder().partId(entry.getKey()).userAnswers(userAnswers).build());
        }
        return new ObjectiveGradingServiceImpl().gradeAttempt(answers, keys);
    }
}
