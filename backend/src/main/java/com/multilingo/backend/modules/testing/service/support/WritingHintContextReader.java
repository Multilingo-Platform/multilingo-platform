package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.util.AttemptResultScope;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Đọc ngữ cảnh đề bài Writing từ attempt snapshot bất biến.
 * Tuân thủ quy tắc phạm vi, ưu tiên grouped questions trước flat questions,
 * loại trừ tuyệt đối answer keys / grading metadata / các câu hỏi khác,
 * và giới hạn tối đa 16.000 Unicode code points.
 */
@Component
public class WritingHintContextReader {

    public static final int MAX_CONTEXT_CODE_POINTS = 16000;

    private static final List<String> MEDIA_KEYS = List.of(
            "shared_media", "sharedMedia",
            "image_url", "imageUrl", "images", "image",
            "media", "diagram", "chart_url", "chartUrl",
            "attachments", "attachment"
    );

    public HintContext read(TestAttempt attempt, Integer partId, String questionId) {
        if (attempt == null || attempt.getExamSnapshot() == null) {
            throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Attempt or exam snapshot not found");
        }
        if (partId == null || questionId == null || questionId.isBlank()) {
            throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "partId and questionId must not be null or blank");
        }

        Map<String, Object> snapshot = attempt.getExamSnapshot();

        // 1. Xác thực phạm vi và kiểu câu hỏi thông qua AttemptResultScope
        List<AttemptResultScope.ScopedPart> scopedParts;
        try {
            scopedParts = AttemptResultScope.read(snapshot);
        } catch (AppException e) {
            throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Invalid attempt snapshot scope");
        }

        AttemptResultScope.ScopedPart targetScopedPart = scopedParts.stream()
                .filter(sp -> Objects.equals(sp.getPartId(), partId))
                .findFirst()
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Part not found in attempt snapshot"));

        AttemptResultScope.ScopedQuestion targetScopedQuestion = targetScopedPart.getQuestions().stream()
                .filter(sq -> Objects.equals(sq.getQuestionId(), questionId))
                .findFirst()
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Question not found in part"));

        String qType = targetScopedQuestion.getType();
        boolean isWriting = AttemptResultScope.WRITING_TYPES.contains(qType)
                || "ESSAY".equalsIgnoreCase(qType)
                || "WRITING".equalsIgnoreCase(qType);

