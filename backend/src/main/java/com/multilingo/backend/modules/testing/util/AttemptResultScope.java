package com.multilingo.backend.modules.testing.util;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.util.*;

public final class AttemptResultScope {

    public static final Set<String> OBJECTIVE_TYPES = Set.of(
            "SINGLE_CHOICE", "TRUE_FALSE_NOT_GIVEN", "YES_NO_NOT_GIVEN",
            "FILL_IN_THE_BLANK", "MULTIPLE_CHOICE", "MULTIPLE_CHOICE_MULTI", "MATCHING",
            "MATCHING_FEATURES", "MATCHING_HEADINGS", "MATCHING_SENTENCE_ENDINGS", "MATCHING_INFORMATION",
            "DIAGRAM_LABELING", "MAP_LABELING"
    );

    public static final Set<String> WRITING_TYPES = Set.of("ESSAY");

    private AttemptResultScope() {
    }

    @Value
    @Builder
    public static class ScopedQuestion {
        String questionId;
        String type;
        boolean objective;
        String label;
    }

    @Value
    @Builder
    public static class ScopedPart {
        Integer partId;
        String label;
        String skill;
        List<ScopedQuestion> questions;
    }

    public static List<ScopedPart> read(Map<String, Object> snapshot) {
        if (snapshot == null) {
            throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Exam snapshot is null");
        }

        Object sectionsObj = snapshot.get("sections");
        if (!(sectionsObj instanceof List<?> sectionList) || sectionList.isEmpty()) {
            throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Exam snapshot missing or empty sections");
        }

        List<ScopedPart> scopedParts = new ArrayList<>();
        Set<Integer> seenPartIds = new HashSet<>();

        for (Object sObj : sectionList) {
            if (!(sObj instanceof Map<?, ?> sectionMap)) {
                throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Invalid section structure in snapshot");
            }

            String skill = resolveSkill(sectionMap.get("name") != null ? sectionMap.get("name") : sectionMap.get("skill"));

            Object partsObj = sectionMap.get("parts");
            if (partsObj == null) {
                continue;
            }
            if (!(partsObj instanceof List<?> partList)) {
                throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Parts must be a list in section: " + skill);
            }

            for (Object pObj : partList) {
                if (!(pObj instanceof Map<?, ?> partMap)) {
                    throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Invalid part structure in section: " + skill);
                }

                Object idObj = partMap.get("id");
                if (idObj == null) idObj = partMap.get("part_id");
                if (idObj == null) idObj = partMap.get("partId");
                Integer partId = parsePartId(idObj);
                if (partId == null) {
                    throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Invalid or missing part ID in section: " + skill);
                }
                if (!seenPartIds.add(partId)) {
                    throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Duplicate part ID in snapshot: " + partId);
                }

                String label = resolveLabel(partMap, partId);
                Set<String> partQuestionIds = new HashSet<>();
                List<ScopedQuestion> questions = extractQuestions(partMap, partId, partQuestionIds);

                scopedParts.add(ScopedPart.builder()
                        .partId(partId)
                        .label(label)
                        .skill(skill)
                        .questions(questions)
                        .build());
            }
        }

        return Collections.unmodifiableList(scopedParts);
    }

    private static Integer parsePartId(Object idObj) {
        if (idObj == null) {
            return null;
        }
        if (idObj instanceof Integer i) {
            return i > 0 ? i : null;
        }
        if (idObj instanceof Long l) {
            return (l > 0 && l <= Integer.MAX_VALUE) ? l.intValue() : null;
        }
        if (idObj instanceof Short s) {
            return s > 0 ? s.intValue() : null;
        }
        if (idObj instanceof Byte b) {
            return b > 0 ? b.intValue() : null;
        }
        if (idObj instanceof Number) {
            try {
                BigDecimal bd = new BigDecimal(idObj.toString().trim());
                if (bd.scale() <= 0 || bd.stripTrailingZeros().scale() <= 0) {
                    long val = bd.longValueExact();
                    if (val > 0 && val <= Integer.MAX_VALUE) {
                        return (int) val;
                    }
                }
            } catch (Exception ignored) {
            }
            return null;
        }
        String str = idObj.toString().trim();
        try {
            long val = Long.parseLong(str);
            if (val > 0 && val <= Integer.MAX_VALUE) {
                return (int) val;
            }
        } catch (NumberFormatException ignored) {
        }
        return null;
    }

