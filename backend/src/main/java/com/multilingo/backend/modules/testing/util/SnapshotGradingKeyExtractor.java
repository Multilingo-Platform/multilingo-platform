package com.multilingo.backend.modules.testing.util;

import com.multilingo.backend.modules.testing.grading.dto.GradingKey;
import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;

import java.util.*;

public final class SnapshotGradingKeyExtractor {

    private SnapshotGradingKeyExtractor() {}

    @SuppressWarnings("unchecked")
    public static Map<Integer, PartGradingKey> extractFromSnapshot(Map<String, Object> snapshot) {
        if (snapshot == null || !snapshot.containsKey("sections")) {
            return Collections.emptyMap();
        }

        Object rawSections = snapshot.get("sections");
        if (!(rawSections instanceof List<?> sections) || sections.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<Integer, PartGradingKey> result = new LinkedHashMap<>();

        for (Object sObj : sections) {
            if (!(sObj instanceof Map<?, ?> section)) {
                continue;
            }

            String sectionName = null;
            if (section.get("name") != null) {
                sectionName = section.get("name").toString();
            } else if (section.get("skillType") != null) {
                sectionName = section.get("skillType").toString();
            } else if (section.get("skill") != null) {
                sectionName = section.get("skill").toString();
            }

            Object partsObj = section.get("parts");
            if (!(partsObj instanceof List<?> parts)) {
                continue;
            }

            for (Object pObj : parts) {
                if (!(pObj instanceof Map<?, ?> part)) {
                    continue;
                }

                Object idObj = part.get("id");
                if (idObj == null) idObj = part.get("part_id");
                if (idObj == null) idObj = part.get("partId");
                if (idObj == null) {
                    continue;
                }

                Integer partId;
                if (idObj instanceof Number num) {
                    partId = num.intValue();
                } else {
                    try {
                        partId = Integer.parseInt(idObj.toString());
                    } catch (NumberFormatException e) {
                        continue;
                    }
                }

                PartGradingKey partGradingKey = new PartGradingKey();
                partGradingKey.setPartId(partId);
                partGradingKey.setSectionName(sectionName);

                Map<String, GradingKey> answers = new LinkedHashMap<>();
                Set<String> seenQuestionIds = new HashSet<>();

                List<Map<String, Object>> questions = new ArrayList<>();
                if (part.get("questions") instanceof List<?> qList) {
                    for (Object q : qList) {
                        if (q instanceof Map<?, ?> qm) {
                            questions.add((Map<String, Object>) qm);
                        }
                    }
                }
                if (questions.isEmpty()) {
                    Object groupsObj = part.get("question_groups");
                    if (groupsObj == null) {
                        groupsObj = part.get("questionGroups");
                    }
                    if (groupsObj instanceof List<?> gList) {
                        for (Object g : gList) {
                            if (g instanceof Map<?, ?> gm) {
                                Object gOptions = gm.get("options");
                                if (gm.get("questions") instanceof List<?> gqList) {
                                    for (Object q : gqList) {
                                        if (q instanceof Map<?, ?> qm) {
                                            Map<String, Object> qMap = (Map<String, Object>) qm;
                                            if (!qMap.containsKey("options")) {
                                                if (gOptions != null) {
                                                    qMap = new LinkedHashMap<>(qMap);
                                                    qMap.put("options", gOptions);
                                                } else if (qMap.get("metadata") instanceof Map<?, ?> mm && mm.containsKey("options")) {
                                                    qMap = new LinkedHashMap<>(qMap);
                                                    qMap.put("options", mm.get("options"));
                                                }
                                            }
                                            questions.add(qMap);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                for (Map<String, Object> question : questions) {
                    addGradingKey(answers, seenQuestionIds, question);
                }

                if (!answers.isEmpty()) {
                    partGradingKey.setAnswers(answers);
                    result.put(partId, partGradingKey);
                }
            }
        }

        boolean normalizeNfc = "TV3_LANG_V1".equals(snapshot.get("languagePolicyVersion"));
        if (normalizeNfc) {
            result.values().stream().map(PartGradingKey::getAnswers).filter(Objects::nonNull)
                    .forEach(keys -> keys.values().forEach(key -> key.setNormalizeNfc(true)));
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private static void addGradingKey(Map<String, GradingKey> answers, Set<String> seenQuestionIds,
                                      Map<String, Object> question) {
        Object rawQuestionId = question.get("question_id");
        if (rawQuestionId == null) rawQuestionId = question.get("questionId");
        if (rawQuestionId == null) rawQuestionId = question.get("id");
        String questionId = rawQuestionId != null ? rawQuestionId.toString().trim() : null;

        Object rawType = question.get("type");
        if (rawType == null) rawType = question.get("questionType");
        if (rawType == null) rawType = question.get("question_type");
        String type = rawType != null ? rawType.toString().trim() : null;

        if (questionId != null && !seenQuestionIds.add(questionId)) {
            throw new IllegalArgumentException("Duplicate question_id within part: " + questionId);
        }

        if (questionId == null || type == null || "ESSAY".equalsIgnoreCase(type)) {
            return;
        }

        Map<String, Object> metadata = question.get("metadata") instanceof Map<?, ?> mm
                ? (Map<String, Object>) mm
                : null;

        Object correct = question.get("correct_answer");
        if (correct == null) correct = question.get("correctAnswer");

        List<String> alternates = new ArrayList<>();
        if (question.get("alternates") instanceof List<?> alts) {
            for (Object a : alts) {
                if (a != null && !a.toString().isBlank()) alternates.add(a.toString().trim());
            }
        }

        if ((correct == null || (correct instanceof String s && s.isBlank())) && metadata != null) {
            Object metaCorrect = metadata.get("correct_answer");
            if (metaCorrect == null) metaCorrect = metadata.get("correctAnswer");
            if (metaCorrect != null && (!(metaCorrect instanceof String s) || !s.isBlank())) {
                correct = metaCorrect;
            }
        }

        Object rawOptions = question.get("options");
        if (rawOptions == null && metadata != null) {
            rawOptions = metadata.get("options");
        }
        List<?> optionList = rawOptions instanceof List<?> list ? list : Collections.emptyList();

        if (metadata != null && metadata.containsKey("correct_option_index") && metadata.get("correct_option_index") instanceof Number num) {
            int idx = num.intValue();
            if (idx >= 0) {
                String letter = String.valueOf((char) ('A' + idx));
                String optionText = null;
                if (idx < optionList.size() && optionList.get(idx) != null) {
                    Object optItem = optionList.get(idx);
                    if (optItem instanceof Map<?, ?> optMap) {
                        Object textVal = optMap.get("text");
                        if (textVal != null) optionText = textVal.toString().trim();
                    } else if (!optItem.toString().isBlank()) {
                        optionText = optItem.toString().trim();
                    }
                }

                if (correct == null || (correct instanceof String s && s.isBlank())) {
                    if (optionText != null && !optionText.isBlank()) {
                        correct = optionText;
                        alternates.add(letter);
                    } else {
                        correct = letter;
                    }
                } else {
                    if (!letter.equalsIgnoreCase(correct.toString().trim())) {
                        alternates.add(letter);
                    }
                    if (optionText != null && !optionText.isBlank() && !optionText.equalsIgnoreCase(correct.toString().trim())) {
                        alternates.add(optionText);
                    }
                }
            }
        }

        if (metadata != null && metadata.containsKey("correct_option_indices") && metadata.get("correct_option_indices") instanceof List<?> idxList) {
            List<String> letters = new ArrayList<>();
            List<String> texts = new ArrayList<>();
            for (Object o : idxList) {
                if (o instanceof Number num) {
                    int idx = num.intValue();
                    if (idx >= 0) {
                        String letter = String.valueOf((char) ('A' + idx));
                        letters.add(letter);
                        if (idx < optionList.size() && optionList.get(idx) != null) {
                            String t = optionList.get(idx).toString().trim();
                            if (!t.isBlank()) texts.add(t);
                        }
                    }
                }
            }
            if (!letters.isEmpty()) {
                if (correct == null || (correct instanceof String s && s.isBlank()) || (correct instanceof Collection<?> c && c.isEmpty())) {
                    correct = letters;
                    if (!texts.isEmpty()) {
                        alternates.addAll(texts);
                    }
                } else {
                    alternates.addAll(letters);
                    alternates.addAll(texts);
                }
            }
        }

        if (metadata != null && metadata.get("alternates") instanceof List<?> metaAlts) {
            for (Object a : metaAlts) {
                if (a != null && !a.toString().isBlank()) alternates.add(a.toString().trim());
            }
        }

        if (correct == null || (correct instanceof String s && s.isBlank())) {
            return;
        }

        GradingKey key = new GradingKey();
        key.setQuestionId(questionId);
        key.setType(type);
        key.setCorrect(correct);
        key.setAnswerGroup(GradingKey.AnswerGroup.parse(question.get("answer_group"), questionId));
        if (!alternates.isEmpty()) {
            key.setAlternates(alternates);
        }

        if ("MATCHING_HEADINGS".equalsIgnoreCase(type)) {
            resolveMatchingHeadingsOptions(key, question);
        }

        answers.put(questionId, key);
    }

    private static void resolveMatchingHeadingsOptions(GradingKey key, Map<String, Object> question) {
        Object rawOptions = question.get("options");
        if (!(rawOptions instanceof List<?> optionList) || optionList.isEmpty()) {
            return;
        }

        List<String> alternates = key.getAlternates();
        List<String> updatedAlternates = (alternates != null) ? new ArrayList<>(alternates) : new ArrayList<>();

        Object correctObj = key.getCorrect();

        for (Object rawOpt : optionList) {
            if (!(rawOpt instanceof Map<?, ?> optMap)) {
                continue;
            }
            Object idObj = optMap.get("id");
            Object textObj = optMap.get("text");
            if (idObj == null || textObj == null) {
                continue;
            }
            String optId = idObj.toString().trim();
            String optText = textObj.toString().trim();
            if (optId.isEmpty() || optText.isEmpty()) {
                continue;
            }

            boolean isMatch = false;

            if (correctObj instanceof String correctStr) {
                if (matchesText(optText, correctStr) || matchesText(optId, correctStr)) {
                    isMatch = true;
                }
            } else if (correctObj instanceof Collection<?> coll) {
                for (Object item : coll) {
                    if (item != null && (matchesText(optText, item.toString()) || matchesText(optId, item.toString()))) {
                        isMatch = true;
                        break;
                    }
                }
            }

            if (!isMatch && alternates != null) {
                for (String alt : alternates) {
                    if (alt != null && (matchesText(optText, alt) || matchesText(optId, alt))) {
                        isMatch = true;
                        break;
                    }
                }
            }

            if (isMatch) {
                if (!updatedAlternates.contains(optId) && !containsNormalized(correctObj, optId)) {
                    updatedAlternates.add(optId);
                }
                if (!updatedAlternates.contains(optText) && !containsNormalized(correctObj, optText)) {
                    updatedAlternates.add(optText);
                }
            }
        }

        if (!updatedAlternates.isEmpty()) {
            key.setAlternates(updatedAlternates);
        }
    }

    private static boolean containsNormalized(Object correctObj, String target) {
        if (correctObj instanceof String s) {
            return matchesText(s, target);
        }
        if (correctObj instanceof Collection<?> coll) {
            for (Object item : coll) {
                if (item != null && matchesText(item.toString(), target)) {
                    return true;
                }
            }
        }
        return false;
    }

    private static boolean matchesText(String s1, String s2) {
        if (s1 == null || s2 == null) {
            return false;
        }
        String n1 = s1.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        String n2 = s2.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        return n1.equals(n2);
    }

    public static boolean hasObjectiveQuestions(Map<String, Object> snapshot) {
        if (snapshot == null || !snapshot.containsKey("sections")) {
            return false;
        }

        Object rawSections = snapshot.get("sections");
        if (!(rawSections instanceof List<?> sections) || sections.isEmpty()) {
            return false;
        }

        for (Object sObj : sections) {
            if (!(sObj instanceof Map<?, ?> section)) {
                continue;
            }
            Object partsObj = section.get("parts");
            if (!(partsObj instanceof List<?> parts)) {
                continue;
            }
            for (Object pObj : parts) {
                if (pObj instanceof Map<?, ?> part && hasObjectiveQuestionsInPart((Map<String, Object>) part)) {
                    return true;
                }
            }
        }
        return false;
    }

    @SuppressWarnings("unchecked")
    public static boolean hasObjectiveQuestionsInPart(Map<String, Object> part) {
        if (part == null) {
            return false;
        }
        if (part.get("questions") instanceof List<?> qList) {
            for (Object q : qList) {
                if (q instanceof Map<?, ?> qm && isObjectiveQuestion((Map<String, Object>) qm)) {
                    return true;
                }
            }
        }
        Object groupsObj = part.get("question_groups");
        if (groupsObj == null) {
            groupsObj = part.get("questionGroups");
        }
        if (groupsObj instanceof List<?> gList) {
            for (Object g : gList) {
                if (g instanceof Map<?, ?> gm) {
                    if (gm.get("questions") instanceof List<?> gqList) {
                        for (Object q : gqList) {
                            if (q instanceof Map<?, ?> qm && isObjectiveQuestion((Map<String, Object>) qm)) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        return false;
    }

    private static boolean isObjectiveQuestion(Map<String, Object> question) {
        Object rawType = question.get("type");
        if (rawType == null) rawType = question.get("questionType");
        if (rawType == null) rawType = question.get("question_type");
        if (rawType == null) {
            return false;
        }
        String type = rawType.toString().trim();
        return !type.equalsIgnoreCase("ESSAY");
    }
}
