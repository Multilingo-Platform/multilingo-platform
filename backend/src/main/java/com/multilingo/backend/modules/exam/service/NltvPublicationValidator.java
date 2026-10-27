package com.multilingo.backend.modules.exam.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import com.multilingo.backend.modules.exam.dto.response.ExamImportPreviewResponse.Issue;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Fixed profile validation for the registered NLTV sample dataset. */
public final class NltvPublicationValidator {
    private static final int[] QUESTIONS_PER_PART = {15, 14, 14, 12, 16, 24, 10, 1, 1};
    private static final int[] GROUPS_PER_PART = {1, 5, 7, 6, 2, 3, 1, 1, 1};
    private static final Set<String> STRUCTURAL_ISSUES = Set.of(
            "TYPE_INVALID", "LANGUAGE_INVALID", "STRUCTURE_INVALID", "SKILL_INVALID",
            "DURATION_INVALID", "SOURCE_COUNTS_INVALID", "ID_INVALID");

    public List<Issue> issues(ExamBuilderRequest request) {
        List<Issue> issues = new ArrayList<>();
        if (request == null || !"NLTV".equals(request.getType())) {
            add(issues, "TYPE_INVALID", null, "Loại đề không phải NLTV.");
            return List.copyOf(issues);
        }
        if (!"vi".equals(request.getExamLanguage())) add(issues, "LANGUAGE_INVALID", null, "NLTV phải dùng language vi.");
        if (request.getSections() == null || request.getSections().size() != 3) {
            add(issues, "STRUCTURE_INVALID", null, "NLTV cần đúng ba section.");
            return List.copyOf(issues);
        }
        String[] skills = {"LISTENING", "READING", "WRITING"};
        int[] firstParts = {1, 5, 7};
        int[] lastParts = {4, 6, 9};
        Set<Integer> seenParts = new HashSet<>();
        int total = 0;
        for (int sectionIndex = 0; sectionIndex < request.getSections().size(); sectionIndex++) {
            var section = request.getSections().get(sectionIndex);
            if (section == null) {
                add(issues, "STRUCTURE_INVALID", null, "Section không hợp lệ.");
                continue;
            }
            if (!skills[sectionIndex].equals(section.getSkillType()))
                add(issues, "SKILL_INVALID", null, "Thứ tự skill NLTV không hợp lệ.");
            if (!Integer.valueOf(60).equals(section.getDurationMinutes()))
                add(issues, "DURATION_INVALID", null, "Mỗi section NLTV phải có thời lượng 60 phút.");
            if (section.getParts() == null || section.getParts().size() != lastParts[sectionIndex] - firstParts[sectionIndex] + 1) {
                add(issues, "STRUCTURE_INVALID", null, "Số Part trong section không đúng.");
                continue;
            }
            for (var part : section.getParts()) {
                if (part == null || part.getPartNumber() == null || part.getContentData() == null) {
                    add(issues, "STRUCTURE_INVALID", null, "Part NLTV thiếu số hoặc content data.");
                    continue;
                }
                int partNumber = part.getPartNumber();
                if (partNumber < firstParts[sectionIndex] || partNumber > lastParts[sectionIndex]
                        || !seenParts.add(partNumber)) {
                    add(issues, "STRUCTURE_INVALID", null, "Part NLTV nằm sai section hoặc bị trùng.");
                    continue;
                }
                Object rawGroups = part.getContentData().get("question_groups");
                if (!(rawGroups instanceof List<?> groups) || groups.size() != GROUPS_PER_PART[partNumber - 1]) {
                    add(issues, "SOURCE_COUNTS_INVALID", null, "Số nhóm câu hỏi không đúng tại Part " + partNumber + ".");
                    continue;
                }
                if (partNumber <= 4 && !validMedia(part.getContentData().get("shared_audio"))) {
                    add(issues, "AUDIO_REQUIRED", null, "Thiếu audio gốc cho Part " + partNumber + ".");
                }
                Set<String> groupIds = new HashSet<>();
                Set<String> questionIds = new HashSet<>();
                int partCount = 0;
                for (Object rawGroup : groups) {
                    if (!(rawGroup instanceof Map<?, ?> group)) {
                        add(issues, "STRUCTURE_INVALID", null, "Question group không hợp lệ.");
                        continue;
                    }
                    if (!(group.get("group_id") instanceof String groupId) || groupId.isBlank() || !groupIds.add(groupId))
                        add(issues, "ID_INVALID", null, "Group ID thiếu hoặc trùng trong Part.");
                    if (group.get("shared_media") != null && !validMedia(group.get("shared_media")))
                        add(issues, "MEDIA_INVALID", null, "Media nhóm không hợp lệ.");
                    if ((partNumber == 5 || partNumber == 6) && blank(group.get("content_html")))
                        add(issues, "CONTEXT_REQUIRED", null, "Reading group thiếu passage.");
                    if (!(group.get("questions") instanceof List<?> questions) || questions.isEmpty()) {
                        add(issues, "STRUCTURE_INVALID", null, "Group thiếu câu hỏi.");
                        continue;
                    }
                    for (Object rawQuestion : questions) {
                        partCount++;
                        if (!(rawQuestion instanceof Map<?, ?> question)) {
                            add(issues, "STRUCTURE_INVALID", null, "Question không hợp lệ.");
                            continue;
                        }
                        validateQuestion(partNumber, question, questionIds, issues);
                    }
                    if (partNumber == 7) {
                        validateMaskedPassage(group, questions, issues);
                        validateWordBank(group, questions, issues);
                    }
                }
                if (partCount != QUESTIONS_PER_PART[partNumber - 1])
                    add(issues, "SOURCE_COUNTS_INVALID", null, "Số câu không đúng tại Part " + partNumber + ".");
                total += partCount;
            }
        }
        if (seenParts.size() != 9 || total != 107)
            add(issues, "SOURCE_COUNTS_INVALID", null, "NLTV cần đủ 107 câu/yêu cầu trong 9 Part.");
        return List.copyOf(issues);
    }

