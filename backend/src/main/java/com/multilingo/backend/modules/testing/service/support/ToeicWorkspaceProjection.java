package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.modules.testing.entity.enums.TestMode;

import java.math.BigDecimal;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Pure server-side projection for TOEIC workspace responses.
 * Enforces canonical 1..200 question numbering, Part 3/4 prompt prefix stripping,
 * and Mock-mode transcript/clue filtering without mutating persisted attempt snapshot.
 */
public final class ToeicWorkspaceProjection {

    private static final Pattern CANONICAL_Q_PATTERN = Pattern.compile("^q_0*([1-9][0-9]*)$");

    private static final Set<String> MOCK_SECRETS = Set.of(
            "transcript", "transcripts",
            "listening_transcript", "listeningTranscript",
            "audio_script", "audioScript", "script",
            "spoken_text", "spokenText",
            "listening_detail", "listeningDetail",
            "conversation_transcript", "talk_transcript",
            "answer_clue", "answerClue", "clue", "clues",
            "audio_text", "audioText",
            "spoken_question", "spokenQuestion",
            "spoken_prompt", "spokenPrompt",
            "spoken_statement", "spokenStatement",
            "spoken_dialogue", "spokenDialogue",
            "audio_transcript", "audioTranscript"
    );

    private ToeicWorkspaceProjection() {}

    /**
     * Determines whether an attempt snapshot represents a TOEIC exam based on explicit
     * exam code or exam type. Never guesses from title or mutable DB rows.
     */
    public static boolean isToeicExam(Map<String, Object> snapshot) {
        if (snapshot == null || snapshot.isEmpty()) {
            return false;
        }

        Object codeObj = snapshot.get("code");
        if (codeObj == null) codeObj = snapshot.get("exam_code");
        if (codeObj == null) codeObj = snapshot.get("examCode");
        if (codeObj != null && codeObj.toString().toUpperCase(Locale.ROOT).contains("TOEIC")) {
            return true;
        }

        Object typeObj = snapshot.get("type");
        if (typeObj == null) typeObj = snapshot.get("exam_type");
        if (typeObj == null) typeObj = snapshot.get("examType");
        if (typeObj != null && typeObj.toString().toUpperCase(Locale.ROOT).contains("TOEIC")) {
            return true;
        }

        return false;
    }

    /**
     * Parses the canonical 1..200 question number from a question ID (e.g. q_001 -> 1, q_200 -> 200).
     * Validates against the expected part range when partNumber is known.
     */
    public static Integer parseCanonicalQuestionNumber(String questionId, Integer partNumber) {
        if (questionId == null || questionId.isBlank()) {
            return null;
        }
        Matcher matcher = CANONICAL_Q_PATTERN.matcher(questionId.trim());
        if (!matcher.matches()) {
            return null;
        }
        int num;
        try {
            num = Integer.parseInt(matcher.group(1));
        } catch (NumberFormatException e) {
            return null;
        }
        if (num < 1 || num > 200) {
            return null;
        }
        if (partNumber != null && partNumber >= 1 && partNumber <= 7) {
            int minExpected = getPartMinQuestion(partNumber);
            int maxExpected = getPartMaxQuestion(partNumber);
            if (num < minExpected || num > maxExpected) {
                return null;
            }
        }
        return num;
    }

    /**
     * In Part 3 and Part 4, removes the "Question N" prefix from the prompt only when N matches
     * the canonical question number. If N does not match or if stripping would make the prompt empty,
     * preserves the original text to avoid loss of question content.
     */
    public static String stripPart34PromptPrefix(String text, Integer canonicalNum) {
        if (text == null || canonicalNum == null) {
            return text;
        }
        Pattern pattern = Pattern.compile("(?i)^Question\\s+" + canonicalNum + "[:\\s\\.\\-]*\\s*(.*)$");
        Matcher matcher = pattern.matcher(text.trim());
        if (matcher.matches()) {
            String remainder = matcher.group(1).trim();
            if (!remainder.isEmpty()) {
                return remainder;
            }
        }
        return text;
    }

