package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.ai.grading.WritingGrade;
import com.multilingo.backend.modules.testing.ai.grading.WritingGradingContext;
import com.multilingo.backend.modules.testing.config.WritingGradingProperties;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.WritingGradingJob;
import com.multilingo.backend.modules.testing.entity.enums.WritingGradingJobStatus;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.WritingGradingJobRepository;
import com.multilingo.backend.modules.testing.util.AttemptResultScope;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

/**
 * Service đóng băng và đưa các bài thi Writing vào hàng đợi chấm (writing_grading_jobs)
 * ngay sau khi chấm điểm trắc nghiệm (objective) thành công.
 *
 * Yêu cầu:
 * - Chạy trong giao dịch bắt buộc (Propagation.MANDATORY).
 * - Idempotent: không chèn trùng lặp job khi submit nhiều lần.
 * - Không gọi provider AI và không reserve quota trong lúc submit.
 * - Bài viết ngắn (≤10 từ) nhận điểm 0 tự động (TOO_SHORT), lưu kết quả vào job và aiFeedback cục bộ.
 * - Bài viết không hợp lệ lưu trạng thái UNAVAILABLE.
 * - Bài viết hợp lệ tạo job READY (nếu enabled) hoặc WAITING (nếu disabled).
 */
@Component
public class WritingGradingEnqueuer {

    private final WritingGradingJobRepository jobRepository;
    private final WritingGradingContextReader contextReader;
    private final AttemptAnswerRepository attemptAnswerRepository;
    private final WritingGradingProperties properties;
    private final ObjectMapper objectMapper;

    @Autowired
    public WritingGradingEnqueuer(
            WritingGradingJobRepository jobRepository,
            WritingGradingContextReader contextReader,
            AttemptAnswerRepository attemptAnswerRepository,
            WritingGradingProperties properties,
            ObjectMapper objectMapper) {
        this.jobRepository = Objects.requireNonNull(jobRepository, "jobRepository must not be null");
        this.contextReader = Objects.requireNonNull(contextReader, "contextReader must not be null");
        this.attemptAnswerRepository = Objects.requireNonNull(attemptAnswerRepository, "attemptAnswerRepository must not be null");
        this.properties = Objects.requireNonNull(properties, "properties must not be null");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper must not be null");
    }

    private record WritingTarget(Integer partId, String questionId) {}

