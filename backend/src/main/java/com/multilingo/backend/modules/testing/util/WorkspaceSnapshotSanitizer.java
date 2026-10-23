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
            "accepted_answers", "acceptedAnswers",
            "alternates",
            "alternate_answers", "alternateAnswers",
            "alternate_key", "alternateKey",
            "alternate_keys", "alternateKeys",
            "correct_option_index", "correctOptionIndex",
            "correct_option_indices", "correctOptionIndices",
            "answer_key", "answerKey",
            "answer_keys", "answerKeys"
    );

    private static final Set<String> NORMALIZED_BLACKLISTED_KEYS;
    static {
        Set<String> set = new HashSet<>();
        for (String key : BLACKLISTED_KEYS) {
            set.add(key.toLowerCase(Locale.ROOT));
            set.add(key.toLowerCase(Locale.ROOT).replace("_", ""));
        }
        NORMALIZED_BLACKLISTED_KEYS = Collections.unmodifiableSet(set);
    }

    private static boolean isBlacklisted(String key) {
        if (key == null) return false;
        String lower = key.trim().toLowerCase(Locale.ROOT);
        return BLACKLISTED_KEYS.contains(key)
                || NORMALIZED_BLACKLISTED_KEYS.contains(lower)
                || NORMALIZED_BLACKLISTED_KEYS.contains(lower.replace("_", ""));
    }

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
                if (isBlacklisted(keyStr)) {
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