    /**
     * Projects the workspace snapshot for presentation. Does not mutate the input snapshot.
     */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> project(Map<String, Object> snapshot, TestMode testMode) {
        if (snapshot == null || snapshot.isEmpty() || !isToeicExam(snapshot)) {
            return snapshot;
        }

        Map<String, Object> copy = (Map<String, Object>) deepCopy(snapshot);
        boolean isMock = testMode == TestMode.MOCK_TEST;

        Object sectionsObj = copy.get("sections");
        if (!(sectionsObj instanceof List<?> sections)) {
            return copy;
        }

        int globalPartIndex = 1;
        for (Object sObj : sections) {
            if (!(sObj instanceof Map<?, ?> sectionMapRaw)) continue;
            Map<String, Object> sectionMap = (Map<String, Object>) sectionMapRaw;

            Object partsObj = sectionMap.get("parts");
            if (!(partsObj instanceof List<?> parts)) continue;

            for (Object pObj : parts) {
                if (!(pObj instanceof Map<?, ?> partMapRaw)) continue;
                Map<String, Object> partMap = (Map<String, Object>) partMapRaw;

                Integer partNumber = resolvePartNumber(partMap, globalPartIndex);
                globalPartIndex++;

                boolean isPart1Or2 = (partNumber != null && (partNumber == 1 || partNumber == 2));

                if (isMock) {
                    filterMockSecrets(partMap);
                    if (isPart1Or2) {
                        partMap.remove("content_html");
                        partMap.remove("contentHtml");
                        partMap.remove("context_html");
                        partMap.remove("contextHtml");
                        partMap.remove("content");
                        partMap.remove("passage");
                        partMap.remove("text");
                    }
                }

                // Questions may be serialized as a grouped structure and/or a flat compatibility
                // list; `DbExamAdapter` can emit both for the same Part, and after the snapshot is
                // (de)serialized the two lists are independent objects. Redact every list that is
                // actually present so Mock secrets cannot slip through the un-processed copy.
                Object groupsObj = partMap.get("question_groups");
                if (groupsObj == null) groupsObj = partMap.get("questionGroups");

                if (groupsObj instanceof List<?> groups) {
                    for (Object gObj : groups) {
                        if (!(gObj instanceof Map<?, ?> groupMapRaw)) continue;
                        Map<String, Object> groupMap = (Map<String, Object>) groupMapRaw;

                        if (isMock) {
                            filterMockSecrets(groupMap);
                            if (isPart1Or2) {
                                groupMap.remove("content_html");
                                groupMap.remove("contentHtml");
                                groupMap.remove("context_html");
                                groupMap.remove("contextHtml");
                                groupMap.remove("content");
                                groupMap.remove("passage");
                                groupMap.remove("text");
                                groupMap.remove("instruction");
                            }
                        }

                        Object questionsObj = groupMap.get("questions");
                        if (questionsObj instanceof List<?> questions) {
                            for (Object qObj : questions) {
                                if (!(qObj instanceof Map<?, ?> qMapRaw)) continue;
                                projectQuestion((Map<String, Object>) qMapRaw, partNumber, isMock);
                            }
                        }
                    }
                }

                Object flatQuestionsObj = partMap.get("questions");
                if (flatQuestionsObj instanceof List<?> flatQuestions) {
                    for (Object qObj : flatQuestions) {
                        if (!(qObj instanceof Map<?, ?> qMapRaw)) continue;
                        projectQuestion((Map<String, Object>) qMapRaw, partNumber, isMock);
                    }
                }
            }
        }

        return copy;
    }