    public void requireStructure(ExamBuilderRequest request) {
        if (issues(request).stream().anyMatch(issue -> STRUCTURAL_ISSUES.contains(issue.code())))
            throw new AppException(ErrorCode.VALIDATION_FAILED,
                    "Cấu trúc đề NLTV không hợp lệ; kiểm tra language, sections, Part, nhóm và ID.");
    }

    public void requirePublishable(ExamBuilderRequest request) {
        var issues = issues(request);
        if (!issues.isEmpty()) {
            String details = issues.stream()
                    .map(Issue::message)
                    .filter(msg -> msg != null && !msg.isBlank())
                    .distinct()
                    .limit(5)
                    .collect(java.util.stream.Collectors.joining("; "));
            throw new AppException(ErrorCode.VALIDATION_FAILED,
                    "Đề NLTV chưa đạt điều kiện xuất bản: " + details);
        }
    }

    private static void validateQuestion(int part, Map<?, ?> question, Set<String> ids, List<Issue> issues) {
        String id = question.get("question_id") instanceof String value ? value : null;
        if (id == null || id.isBlank() || !id.matches("q_\\d{3}") || !ids.add(id))
            add(issues, "ID_INVALID", id, "Question ID thiếu, sai định dạng hoặc trùng trong Part.");
        if (blank(question.get("question_text"))) add(issues, "PROMPT_REQUIRED", id, "Question text bị thiếu.");
        if (question.get("media") != null && !validMedia(question.get("media")))
            add(issues, "MEDIA_INVALID", id, "Question media không hợp lệ.");
        if (part <= 6) {
            if (!"SINGLE_CHOICE".equals(question.get("type"))) add(issues, "TYPE_INVALID", id, "Question cần SINGLE_CHOICE.");
            validateChoices(part == 1 ? 3 : 4, question, id, issues);
            if (blank(question.get("explanation"))) add(issues, "EXPLANATION_REQUIRED", id, "Thiếu explanation.");
        } else if (part == 7) {
            if (!"FILL_IN_THE_BLANK".equals(question.get("type"))) add(issues, "TYPE_INVALID", id, "Part 7 cần FILL_IN_THE_BLANK.");
            if (!(question.get("correct_answer") instanceof String answer) || answer.isBlank())
                add(issues, "ANSWER_INVALID", id, "Part 7 thiếu đáp án.");
        } else {
            int minimum = part == 8 ? 120 : 200;
            if (!"ESSAY".equals(question.get("type")) || !Integer.valueOf(minimum).equals(question.get("min_words")))
                add(issues, "ESSAY_METADATA_INVALID", id, "Essay type hoặc min_words không đúng.");
            if (question.containsKey("correct_answer") && question.get("correct_answer") != null)
                add(issues, "ANSWER_INVALID", id, "Essay không được có correct_answer.");
        }
    }