    @Transactional(propagation = Propagation.MANDATORY)
    public List<WritingGradingJob> enqueue(TestAttempt attempt, List<AttemptAnswer> answers) {
        if (attempt == null || attempt.getExamSnapshot() == null) {
            return Collections.emptyList();
        }

        List<WritingTarget> targets = extractWritingTargets(attempt.getExamSnapshot());
        if (targets.isEmpty()) {
            return Collections.emptyList();
        }

        List<WritingGradingJob> jobs = new ArrayList<>();

        for (WritingTarget target : targets) {
            Integer partId = target.partId();
            String questionId = target.questionId();

            Optional<WritingGradingJob> existing = jobRepository.findByAttemptIdAndPartIdAndQuestionId(
                    attempt.getId(), partId, questionId);
            if (existing.isPresent()) {
                jobs.add(existing.get());
                continue;
            }

            ContextDecision decision = contextReader.read(attempt, partId, questionId, answers, properties.isImagesEnabled());

            if (decision instanceof ContextDecision.Eligible eligible) {
                WritingGradingContext context = eligible.context();
                Map<String, Object> contextJson = buildContextJson(context);
                String inputHash = computeInputHash(contextJson);

                if (context.wordCount() <= 10) {
                    WritingGrade tooShortGrade = WritingGrade.tooShort(context.originalText());
                    @SuppressWarnings("unchecked")
                    Map<String, Object> resultMap = objectMapper.convertValue(tooShortGrade, Map.class);

                    WritingGradingJob job = WritingGradingJob.builder()
                            .attemptId(attempt.getId())
                            .partId(partId)
                            .questionId(questionId)
                            .contextJson(contextJson)
                            .inputHash(inputHash)
                            .status(WritingGradingJobStatus.SUCCEEDED)
                            .waitReason(null)
                            .attemptCount(0)
                            .imageCount(0)
                            .nextAttemptAt(null)
                            .quotaReserved(false)
                            .modelMetadata(Map.of("rubric", WritingGrade.DEFAULT_RUBRIC, "source", "LOCAL_SHORT_CIRCUIT"))
                            .resultJson(resultMap)
                            .completedAt(Instant.now())
                            .build();

                    job = jobRepository.save(job);
                    mergeAiFeedback(attempt, partId, questionId, resultMap);
                    jobs.add(job);
                } else {
                    WritingGradingJob job;
                    if (properties.isEnabled()) {
                        job = WritingGradingJob.builder()
                                .attemptId(attempt.getId())
                                .partId(partId)
                                .questionId(questionId)
                                .contextJson(contextJson)
                                .inputHash(inputHash)
                                .status(WritingGradingJobStatus.READY)
                                .waitReason(null)
                                .attemptCount(0)
                                .imageCount(context.imageCount())
                                .nextAttemptAt(Instant.now())
                                .quotaReserved(false)
                                .build();
                    } else {
                        job = WritingGradingJob.builder()
                                .attemptId(attempt.getId())
                                .partId(partId)
                                .questionId(questionId)
                                .contextJson(contextJson)
                                .inputHash(inputHash)
                                .status(WritingGradingJobStatus.WAITING)
                                .waitReason("FEATURE_DISABLED")
                                .attemptCount(0)
                                .imageCount(context.imageCount())
                                .nextAttemptAt(Instant.now().plus(properties.getQuotaRecheckInterval()))
                                .quotaReserved(false)
                                .build();
                    }
                    job = jobRepository.save(job);
                    jobs.add(job);
                }
            } else if (decision instanceof ContextDecision.Unavailable unavailable) {
                if ("VISUAL_CONTEXT_UNSUPPORTED".equals(unavailable.reasonCode())) {
                    Map<String, Object> localUnavailableResult = new LinkedHashMap<>();
                    localUnavailableResult.put("status", "UNAVAILABLE");
                    localUnavailableResult.put("reasonCode", unavailable.reasonCode());
                    localUnavailableResult.put("safeMessage", unavailable.safeMessage());
                    localUnavailableResult.put("score", null);
                    localUnavailableResult.put("overallScore", null);
                    mergeAiFeedback(attempt, partId, questionId, localUnavailableResult);
                    // Locked Decision #7: visual task khi images-enabled=false là terminal UNAVAILABLE ngay enqueue, không tạo job, không quota, không fetch
                    continue;
                }

                Map<String, Object> contextJson = Map.of(
                        "status", "UNAVAILABLE",
                        "reasonCode", unavailable.reasonCode(),
                        "safeMessage", unavailable.safeMessage(),
                        "partId", partId,
                        "questionId", questionId
                );
                String inputHash = computeInputHash(contextJson);

                WritingGradingJob job = WritingGradingJob.builder()
                        .attemptId(attempt.getId())
                        .partId(partId)
                        .questionId(questionId)
                        .contextJson(contextJson)
                        .inputHash(inputHash)
                        .status(WritingGradingJobStatus.UNAVAILABLE)
                        .waitReason(null)
                        .attemptCount(0)
                        .imageCount(0)
                        .nextAttemptAt(null)
                        .quotaReserved(false)
                        .lastErrorCode(unavailable.reasonCode())
                        .completedAt(Instant.now())
                        .build();

                job = jobRepository.save(job);
                jobs.add(job);
            }
        }

        return jobs;
    }

    private void mergeAiFeedback(TestAttempt attempt, Integer partId, String questionId, Map<String, Object> gradeMap) {
        AttemptAnswer answer = attemptAnswerRepository.findByAttemptIdAndPartId(attempt.getId(), partId)
                .orElseGet(() -> {
                    AttemptAnswer newAns = AttemptAnswer.builder()
                            .attempt(attempt)
                            .partId(partId)
                            .userAnswers(new LinkedHashMap<>())
                            .build();
                    return attemptAnswerRepository.save(newAns);
                });

        Map<String, Object> feedback = answer.getAiFeedback();
        if (feedback == null) {
            feedback = new LinkedHashMap<>();
        } else {
            feedback = new LinkedHashMap<>(feedback);
        }
        feedback.put("schemaVersion", 1);

        @SuppressWarnings("unchecked")
        Map<String, Object> tasks = (Map<String, Object>) feedback.get("tasks");
        if (tasks == null) {
            tasks = new LinkedHashMap<>();
        } else {
            tasks = new LinkedHashMap<>(tasks);
        }
        tasks.put(questionId, gradeMap);
        feedback.put("tasks", tasks);

        answer.setAiFeedback(feedback);
        attemptAnswerRepository.save(answer);
    }