        if (!isWriting || targetScopedQuestion.isObjective()) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "Question is not an ESSAY/WRITING task");
        }

        // 2. Tìm raw partMap trong snapshot
        Map<?, ?> rawPartMap = findRawPartMap(snapshot, partId);
        if (rawPartMap == null) {
            throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Raw part not found in snapshot");
        }

        String partTitle = extractFirstText(rawPartMap, "title", "partTitle", "part_title");
        String partInstruction = extractFirstText(rawPartMap, "instruction", "instructions", "description", "context");
        boolean partHasMedia = hasMedia(rawPartMap);

        // 3. Tìm raw questionMap theo thứ tự ưu tiên: grouped questions trước, flat questions chỉ khi groups absent
        RawQuestionData rawQuestionData = findRawQuestionData(rawPartMap, questionId);
        if (rawQuestionData == null) {
            throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Raw question not found in part");
        }

        String prompt = rawQuestionData.prompt;
        if (prompt == null || prompt.isBlank()) {
            throw new AppException(ErrorCode.WRITING_HINTS_CONTEXT_UNAVAILABLE, "Writing task prompt is missing or blank");
        }

        boolean hasVisualContext = partHasMedia || rawQuestionData.groupHasMedia || rawQuestionData.questionHasMedia;

        // 4. Kiểm tra giới hạn tối đa 16.000 Unicode code points
        int totalCodePoints = 0;
        if (partTitle != null) {
            totalCodePoints += partTitle.codePointCount(0, partTitle.length());
        }
        if (partInstruction != null) {
            totalCodePoints += partInstruction.codePointCount(0, partInstruction.length());
        }
        if (rawQuestionData.groupInstruction != null) {
            totalCodePoints += rawQuestionData.groupInstruction.codePointCount(0, rawQuestionData.groupInstruction.length());
        }
        totalCodePoints += prompt.codePointCount(0, prompt.length());

        if (totalCodePoints > MAX_CONTEXT_CODE_POINTS) {
            throw new AppException(ErrorCode.WRITING_HINTS_CONTEXT_UNAVAILABLE, "Context exceeds 16,000 code points");
        }

        return new HintContext(
                partId,
                questionId,
                partTitle,
                partInstruction,
                rawQuestionData.groupInstruction,
                prompt,
                hasVisualContext
        );
    }

    private Map<?, ?> findRawPartMap(Map<String, Object> snapshot, Integer partId) {
        Object sectionsObj = snapshot.get("sections");
        if (!(sectionsObj instanceof List<?> sectionList)) {
            return null;
        }

        for (Object sObj : sectionList) {
            if (!(sObj instanceof Map<?, ?> sectionMap)) {
                continue;
            }
            Object partsObj = sectionMap.get("parts");
            if (!(partsObj instanceof List<?> partList)) {
                continue;
            }
            for (Object pObj : partList) {
                if (!(pObj instanceof Map<?, ?> partMap)) {
                    continue;
                }
                Integer pid = resolvePartId(partMap);
                if (Objects.equals(pid, partId)) {
                    return partMap;
                }
            }
        }
        return null;
    }

    private Integer resolvePartId(Map<?, ?> partMap) {
        Object idObj = partMap.get("id");
        if (idObj == null) idObj = partMap.get("part_id");
        if (idObj == null) idObj = partMap.get("partId");
        if (idObj == null) {
            return null;
        }
        if (idObj instanceof Number n) {
            int val = n.intValue();
            return val > 0 ? val : null;
        }
        try {
            int val = Integer.parseInt(idObj.toString().trim());
            return val > 0 ? val : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private RawQuestionData findRawQuestionData(Map<?, ?> partMap, String questionId) {
        Object groupsObj = partMap.get("questionGroups");
        if (groupsObj == null) {
            groupsObj = partMap.get("question_groups");
        }

        // Ưu tiên grouped questions nếu groupsObj != null (kể cả khi rỗng)
        if (groupsObj != null) {
            if (groupsObj instanceof List<?> groupList) {
                for (Object gObj : groupList) {
                    if (!(gObj instanceof Map<?, ?> groupMap)) {
                        continue;
                    }
                    String groupInstruction = extractFirstText(groupMap, "instruction", "instructions", "context", "passage", "description");
                    boolean groupHasMedia = hasMedia(groupMap);

                    Object qListObj = groupMap.get("questions");
                    if (qListObj instanceof List<?> qList) {
                        for (Object qObj : qList) {
                            if (!(qObj instanceof Map<?, ?> qMap)) {
                                continue;
                            }
                            if (matchesQuestionId(qMap, questionId)) {
                                String prompt = extractFirstText(qMap, "question_text", "content", "title", "text", "prompt");
                                boolean questionHasMedia = hasMedia(qMap);
                                return new RawQuestionData(groupInstruction, prompt, groupHasMedia, questionHasMedia);
                            }
                        }
                    }
                }
            }
            // Nếu groupsObj tồn tại nhưng không tìm thấy trong nhóm, không rơi về flat questions
            return null;
        }

        // groupsObj absent (null): tìm trong flat questions
        Object qListObj = partMap.get("questions");
        if (qListObj instanceof List<?> qList) {
            for (Object qObj : qList) {
                if (!(qObj instanceof Map<?, ?> qMap)) {
                    continue;
                }
                if (matchesQuestionId(qMap, questionId)) {
                    String prompt = extractFirstText(qMap, "question_text", "content", "title", "text", "prompt");
                    boolean questionHasMedia = hasMedia(qMap);
                    return new RawQuestionData(null, prompt, false, questionHasMedia);
                }
            }
        }

        return null;
    }

    private String resolveQuestionId(Map<?, ?> qMap) {
        Object idObj = qMap.get("question_id");
        if (idObj == null) idObj = qMap.get("questionId");
        if (idObj == null) idObj = qMap.get("id");
        if (idObj == null) {
            return null;
        }
        if (idObj instanceof String s && !s.isBlank()) {
            return s.trim();
        }
        if (idObj instanceof Number n) {
            return String.valueOf(n);
        }
        return null;
    }

    private boolean matchesQuestionId(Map<?, ?> qMap, String targetQuestionId) {
        String resolvedId = resolveQuestionId(qMap);
        return resolvedId != null && resolvedId.equals(targetQuestionId);
    }

    private String extractFirstText(Map<?, ?> map, String... keys) {
        for (String key : keys) {
            Object val = map.get(key);
            if (val instanceof String s && !s.isBlank()) {
                return s;
            }
        }
        return null;
    }

    private boolean hasMedia(Map<?, ?> map) {
        for (String key : MEDIA_KEYS) {
            Object val = map.get(key);
            if (val instanceof String s && !s.isBlank()) {
                return true;
            }
            if (val instanceof Collection<?> c && !c.isEmpty()) {
                return true;
            }
            if (val instanceof Map<?, ?> m && !m.isEmpty()) {
                return true;
            }
        }
        return false;
    }

    private record RawQuestionData(
            String groupInstruction,
            String prompt,
            boolean groupHasMedia,
            boolean questionHasMedia
    ) {}

    public record HintContext(
            Integer partId,
            String questionId,
            String partTitle,
            String partInstruction,
            String groupInstruction,
            String taskPrompt,
            boolean hasVisualContext
    ) {}
}