    private static void validateChoices(int expected, Map<?, ?> question, String id, List<Issue> issues) {
        if (!(question.get("options") instanceof List<?> options) || options.size() != expected) {
            add(issues, "OPTIONS_INVALID", id, "Số options không đúng.");
            return;
        }
        Set<String> ids = new HashSet<>();
        for (Object raw : options) {
            if (!(raw instanceof Map<?, ?> option) || !(option.get("id") instanceof String optionId)
                    || !optionId.matches("[A-D]") || !ids.add(optionId) || blank(option.get("text"))) {
                add(issues, "OPTIONS_INVALID", id, "Options cần ID A–D duy nhất và nội dung.");
                return;
            }
        }
        Object answer = question.get("correct_answer");
        if (!(answer instanceof String answerId) || !ids.contains(answerId))
            add(issues, "ANSWER_INVALID", id, "Đáp án phải là ID option hợp lệ.");
    }

    private static void validateMaskedPassage(Map<?, ?> group, List<?> questions, List<Issue> issues) {
        String passage = group.get("content_html") instanceof String text ? text : "";
        for (int number = 1; number <= 10; number++) {
            String marker = "(" + number + ") ____";
            boolean hasMarker = passage.contains(marker)
                    || passage.matches("(?s).*\\(\\s*" + number + "\\s*\\)\\s*(?:_{2,}|\\.{2,}|[-–—]{2,}|\\u2026+).*");
            if (!hasMarker) add(issues, "DICTATION_MARKER_INVALID", null, "Thiếu marker trống tại Part 7.");
        }
        for (int i = 0; i < questions.size(); i++) {
            Object raw = questions.get(i);
            if (raw instanceof Map<?, ?> question
                    && question.get("correct_answer") instanceof String answer && !answer.isBlank()) {
                int number = i + 1;
                Object idObj = question.get("question_id");
                String id = idObj instanceof String s ? s : "q_" + number;
                try {
                    int parsed = Integer.parseInt(id.replaceAll("^q_0*", ""));
                    if (parsed >= 1 && parsed <= 10) number = parsed;
                } catch (RuntimeException ignored) {}
                String leakedPattern = "(?s).*\\(\\s*" + number + "\\s*\\)\\s+" + java.util.regex.Pattern.quote(answer.trim()) + ".*";
                if (passage.contains("(" + number + ") " + answer.trim()) || passage.matches(leakedPattern))
                    add(issues, "ANSWER_KEY_LEAK", id, "Passage chính tả còn lộ đáp án.");
            }
        }
    }

    private static void validateWordBank(Map<?, ?> group, List<?> questions, List<Issue> issues) {
        String instruction = group.get("instruction") instanceof String value ? value : "";
        String marker = "Các từ để chọn:";
        int markerIndex = instruction.indexOf(marker);
        if (markerIndex < 0) {
            add(issues, "WORD_BANK_INVALID", null, "Part 7 thiếu danh sách từ để chọn.");
            return;
        }
        String[] entries = instruction.substring(markerIndex + marker.length()).split(",");
        Set<String> choices = new HashSet<>();
        for (String entry : entries) {
            String normalized = entry.trim().replaceFirst("[.\\s]+$", "").toLowerCase(Locale.ROOT);
            if (!normalized.isBlank()) choices.add(normalized);
        }
        if (choices.size() != 10) {
            add(issues, "WORD_BANK_INVALID", null, "Part 7 cần đủ mười từ lựa chọn riêng biệt.");
            return;
        }
        for (Object raw : questions) if (raw instanceof Map<?, ?> question) {
            String id = question.get("question_id") instanceof String value ? value : null;
            String answer = question.get("correct_answer") instanceof String value ? value : null;
            if (answer == null || !choices.contains(answer.trim().toLowerCase(Locale.ROOT)))
                add(issues, "WORD_BANK_INVALID", id, "Đáp án Part 7 không có trong danh sách từ lựa chọn.");
        }
    }

    private static boolean validMedia(Object value) {
        if (!(value instanceof Map<?, ?> media) || !(media.get("url") instanceof String url)) return false;
        try {
            var uri = java.net.URI.create(url);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null
                    && uri.getUserInfo() == null && uri.getFragment() == null;
        } catch (RuntimeException exception) { return false; }
    }

    private static boolean blank(Object value) { return !(value instanceof String text) || text.isBlank(); }
    private static void add(List<Issue> issues, String code, String id, String message) {
        issues.add(new Issue(code, null, null, id, message));
    }
}
