package com.multilingo.backend.modules.testing.util;

import java.util.*;

public final class WorkspaceSnapshotSanitizer {

    private WorkspaceSnapshotSanitizer() {}

    private static final Set<String> BLACKLISTED_KEYS = Set.of(
            "correct_answer", "correctAnswer",
            "explanation",
            "ai_prompt_context", "aiPromptContext",
            "ai_feedback", "aiFeedback",
            "feedback",
            "grading_key", "gradingKey",
            "grading_keys", "gradingKeys",
            "is_correct_flags", "isCorrectFlags",
            "earned_score", "earnedScore",
            "skill_stats", "skillStats",
            "accepted_answers", "acceptedAnswers"
    );

    @SuppressWarnings("unchecked")
    public static Map<String, Object> sanitize(Map<String, Object> snapshot) {
        if (snapshot == null) {
            return Collections.emptyMap();
        }
        return (Map<String, Object>) sanitizeObject(snapshot);
    }

    @SuppressWarnings("unchecked")
    private static Object sanitizeObject(Object obj) {
        if (obj instanceof Map<?, ?> map) {
            Map<String, Object> sanitizedMap = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (entry.getKey() == null) continue;
                String keyStr = entry.getKey().toString();
                if (BLACKLISTED_KEYS.contains(keyStr)) {
                    continue; // Skip blacklisted private keys
                }
                sanitizedMap.put(keyStr, sanitizeObject(entry.getValue()));
            }
            return sanitizedMap;
        } else if (obj instanceof List<?> list) {
            List<Object> sanitizedList = new ArrayList<>(list.size());
            for (Object item : list) {
                sanitizedList.add(sanitizeObject(item));
            }
            return sanitizedList;
        } else {
            return obj;
        }
    }
}