    private Map<String, Object> buildContextJson(WritingGradingContext context) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("partId", context.partId());
        map.put("questionId", context.questionId());
        if (context.partTitle() != null) map.put("partTitle", context.partTitle());
        if (context.partInstruction() != null) map.put("partInstruction", context.partInstruction());
        if (context.groupInstruction() != null) map.put("groupInstruction", context.groupInstruction());
        map.put("taskPrompt", context.taskPrompt() != null ? context.taskPrompt() : "");
        map.put("originalText", context.originalText() != null ? context.originalText() : "");
        map.put("learningLanguage", context.learningLanguage());
        map.put("wordCount", context.wordCount());
        map.put("rubricCode", WritingGrade.DEFAULT_RUBRIC);
        map.put("promptVersion", "v2");
        if (context.images() != null && !context.images().isEmpty()) {
            List<Map<String, Object>> imageList = context.images().stream()
                    .map(img -> {
                        Map<String, Object> imgMap = new LinkedHashMap<>();
                        imgMap.put("url", img.url());
                        return imgMap;
                    })
                    .toList();
            map.put("images", imageList);
        }
        return map;
    }

    private String computeInputHash(Map<String, Object> map) {
        try {
            byte[] bytes = objectMapper.writeValueAsBytes(map);
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to compute SHA-256 input hash", e);
        }
    }

    private List<WritingTarget> extractWritingTargets(Map<String, Object> snapshot) {
        List<WritingTarget> targets = new ArrayList<>();
        try {
            List<AttemptResultScope.ScopedPart> scopedParts = AttemptResultScope.read(snapshot);
            for (AttemptResultScope.ScopedPart sp : scopedParts) {
                if ("WRITING".equalsIgnoreCase(sp.getSkill())) {
                    for (AttemptResultScope.ScopedQuestion sq : sp.getQuestions()) {
                        if ("ESSAY".equalsIgnoreCase(sq.getType())) {
                            targets.add(new WritingTarget(sp.getPartId(), sq.getQuestionId()));
                        }
                    }
                }
            }
        } catch (Exception ignored) {
            // Trường hợp snapshot không theo chuẩn AttemptResultScope, fallback thủ công
            targets = fallbackExtractTargets(snapshot);
        }
        return targets;
    }

    private List<WritingTarget> fallbackExtractTargets(Map<String, Object> snapshot) {
        if (snapshot == null) return List.of();
        Object sectionsObj = snapshot.get("sections");
        if (!(sectionsObj instanceof List<?> sections)) return List.of();

        List<WritingTarget> targets = new ArrayList<>();
        for (Object sObj : sections) {
            if (!(sObj instanceof Map<?, ?> sectionMap)) continue;
            Object skillObj = sectionMap.get("skill");
            if (skillObj == null) skillObj = sectionMap.get("name");
            String skill = skillObj instanceof String s ? s : "";
            if (!"WRITING".equalsIgnoreCase(skill)) continue;

            Object partsObj = sectionMap.get("parts");
            if (!(partsObj instanceof List<?> parts)) continue;
            for (Object pObj : parts) {
                if (!(pObj instanceof Map<?, ?> partMap)) continue;
                Object idObj = partMap.get("id");
                if (idObj == null) idObj = partMap.get("part_id");
                Integer partId = idObj instanceof Number n ? n.intValue() : null;
                if (partId == null) continue;

                Object questionsObj = partMap.get("questions");
                if (questionsObj instanceof List<?> questions) {
                    for (Object qObj : questions) {
                        if (qObj instanceof Map<?, ?> qMap) {
                            Object typeObj = qMap.get("type");
                            Object qIdObj = qMap.get("id");
                            if (qIdObj == null) qIdObj = qMap.get("question_id");
                            if ("ESSAY".equalsIgnoreCase(String.valueOf(typeObj)) && qIdObj != null) {
                                targets.add(new WritingTarget(partId, String.valueOf(qIdObj)));
                            }
                        }
                    }
                }
            }
        }
        return targets;
    }
}