    private static void projectQuestion(Map<String, Object> questionMap, Integer partNumber, boolean isMock) {
        if (isMock) {
            filterMockSecrets(questionMap);
        }

        Integer canonicalNum = null;
        Object explicitNum = questionMap.get("question_number");
        if (explicitNum == null) explicitNum = questionMap.get("questionNumber");
        if (explicitNum instanceof Number n) {
            try {
                int number = new BigDecimal(n.toString()).intValueExact();
                canonicalNum = parseCanonicalQuestionNumber("q_" + number, partNumber);
            } catch (ArithmeticException | NumberFormatException ignored) {
                // Fractional or overflowing values must fall back to the snapshot's canonical ID.
            }
        } else if (explicitNum instanceof String s && !s.isBlank()) {
            try {
                int number = new BigDecimal(s.trim()).intValueExact();
                canonicalNum = parseCanonicalQuestionNumber("q_" + number, partNumber);
            } catch (ArithmeticException | NumberFormatException ignored) {
                // Non-numeric, fractional or overflowing string values must fall back.
            }
        }
        if (canonicalNum == null) {
            Object qIdObj = questionMap.get("question_id");
            if (qIdObj == null) qIdObj = questionMap.get("questionId");
            if (qIdObj == null) qIdObj = questionMap.get("id");
            if (qIdObj != null) {
                canonicalNum = parseCanonicalQuestionNumber(qIdObj.toString(), partNumber);
            }
        }

        questionMap.remove("question_number");
        questionMap.remove("questionNumber");
        if (canonicalNum != null) {
            questionMap.put("question_number", canonicalNum);
            questionMap.put("questionNumber", canonicalNum);

            if (partNumber != null && (partNumber == 3 || partNumber == 4 || (canonicalNum >= 32 && canonicalNum <= 100))) {
                if (questionMap.get("question_text") instanceof String qt) {
                    questionMap.put("question_text", stripPart34PromptPrefix(qt, canonicalNum));
                }
                if (questionMap.get("prompt") instanceof String p) {
                    questionMap.put("prompt", stripPart34PromptPrefix(p, canonicalNum));
                }
            }
        }

        // Mock Part 1 and Part 2: spoken options must not reveal text, and prompt/question text must be safe canonical label
        boolean isPart1Or2 = (partNumber != null && (partNumber == 1 || partNumber == 2))
                || (canonicalNum != null && canonicalNum <= 31);
        if (isMock && isPart1Or2) {
            String safeCanonicalLabel = (canonicalNum != null && canonicalNum > 0)
                    ? "Question " + canonicalNum
                    : "Question";

            // Replace free-form prompt / question text fields with safe canonical label to prevent audio question leakage
            questionMap.put("question_text", safeCanonicalLabel);
            if (questionMap.containsKey("questionText")) {
                questionMap.put("questionText", safeCanonicalLabel);
            }
            if (questionMap.containsKey("prompt")) {
                questionMap.put("prompt", safeCanonicalLabel);
            }
            if (questionMap.containsKey("title")) {
                questionMap.put("title", safeCanonicalLabel);
            }
            questionMap.remove("content");
            questionMap.remove("content_html");
            questionMap.remove("contentHtml");
            questionMap.remove("context_html");
            questionMap.remove("contextHtml");
            questionMap.remove("text");
            questionMap.remove("passage");
            questionMap.remove("instruction");

            Object optionsObj = questionMap.get("options");
            if (optionsObj instanceof List<?> options) {
                List<Map<String, Object>> sanitizedOptions = new ArrayList<>();
                for (Object opt : options) {
                    if (opt instanceof Map<?, ?> optMap) {
                        Map<String, Object> safeOpt = new LinkedHashMap<>();
                        safeOpt.put("id", optMap.get("id"));
                        safeOpt.put("text", "");
                        sanitizedOptions.add(safeOpt);
                    }
                }
                questionMap.put("options", sanitizedOptions);
            }
        }
    }

    private static void filterMockSecrets(Map<String, Object> map) {
        if (map == null) return;
        for (String secretKey : MOCK_SECRETS) {
            map.remove(secretKey);
        }
    }

    private static Integer resolvePartNumber(Map<String, Object> partMap, int fallbackIndex) {
        Object pNum = partMap.get("part_number");
        if (pNum == null) pNum = partMap.get("partNumber");
        if (pNum instanceof Number n && n.intValue() >= 1 && n.intValue() <= 7) {
            return n.intValue();
        }
        Object title = partMap.get("part_title");
        if (title == null) title = partMap.get("title");
        if (title instanceof String s) {
            Matcher m = Pattern.compile("(?i)Part\\s*([1-7])").matcher(s);
            if (m.find()) {
                return Integer.parseInt(m.group(1));
            }
        }
        return fallbackIndex >= 1 && fallbackIndex <= 7 ? fallbackIndex : null;
    }

    private static int getPartMinQuestion(int partNumber) {
        return switch (partNumber) {
            case 1 -> 1;
            case 2 -> 7;
            case 3 -> 32;
            case 4 -> 71;
            case 5 -> 101;
            case 6 -> 131;
            case 7 -> 147;
            default -> 1;
        };
    }

    private static int getPartMaxQuestion(int partNumber) {
        return switch (partNumber) {
            case 1 -> 6;
            case 2 -> 31;
            case 3 -> 70;
            case 4 -> 100;
            case 5 -> 130;
            case 6 -> 146;
            case 7 -> 200;
            default -> 200;
        };
    }

    @SuppressWarnings("unchecked")
    private static Object deepCopy(Object obj) {
        if (obj instanceof Map<?, ?> map) {
            Map<String, Object> copy = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (entry.getKey() != null) {
                    copy.put(entry.getKey().toString(), deepCopy(entry.getValue()));
                }
            }
            return copy;
        } else if (obj instanceof List<?> list) {
            List<Object> copy = new ArrayList<>(list.size());
            for (Object item : list) {
                copy.add(deepCopy(item));
            }
            return copy;
        }
        return obj;
    }
}