    private static String resolveSkill(Object nameObj) {
        if (nameObj instanceof String s && !s.isBlank()) {
            return s.trim().toUpperCase(Locale.ROOT);
        }
        return "UNKNOWN";
    }

    private static String resolveLabel(Map<?, ?> partMap, Integer partId) {
        Object titleObj = partMap.get("title");
        if (titleObj instanceof String s && !s.isBlank()) {
            return s.trim();
        }
        Object partTitleObj = partMap.get("partTitle");
        if (partTitleObj instanceof String s && !s.isBlank()) {
            return s.trim();
        }
        Object snakePartTitleObj = partMap.get("part_title");
        if (snakePartTitleObj instanceof String s && !s.isBlank()) {
            return s.trim();
        }
        return "Part " + partId;
    }

    private static List<ScopedQuestion> extractQuestions(Map<?, ?> partMap, Integer partId, Set<String> seenQuestionIds) {
        Object groupsObj = partMap.get("questionGroups");
        if (groupsObj == null) {
            groupsObj = partMap.get("question_groups");
        }

        List<ScopedQuestion> questions = new ArrayList<>();

        if (groupsObj != null) {
            if (!(groupsObj instanceof List<?> groupList)) {
                throw new AppException(ErrorCode.GRADING_DATA_ERROR, "questionGroups must be a list in part " + partId);
            }
            for (Object g : groupList) {
                if (!(g instanceof Map<?, ?> gMap)) {
                    throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Question group must be an object in part " + partId);
                }
                Object qListObj = gMap.get("questions");
                if (qListObj != null) {
                    if (!(qListObj instanceof List<?> qList)) {
                        throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Group questions must be a list in part " + partId);
                    }
                    for (Object q : qList) {
                        questions.add(parseQuestion(q, partId, seenQuestionIds));
                    }
                }
            }
        } else {
            Object qListObj = partMap.get("questions");
            if (qListObj != null) {
                if (!(qListObj instanceof List<?> qList)) {
                    throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Questions must be a list in part " + partId);
                }
                for (Object q : qList) {
                    questions.add(parseQuestion(q, partId, seenQuestionIds));
                }
            }
        }

        return questions;
    }

    private static ScopedQuestion parseQuestion(Object q, Integer partId, Set<String> seenQuestionIds) {
        if (!(q instanceof Map<?, ?> qMap)) {
            throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Question must be an object in part " + partId);
        }

        Object idObj = qMap.get("question_id");
        if (idObj == null) idObj = qMap.get("questionId");
        if (idObj == null) idObj = qMap.get("id");
        if (idObj == null) {
            throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Question missing id in part " + partId);
        }
        String qId;
        if (idObj instanceof String s && !s.isBlank()) {
            qId = s.trim();
        } else if (idObj instanceof Number n) {
            qId = String.valueOf(n);
        } else {
            throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Invalid question id type in part " + partId);
        }

        if (!seenQuestionIds.add(qId)) {
            throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Duplicate question ID in part " + partId + ": " + qId);
        }

        Object typeObj = qMap.get("type");
        if (typeObj == null) typeObj = qMap.get("questionType");
        if (typeObj == null) typeObj = qMap.get("question_type");
        if (!(typeObj instanceof String s && !s.isBlank())) {
            throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Question missing or invalid type for " + qId + " in part " + partId);
        }
        String type = s.trim().toUpperCase(Locale.ROOT);
        if ("MCQ".equals(type)) {
            type = "SINGLE_CHOICE";
        } else if ("FILL_IN".equals(type)) {
            type = "FILL_IN_THE_BLANK";
        }

        boolean isObjective = OBJECTIVE_TYPES.contains(type);
        if (!isObjective && !WRITING_TYPES.contains(type)) {
            throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Unsupported question type: " + type + " for " + qId);
        }

        Object titleObj = qMap.get("title");
        if (!(titleObj instanceof String sTitle && !sTitle.isBlank())) {
            titleObj = qMap.get("label");
        }
        String label = (titleObj instanceof String sLabel && !sLabel.isBlank())
                ? sLabel.trim()
                : null;

        return ScopedQuestion.builder()
                .questionId(qId)
                .type(type)
                .objective(isObjective)
                .label(label)
                .build();
    }
}
