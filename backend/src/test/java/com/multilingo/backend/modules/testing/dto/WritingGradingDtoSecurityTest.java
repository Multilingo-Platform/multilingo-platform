package com.multilingo.backend.modules.testing.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.ai.grading.WritingGrade;
import com.multilingo.backend.modules.testing.dto.response.WritingFeedbackResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class WritingGradingDtoSecurityTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("WritingFeedbackResponse and TaskFeedback do not expose forbidden fields (runId, quotaId, jobId, inputHash, tokens)")
    void feedbackResponseDoesNotContainInternalOrForbiddenFields() {
        Set<String> forbiddenFieldNames = Set.of(
                "runid", "run_id",
                "quotaid", "quota_id",
                "jobid", "job_id",
                "inputhash", "input_hash",
                "apikey", "api_key",
                "token", "contextjson", "context_json"
        );

        for (Field field : WritingFeedbackResponse.class.getDeclaredFields()) {
            assertThat(forbiddenFieldNames)
                    .as("WritingFeedbackResponse field '%s' is forbidden", field.getName())
                    .doesNotContain(field.getName().toLowerCase());
        }

        for (Field field : WritingFeedbackResponse.TaskFeedback.class.getDeclaredFields()) {
            assertThat(forbiddenFieldNames)
                    .as("TaskFeedback field '%s' is forbidden", field.getName())
                    .doesNotContain(field.getName().toLowerCase());
        }
    }

    @Test
    @DisplayName("TaskFeedback has questionId as String and masks sensitive fields in toString()")
    void taskFeedbackHasQuestionIdStringAndMasksSensitiveFieldsInToString() {
        String sentinelEssay = "SENTINEL_ESSAY_TEXT_VERY_SECRET";
        String sentinelFeedback = "SENTINEL_OVERALL_FEEDBACK_SECRET";
        String sentinelPrompt = "SENTINEL_PROMPT_SECRET";
        String sentinelDiff = "SENTINEL_DIFF_TEXT_SECRET";

        WritingFeedbackResponse.TaskFeedback task = new WritingFeedbackResponse.TaskFeedback(
                "q-12345",
                "Writing Task 1",
                "DONE",
                150,
                "en",
                "AI",
                "BAND_0_9",
                BigDecimal.valueOf(7.0),
                BigDecimal.valueOf(9.0),
                List.of(new WritingGrade.CriterionGrade("TR", BigDecimal.valueOf(7.0), sentinelFeedback)),
                sentinelEssay,
                sentinelFeedback,
                sentinelEssay,
                List.of(),
                List.of(new WritingGrade.DiffSegment(WritingGrade.DiffType.EQUAL, sentinelDiff)),
                null,
                "Chấm điểm hoàn tất.", false, null
        );

        // questionId must be String
        assertThat(task.questionId()).isEqualTo("q-12345");

        String str = task.toString();
        assertThat(str).contains("q-12345");
        assertThat(str).contains("DONE");
        assertThat(str).doesNotContain(sentinelEssay);
        assertThat(str).doesNotContain(sentinelFeedback);
        assertThat(str).doesNotContain(sentinelPrompt);
        assertThat(str).doesNotContain(sentinelDiff);
    }

    @Test
    @DisplayName("WritingFeedbackResponse.toString() masks sensitive child task details")
    void writingFeedbackResponseToStringMasksSensitiveData() {
        String sentinelEssay = "SENTINEL_LEARNER_ESSAY_12345";
        WritingFeedbackResponse.TaskFeedback task = new WritingFeedbackResponse.TaskFeedback(
                "q-1",
                "Writing Task 1",
                "DONE",
                120,
                "en",
                "AI",
                "BAND_0_9",
                BigDecimal.valueOf(6.5),
                BigDecimal.valueOf(9.0),
                List.of(),
                sentinelEssay,
                "Feedback text",
                sentinelEssay,
                List.of(),
                List.of(),
                null,
                "Done", false, null
        );

        WritingFeedbackResponse response = new WritingFeedbackResponse(
                10,
                20,
                "COMPLETED",
                "DONE",
                List.of(task)
        );

        String str = response.toString();
        assertThat(str).contains("10");
        assertThat(str).contains("20");
        assertThat(str).doesNotContain(sentinelEssay);
    }

    @Test
    @DisplayName("Serialization of WritingFeedbackResponse does not leak internal keys into JSON")
    void serializationDoesNotLeakInternalKeys() throws Exception {
        WritingFeedbackResponse.TaskFeedback task = new WritingFeedbackResponse.TaskFeedback(
                "task-q-1",
                "Task 1",
                "DONE",
                25,
                "en",
                "AI",
                "BAND_0_9",
                BigDecimal.valueOf(7.5),
                BigDecimal.valueOf(9.0),
                List.of(),
                "My essay text",
                "Good work",
                "My essay text",
                List.of(),
                List.of(),
                null,
                "Done", false, null
        );

        WritingFeedbackResponse response = new WritingFeedbackResponse(
                1,
                101,
                "COMPLETED",
                "DONE",
                List.of(task)
        );

        String json = objectMapper.writeValueAsString(response);
        assertThat(json).doesNotContain("\"runId\"");
        assertThat(json).doesNotContain("\"quotaId\"");
        assertThat(json).doesNotContain("\"jobId\"");
        assertThat(json).doesNotContain("\"inputHash\"");
        assertThat(json).doesNotContain("\"token\"");
        assertThat(json).contains("\"questionId\":\"task-q-1\"");
    }
}
