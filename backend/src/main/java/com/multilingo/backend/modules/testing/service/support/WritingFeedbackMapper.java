package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.multilingo.backend.modules.testing.ai.grading.WritingGradingOutputParser;
import com.multilingo.backend.modules.testing.ai.grading.WritingGrade;
import com.multilingo.backend.modules.testing.ai.grading.WritingGradingResultCodec;
import com.multilingo.backend.modules.testing.ai.grading.WritingRubricPolicy;
import com.multilingo.backend.modules.testing.dto.response.WritingFeedbackResponse;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.WritingGradingJob;
import com.multilingo.backend.modules.testing.util.AttemptResultScope;
import com.multilingo.backend.modules.testing.util.WritingWordCounter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class WritingFeedbackMapper {

    private final ObjectMapper objectMapper;
    private final WritingGradingOutputParser gradeValidator = new WritingGradingOutputParser();
    private final WritingGradingResultCodec resultCodec = new WritingGradingResultCodec();
    private final WritingGradingContextReader visualContextReader = new WritingGradingContextReader(true);
    private static final Set<String> IMAGE_UNAVAILABLE_REASONS = Set.of(
            "IMAGE_TOO_LARGE", "IMAGE_INVALID", "IMAGE_UNAVAILABLE", "IMAGE_SOURCE_NOT_ALLOWED");

    public WritingFeedbackResponse mapFeedback(
            TestAttempt attempt,
            Integer partId,
            AttemptResultScope.ScopedPart scopedPart,
            AttemptAnswer attemptAnswer,
            List<WritingGradingJob> jobs
    ) {
        Objects.requireNonNull(attempt, "attempt must not be null");
        Objects.requireNonNull(partId, "partId must not be null");
        Objects.requireNonNull(scopedPart, "scopedPart must not be null");

        Map<String, WritingGradingJob> jobsByQuestionId = new HashMap<>();
        if (jobs != null) {
            for (WritingGradingJob job : jobs) {
                if (job.getQuestionId() != null) {
                    jobsByQuestionId.put(job.getQuestionId(), job);
                }
            }
        }

        String language = extractExamLanguage(attempt.getExamSnapshot());

        List<WritingFeedbackResponse.TaskFeedback> taskFeedbacks = new ArrayList<>();

        for (AttemptResultScope.ScopedQuestion sq : scopedPart.getQuestions()) {
            if (!"ESSAY".equalsIgnoreCase(sq.getType())) {
                continue;
            }

            String questionId = sq.getQuestionId();
            String label = (sq.getLabel() != null && !sq.getLabel().isBlank())
                    ? sq.getLabel()
                    : scopedPart.getLabel();

            WritingGradingJob job = jobsByQuestionId.get(questionId);
            boolean hasVisualContext = visualContextReader.hasVisualContext(attempt.getExamSnapshot(), partId, questionId)
                    || (job != null && job.getContextJson() != null
                    && job.getContextJson().get("images") instanceof List<?> images && !images.isEmpty());
            String originalText = extractOriginalText(attemptAnswer, questionId);
            com.multilingo.backend.modules.testing.util.WritingLengthCounter.WritingLengthMetric lengthMetric = new com.multilingo.backend.modules.testing.util.WritingLengthCounter().count(originalText, language);
            int wordCount = com.multilingo.backend.modules.testing.util.WritingWordCounter.count(originalText);
            if (originalText.codePointCount(0, originalText.length()) > WritingGradingContextReader.MAX_ESSAY_CODE_POINTS) {
                taskFeedbacks.add(createUnavailableTask(questionId, label, wordCount, language, null, hasVisualContext,
                        "ESSAY_TOO_LONG", "Bài viết vượt giới hạn độ dài cho phép."));
                continue;
            }

            WritingFeedbackResponse.TaskFeedback taskFeedback = mapSingleTask(
                    attempt,
                    partId,
                    questionId,
                    label,
                    language,
                    originalText,
                    wordCount,
                    hasVisualContext,
                    attemptAnswer,
                    jobsByQuestionId.get(questionId)
            );
            taskFeedbacks.add(taskFeedback);
        }

        String partStatus = resolvePartStatus(taskFeedbacks);

        return new WritingFeedbackResponse(
                attempt.getId(),
                partId,
                attempt.getStatus() != null ? attempt.getStatus().name() : "UNKNOWN",
                partStatus,
                taskFeedbacks
        );
    }

    private WritingFeedbackResponse.TaskFeedback mapSingleTask(
            TestAttempt attempt,
            Integer partId,
            String questionId,
            String label,
            String language,
            String originalText,
            int wordCount,
            boolean hasVisualContext,
            AttemptAnswer attemptAnswer,
            WritingGradingJob job
    ) {
        // 1. Kiểm tra persisted feedback trong AttemptAnswer.aiFeedback
        Map<String, Object> aiFeedback = attemptAnswer != null ? attemptAnswer.getAiFeedback() : null;
        if (aiFeedback != null && aiFeedback.get("tasks") instanceof Map<?, ?> tasksMap) {
            Object taskData = tasksMap.get(questionId);
            if (taskData instanceof Map<?, ?> rawTask) {
                @SuppressWarnings("unchecked")
                Map<String, Object> taskMap = (Map<String, Object>) rawTask;

                if ("EMPTY_ESSAY".equals(taskMap.get("reasonCode")) && "SYSTEM".equals(taskMap.get("status"))) {
                    try {
                        var expectedLength = new com.multilingo.backend.modules.testing.util.WritingLengthCounter().count(originalText, language);
                        WritingGradingResultCodec.Decoded emptyResult = resultCodec.decode(taskMap);
                        if (WritingWordCounter.count(originalText) == 0 && !emptyResult.legacy()
                                && "WRITING_GENERIC_V1".equals(emptyResult.policy().rubricCode())
                                && language.equals(emptyResult.policy().sourceLanguage())
                                && BigDecimal.ZERO.compareTo(new BigDecimal(taskMap.get("overallScore").toString())) == 0
                                && taskMap.get("lengthMetric") instanceof Map<?, ?> metric
                                && metric.get("value") instanceof Number value && value.intValue() == expectedLength.value()
                                && Objects.equals(metric.get("unit"), expectedLength.unit().name())) {
                            return new WritingFeedbackResponse.TaskFeedback(questionId, label, "DONE", wordCount,
                                    expectedLength, language, "SYSTEM", emptyResult.policy().scoreUnit(), emptyResult.policy().rubricCode(),
                                    String.valueOf(taskMap.get("feedbackLanguage")), BigDecimal.ZERO, emptyResult.policy().maxScore(),
                                    List.of(), originalText, "", originalText, List.of(),
                                    originalText.isEmpty() ? List.of() : List.of(new WritingGrade.DiffSegment(WritingGrade.DiffType.EQUAL, originalText)),
                                    "EMPTY_ESSAY", "Bài viết đang để trống.", hasVisualContext, null);
                        }
                    } catch (RuntimeException ignored) {
                        // Invalid persisted short-circuit results fall through to the malformed-result path.
                    }
                }

                // Nếu là local unavailable (ví dụ: VISUAL_CONTEXT_UNSUPPORTED)
                if ("UNAVAILABLE".equalsIgnoreCase(String.valueOf(taskMap.get("status")))) {
                    String reasonCode = taskMap.get("reasonCode") != null
                            ? String.valueOf(taskMap.get("reasonCode"))
                            : "UNAVAILABLE";
                    return createUnavailableTask(questionId, label, wordCount, language, originalText, hasVisualContext, reasonCode,
                            resolveUnavailableMessage(reasonCode));
                }

                // Kiểm tra allowlist và tính toàn vẹn của WritingGrade
                WritingGrade grade = parseAndValidateGrade(taskMap, originalText, hasVisualContext);
                if (grade != null) {
                    boolean isTooShort = WritingGrade.RUBRIC_V1.equals(grade.rubricCode()) && wordCount <= 10;

                    if (isTooShort) {
                        return new WritingFeedbackResponse.TaskFeedback(
                                questionId,
                                label,
                                "DONE",
                                wordCount,
                                new com.multilingo.backend.modules.testing.util.WritingLengthCounter().count(originalText, language),
                                language,
                                "SYSTEM",
                                "BAND_0_9",
                                BigDecimal.ZERO,
                                BigDecimal.valueOf(9.0),
                                grade.criteria(),
                                originalText,
                                grade.overallFeedback(),
                                originalText,
                                List.of(),
                                grade.diff(),
                                "TOO_SHORT",
                                "Bài viết của bạn quá ngắn (không quá 10 từ), không đủ dung lượng tối thiểu để tiến hành chấm điểm bài luận.",
                                hasVisualContext, null
                        );
                    } else {
                        return new WritingFeedbackResponse.TaskFeedback(
                                questionId,
                                label,
                                "DONE",
                                wordCount,
                                new com.multilingo.backend.modules.testing.util.WritingLengthCounter().count(originalText, language),
                                language,
                                "AI",
                                "WRITING_GENERIC_V1".equals(grade.rubricCode()) ? "PRACTICE_0_10" : "BAND_0_9",
                                grade.rubricCode(), grade.feedbackLanguage(),
                                grade.overallScore(),
                                "WRITING_GENERIC_V1".equals(grade.rubricCode()) ? BigDecimal.TEN : BigDecimal.valueOf(9.0),
                                grade.criteria(),
                                originalText,
                                grade.overallFeedback(),
                                grade.correctedEssay(),
                                grade.corrections(),
                                grade.diff(),
                                null,
                                "Chấm điểm hoàn tất.",
                                hasVisualContext, hasVisualContext ? grade.visualObservations() : null
                        );
                    }
                } else {
                    // Dữ liệu persisted bị hỏng hoặc thiếu -> fail-closed sang FAILED, không thành DONE
                    return createFailedTask(questionId, label, wordCount, language, originalText, hasVisualContext,
                            "MALFORMED_FEEDBACK", "Không thể hiển thị kết quả chấm điểm do dữ liệu không hợp lệ.");
                }
            }
        }

        // 2. Nếu aiFeedback chưa có kết quả thành công, kiểm tra WritingGradingJob
        if (job == null) {
            // Attempt cũ không có job
            return createUnavailableTask(questionId, label, wordCount, language, originalText, hasVisualContext,
                    "LEGACY_NO_JOB", "Bài thi không có thông tin chấm điểm tự động.");
        }

        return switch (job.getStatus()) {
            case SUCCEEDED -> {
                WritingGrade grade = parseAndValidateGrade(job.getResultJson(), originalText, hasVisualContext);
                if (grade != null) {
                    boolean isTooShort = WritingGrade.RUBRIC_V1.equals(grade.rubricCode()) && wordCount <= 10;
                    yield new WritingFeedbackResponse.TaskFeedback(
                            questionId,
                            label,
                            "DONE",
                            wordCount,
                            new com.multilingo.backend.modules.testing.util.WritingLengthCounter().count(originalText, language),
                            language,
                            isTooShort ? "SYSTEM" : "AI",
                            "WRITING_GENERIC_V1".equals(grade.rubricCode()) ? "PRACTICE_0_10" : "BAND_0_9",
                            grade.rubricCode(), grade.feedbackLanguage(),
                            isTooShort ? BigDecimal.ZERO : grade.overallScore(),
                            "WRITING_GENERIC_V1".equals(grade.rubricCode()) ? BigDecimal.TEN : BigDecimal.valueOf(9.0),
                            grade.criteria(),
                            originalText,
                            grade.overallFeedback(),
                            isTooShort ? originalText : grade.correctedEssay(),
                            isTooShort ? List.of() : grade.corrections(),
                            grade.diff(),
                            isTooShort ? "TOO_SHORT" : null,
                            isTooShort
                                    ? "Bài viết của bạn quá ngắn (không quá 10 từ), không đủ dung lượng tối thiểu để tiến hành chấm điểm bài luận."
                                    : "Chấm điểm hoàn tất.",
                            hasVisualContext, !isTooShort && hasVisualContext ? grade.visualObservations() : null
                    );
                } else {
                    yield createFailedTask(questionId, label, wordCount, language, originalText, hasVisualContext,
                            "MALFORMED_FEEDBACK", "Không thể hiển thị kết quả chấm điểm do dữ liệu không hợp lệ.");
                }
            }
            case READY, RUNNING, RETRY_WAIT -> createPendingTask(questionId, label, wordCount, language, originalText, hasVisualContext);
            case WAITING -> createQueuedTask(questionId, label, wordCount, language, originalText, hasVisualContext, job.getWaitReason());
            case FAILED -> createFailedTask(questionId, label, wordCount, language, originalText, hasVisualContext,
                    job.getLastErrorCode() != null ? job.getLastErrorCode() : "FAILED",
                    "Không thể chấm bài viết do lỗi hệ thống.");
            case UNAVAILABLE -> {
                String reason = extractReasonFromJob(job);
                yield createUnavailableTask(questionId, label, wordCount, language, originalText, hasVisualContext, reason,
                        resolveUnavailableMessage(reason));
            }
        };
    }

    private WritingGrade parseAndValidateGrade(Map<String, Object> map, String originalText, boolean hasVisualContext) {
        if (map == null || map.isEmpty()) return null;
        try {
            JsonNode root = objectMapper.valueToTree(map);
            if (!root.path("overallScore").isNumber() || !root.path("diff").isArray()) return null;

            WritingRubricPolicy policy = null;
            String expectedFeedbackLanguage = WritingGrade.DEFAULT_LANGUAGE;
            if (root.has("schemaVersion")) {
                WritingGradingResultCodec.Decoded decoded = resultCodec.decode(map);
                if (decoded.legacy()) return null;
                policy = decoded.policy();
                expectedFeedbackLanguage = String.valueOf(map.get("feedbackLanguage"));
            } else if (!root.path("rubricCode").isTextual() || !WritingGrade.RUBRIC_V1.equals(root.path("rubricCode").textValue())) {
                return null;
            }

            // Reuse the approved parser for required texts/caps, exact scores and correction reconstruction.
            // Persisted-only metadata (overall, rubric, diff, audit) is validated separately, never sent to a provider.
            ObjectNode output = objectMapper.createObjectNode();
            for (String field : List.of("feedbackLanguage", "criteria", "overallFeedback", "correctedEssay", "corrections")) {
                output.set(field, root.get(field));
            }
            boolean genericRubric = policy != null && "WRITING_GENERIC_V1".equals(policy.rubricCode());
            boolean visual = hasVisualContext && (genericRubric || WritingWordCounter.count(originalText) > 10);
            if (root.hasNonNull("visualObservations")) output.set("visualObservations", root.get("visualObservations"));
            WritingGrade validated = gradeValidator.parse(objectMapper.writeValueAsString(output), originalText, visual, policy, expectedFeedbackLanguage);
            if (root.get("overallScore").decimalValue().compareTo(validated.overallScore()) != 0) return null;

            StringBuilder reconstructedOriginal = new StringBuilder();
            StringBuilder reconstructedCorrected = new StringBuilder();
            for (JsonNode segment : root.get("diff")) {
                if (!segment.isObject() || !segment.path("type").isTextual() || !segment.path("text").isTextual()) return null;
                String text = segment.get("text").textValue();
                switch (segment.get("type").textValue()) {
                    case "EQUAL" -> { reconstructedOriginal.append(text); reconstructedCorrected.append(text); }
                    case "DELETE" -> reconstructedOriginal.append(text);
                    case "INSERT" -> reconstructedCorrected.append(text);
                    default -> { return null; }
                }
                if (reconstructedOriginal.length() > originalText.length()
                        || reconstructedCorrected.length() > validated.correctedEssay().length()) return null;
            }
            if (!originalText.contentEquals(reconstructedOriginal)
                    || !validated.correctedEssay().contentEquals(reconstructedCorrected)) return null;
            // Return the allowlisted parser projection; persisted v2-only rubric fields must not be
            // deserialized as provider output (or passed through as arbitrary model fields).
            return validated;
        } catch (Exception e) {
            return null;
        }
    }

    private String resolvePartStatus(List<WritingFeedbackResponse.TaskFeedback> tasks) {
        if (tasks == null || tasks.isEmpty()) {
            return "UNAVAILABLE";
        }
        boolean allDone = true;
        boolean hasPending = false;
        boolean hasQueued = false;
        boolean hasFailed = false;

        for (WritingFeedbackResponse.TaskFeedback t : tasks) {
            String s = t.status();
            if (!"DONE".equalsIgnoreCase(s)) {
                allDone = false;
            }
            if ("PENDING".equalsIgnoreCase(s)) {
                hasPending = true;
            } else if ("QUEUED".equalsIgnoreCase(s)) {
                hasQueued = true;
            } else if ("FAILED".equalsIgnoreCase(s)) {
                hasFailed = true;
            }
        }

        if (allDone) {
            return "DONE";
        }
        if (hasPending) {
            return "PENDING";
        }
        if (hasQueued) {
            return "QUEUED";
        }
        if (hasFailed) {
            return "FAILED";
        }
        return "UNAVAILABLE";
    }

    private String extractOriginalText(AttemptAnswer attemptAnswer, String questionId) {
        if (attemptAnswer == null || attemptAnswer.getUserAnswers() == null) {
            return "";
        }
        Object raw = attemptAnswer.getUserAnswers().get(questionId);
        if (raw instanceof String text) {
            return text;
        }
        return "";
    }

    private String extractExamLanguage(Map<String, Object> snapshot) {
        if (snapshot == null) return null;
        Object lang = snapshot.get("examLanguage");
        if (lang == null) lang = snapshot.get("exam_language");
        if (lang instanceof String s && !s.isBlank()) {
            return s.trim().toLowerCase(Locale.ROOT);
        }
        return null;
    }

    private String extractReasonFromJob(WritingGradingJob job) {
        if (job == null) return "UNAVAILABLE";
        if (IMAGE_UNAVAILABLE_REASONS.contains(job.getLastErrorCode() == null ? "" : job.getLastErrorCode())) {
            return job.getLastErrorCode();
        }
        if (job.getContextJson() == null) return "UNAVAILABLE";
        Object r = job.getContextJson().get("reasonCode");
        return r != null ? String.valueOf(r) : "UNAVAILABLE";
    }

    private String resolveUnavailableMessage(String reasonCode) {
        switch (reasonCode) {
            case "IMAGE_TOO_LARGE": return "Hình ảnh vượt giới hạn dung lượng cho phép.";
            case "IMAGE_INVALID": return "Hình ảnh không hợp lệ hoặc có định dạng không được hỗ trợ.";
            case "IMAGE_UNAVAILABLE": return "Không thể truy cập hình ảnh của đề bài.";
            case "IMAGE_SOURCE_NOT_ALLOWED": return "Nguồn hình ảnh không được phép sử dụng.";
            default: break;
        }
        if ("VISUAL_CONTEXT_UNSUPPORTED".equals(reasonCode)) {
            return "Tính năng chấm bài viết có hình ảnh hiện đang tắt.";
        }
        if ("UNSUPPORTED_LANGUAGE".equals(reasonCode)) {
            return "Ngôn ngữ bài thi không hỗ trợ chấm điểm tự động.";
        }
        if ("LEGACY_NO_JOB".equals(reasonCode)) {
            return "Bài thi không có thông tin chấm điểm tự động.";
        }
        return "Bài thi không hỗ trợ tính năng chấm bài viết tự động.";
    }

    private WritingFeedbackResponse.TaskFeedback createPendingTask(
            String questionId, String label, int wordCount, String language, String originalText, boolean hasVisualContext) {
        return new WritingFeedbackResponse.TaskFeedback(
                questionId, label, "PENDING", wordCount, new com.multilingo.backend.modules.testing.util.WritingLengthCounter().count(originalText, language), language, "AI", "BAND_0_9",
                null, null, List.of(), originalText, null, null, List.of(), List.of(),
                null, "Bài viết đang được chấm điểm...", hasVisualContext, null
        );
    }

    private WritingFeedbackResponse.TaskFeedback createQueuedTask(
            String questionId, String label, int wordCount, String language, String originalText, boolean hasVisualContext, String waitReason) {
        return new WritingFeedbackResponse.TaskFeedback(
                questionId, label, "QUEUED", wordCount, new com.multilingo.backend.modules.testing.util.WritingLengthCounter().count(originalText, language), language, "AI", "BAND_0_9",
                null, null, List.of(), originalText, null, null, List.of(), List.of(),
                waitReason, "Bài viết đang trong hàng đợi chấm điểm...", hasVisualContext, null
        );
    }

    private WritingFeedbackResponse.TaskFeedback createFailedTask(
            String questionId, String label, int wordCount, String language, String originalText, boolean hasVisualContext,
            String reasonCode, String message) {
        return new WritingFeedbackResponse.TaskFeedback(
                questionId, label, "FAILED", wordCount, new com.multilingo.backend.modules.testing.util.WritingLengthCounter().count(originalText, language), language, "AI", "BAND_0_9",
                null, null, List.of(), originalText, null, null, List.of(), List.of(),
                reasonCode, message, hasVisualContext, null
        );
    }

    private WritingFeedbackResponse.TaskFeedback createUnavailableTask(
            String questionId, String label, int wordCount, String language, String originalText, boolean hasVisualContext,
            String reasonCode, String message) {
        return new WritingFeedbackResponse.TaskFeedback(
                questionId, label, "UNAVAILABLE", wordCount, new com.multilingo.backend.modules.testing.util.WritingLengthCounter().count(originalText, language), language, "SYSTEM", "BAND_0_9",
                null, null, List.of(), originalText, null, null, List.of(), List.of(),
                reasonCode, message, hasVisualContext, null
        );
    }
}
