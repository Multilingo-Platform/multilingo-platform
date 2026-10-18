package com.multilingo.backend.modules.exam.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import com.multilingo.backend.modules.exam.dto.response.ExamImportPreviewResponse.Issue;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** Validates the Cambridge IELTS 20 Academic canonical request without requiring explanations. */
public final class IeltsAcademicPublicationValidator {
    private static final int[] QUESTION_COUNTS = {10, 10, 10, 10, 13, 13, 14, 1, 1};
    private static final int[] GROUP_COUNTS = {1, 3, 4, 1, 2, 3, 3, 1, 1};
    private static final String[] SKILLS = {"LISTENING", "READING", "WRITING"};
    private static final int[] DURATIONS = {30, 60, 60};
    private static final String UNVERIFIED_TEXT_MARKER = "dongan.signs";
    private static final Set<String> OBJECTIVE_TYPES = Set.of("SINGLE_CHOICE", "FILL_IN_THE_BLANK",
            "TRUE_FALSE_NOT_GIVEN", "YES_NO_NOT_GIVEN", "MATCHING_FEATURES");

    public void requireStructure(ExamBuilderRequest request) {
        Set<String> structuralCodes = Set.of("STRUCTURE_INVALID", "ID_INVALID", "SKILL_INVALID",
                "DURATION_INVALID", "QUESTION_COUNT_INVALID", "GROUP_COUNT_INVALID");
        if (issues(request).stream().anyMatch(issue -> structuralCodes.contains(issue.code())))
            throw new AppException(ErrorCode.VALIDATION_FAILED,
                    "Cấu trúc bộ Cambridge IELTS 20 Test 1 không hợp lệ; kiểm tra Part, nhóm và ID.");
    }

    public void requirePublishable(ExamBuilderRequest request) {
        if (!issues(request).isEmpty())
            throw new AppException(ErrorCode.VALIDATION_FAILED,
                    "IELTS chưa đạt điều kiện xuất bản; kiểm tra cấu trúc, đáp án, cặp câu và nội dung nguồn.");
    }

    public List<Issue> issues(ExamBuilderRequest request) {
        List<Issue> issues = new ArrayList<>();
        if (request == null || !"IELTS_ACADEMIC".equals(request.getType())
                || !"Cambridge Ielts 20 Test 1".equals(request.getTitle())
                || !"en".equals(request.getExamLanguage())) {
            add(issues, "STRUCTURE_INVALID", null, "Thông tin bộ Cambridge IELTS 20 Test 1 không hợp lệ.");
            return List.copyOf(issues);
        }
        if (request.getSections() == null || request.getSections().size() != 3) {
            add(issues, "STRUCTURE_INVALID", null, "Cần đúng ba section Listening, Reading và Writing.");
            return List.copyOf(issues);
        }

        Set<Integer> seenParts = new HashSet<>();
        Set<String> questionIds = new HashSet<>();
        Set<String> groupIds = new HashSet<>();
        Map<String, PairMember> pairMembers = new HashMap<>();
        int groupCount = 0;
        int[] questionsByPart = new int[9];

        for (int sectionIndex = 0; sectionIndex < request.getSections().size(); sectionIndex++) {
            var section = request.getSections().get(sectionIndex);
            if (section == null || !SKILLS[sectionIndex].equals(section.getSkillType())
                    || !Objects.equals(DURATIONS[sectionIndex], section.getDurationMinutes())
                    || section.getParts() == null || section.getParts().isEmpty()) {
                add(issues, "STRUCTURE_INVALID", null, "Section hoặc thời lượng không khớp cấu hình IELTS.");
                continue;
            }
            for (var part : section.getParts()) {
                if (part == null || part.getPartNumber() == null || part.getPartNumber() < 1 || part.getPartNumber() > 9
                        || !seenParts.add(part.getPartNumber()) || part.getContentData() == null) {
                    add(issues, "STRUCTURE_INVALID", null, "Part thiếu, trùng hoặc không hợp lệ.");
                    continue;
                }
                int partNumber = part.getPartNumber();
                String expectedSkill = partNumber <= 4 ? "LISTENING" : partNumber <= 7 ? "READING" : "WRITING";
                if (!expectedSkill.equals(section.getSkillType()))
                    add(issues, "SKILL_INVALID", null, "Skill không khớp Part.");
                if (partNumber >= 5 && partNumber <= 7 && blank(part.getContentData().get("content_html")))
                    add(issues, "CONTEXT_REQUIRED", null, "Reading Passage phải được lưu ở cấp Part.");
                if (containsUnverifiedText(part.getContentData()))
                    add(issues, "SOURCE_CONTENT_UNVERIFIED", null, "Nội dung nguồn có ghi chú chưa được xác minh.");
                if (partNumber <= 4 && !validMedia(part.getContentData().get("shared_audio")))
                    add(issues, "AUDIO_REQUIRED", null, "Listening Part thiếu audio hợp lệ.");
                Object rawGroups = part.getContentData().get("question_groups");
                if (!(rawGroups instanceof List<?> groups) || groups.isEmpty()) {
                    add(issues, "STRUCTURE_INVALID", null, "Part thiếu nhóm câu hỏi.");
                    continue;
                }
                if (groups.size() != GROUP_COUNTS[partNumber - 1])
                    add(issues, "GROUP_COUNT_INVALID", null, "Số nhóm trong Part không khớp dữ liệu chuẩn.");
                int actualInPart = 0;
                for (Object rawGroup : groups) {
                    if (!(rawGroup instanceof Map<?, ?> group)) {
                        add(issues, "STRUCTURE_INVALID", null, "Nhóm câu hỏi không hợp lệ.");
                        continue;
                    }
                    groupCount++;
                    String groupId = group.get("group_id") instanceof String value ? value : null;
                    if (groupId == null || groupId.isBlank() || !groupIds.add(groupId))
                        add(issues, "ID_INVALID", null, "Group ID thiếu hoặc trùng.");
                    if (containsUnverifiedText(group))
                        add(issues, "SOURCE_CONTENT_UNVERIFIED", null, "Nội dung nhóm có ghi chú chưa được xác minh.");
                    if (hasImageTag(group))
                        add(issues, "MEDIA_INVALID", null, "Ảnh phải được lưu dưới dạng media có cấu trúc.");
                    Object rawQuestions = group.get("questions");
                    if (!(rawQuestions instanceof List<?> questions) || questions.isEmpty()) {
                        add(issues, "STRUCTURE_INVALID", null, "Nhóm không có câu hỏi.");
                        continue;
                    }
                    if (partNumber == 1 && !validMedia(group.get("shared_media")))
                        add(issues, "IMAGE_REQUIRED", null, "Listening Part 1 cần ảnh cho mỗi nhóm.");
                    for (Object rawQuestion : questions) {
                        if (!(rawQuestion instanceof Map<?, ?> question)) {
                            add(issues, "STRUCTURE_INVALID", null, "Câu hỏi không hợp lệ.");
                            continue;
                        }
                        String id = question.get("question_id") instanceof String value ? value : null;
                        int ordinal = actualInPart + 1;
                        String expectedId = expectedQuestionId(partNumber, ordinal);
                        if (!Objects.equals(expectedId, id) || !questionIds.add(String.valueOf(id)))
                            add(issues, "ID_INVALID", id, "Question ID thiếu, trùng hoặc sai thứ tự.");
                        if (blank(question.get("question_text")))
                            add(issues, "PROMPT_REQUIRED", id, "Thiếu nội dung câu hỏi.");
                        if (containsUnverifiedText(question))
                            add(issues, "SOURCE_CONTENT_UNVERIFIED", id, "Câu hỏi có ghi chú chưa được xác minh.");
                        String type = question.get("type") instanceof String value ? value : "";
                        if (partNumber >= 8) {
                            if (!"ESSAY".equals(type)) add(issues, "QUESTION_TYPE_INVALID", id, "Writing chỉ chấp nhận dạng Essay.");
                            if (partNumber == 8 && !validMedia(question.get("media"))
                                    && !validMedia(group.get("shared_media")))
                                add(issues, "IMAGE_REQUIRED", id, "Writing Task 1 cần bảng hoặc biểu đồ dạng media.");
                        } else if (!OBJECTIVE_TYPES.contains(type)) {
                            add(issues, "QUESTION_TYPE_INVALID", id, "Dạng câu hỏi khách quan không được hỗ trợ.");
                        } else {
                            validateObjective(question, id, issues);
                            collectPairMember(question, groupId, partNumber, id, pairMembers, issues);
                        }
                        actualInPart++;
                    }
                }
                questionsByPart[partNumber - 1] = actualInPart;
                if (actualInPart != QUESTION_COUNTS[partNumber - 1])
                    add(issues, "QUESTION_COUNT_INVALID", null, "Số câu trong Part không khớp dữ liệu chuẩn.");
            }
        }

        if (seenParts.size() != 9 || groupCount != 19 || questionIds.size() != 82)
            add(issues, "STRUCTURE_INVALID", null, "Cần đúng 9 Part, 19 nhóm và 82 câu.");
        validatePairs(pairMembers, issues);
        return List.copyOf(issues);
    }

    private static void validateObjective(Map<?, ?> question, String id, List<Issue> issues) {
        String type = String.valueOf(question.get("type"));
        Object answer = question.get("correct_answer");
        if (blank(answer)) {
            add(issues, "ANSWER_REQUIRED", id, "Câu khách quan chưa có đáp án chuẩn.");
            return;
        }
        if ("TRUE_FALSE_NOT_GIVEN".equals(type)) {
            if (!Set.of("TRUE", "FALSE", "NOT GIVEN").contains(String.valueOf(answer).toUpperCase(Locale.ROOT)))
                add(issues, "ANSWER_INVALID", id, "Token đáp án TFNG không hợp lệ.");
            return;
        }
        if ("YES_NO_NOT_GIVEN".equals(type)) {
            if (!Set.of("YES", "NO", "NOT GIVEN").contains(String.valueOf(answer).toUpperCase(Locale.ROOT)))
                add(issues, "ANSWER_INVALID", id, "Token đáp án YNNG không hợp lệ.");
            return;
        }
        if ("FILL_IN_THE_BLANK".equals(type)) {
            if (!(answer instanceof String) && !(answer instanceof List<?>)) {
                add(issues, "ANSWER_INVALID", id, "Đáp án điền khuyết phải là chuỗi hoặc danh sách thay thế.");
            } else if (answer instanceof String value && value.isBlank()
                    || answer instanceof List<?> values && (values.isEmpty()
                            || values.stream().anyMatch(value -> !(value instanceof String text) || text.isBlank()))) {
                add(issues, "ANSWER_INVALID", id, "Đáp án điền khuyết không được để trống.");
            }
            return;
        }
        if (!(question.get("options") instanceof List<?> options) || options.size() < 2) {
            add(issues, "OPTIONS_REQUIRED", id, "Câu hỏi cần ít nhất hai lựa chọn.");
            return;
        }
        Set<String> optionIds = new HashSet<>();
        for (Object rawOption : options) {
            if (!(rawOption instanceof Map<?, ?> option) || !(option.get("id") instanceof String optionId)
                    || !optionId.matches("[A-H]") || blank(option.get("text")) || !optionIds.add(optionId))
                add(issues, "OPTIONS_INVALID", id, "Options phải có ID A–H duy nhất và nội dung.");
        }
        boolean paired = question.get("answer_group") != null;
        if (paired) {
            if (!(answer instanceof List<?> answers) || answers.size() != 2
                    || new HashSet<>(answers).size() != 2
                    || answers.stream().anyMatch(value -> !(value instanceof String optionId)
                            || !optionIds.contains(optionId)))
                add(issues, "ANSWER_INVALID", id, "Cặp đáp án phải chứa hai option ID khác nhau.");
        } else if (!(answer instanceof String optionId) || !optionIds.contains(optionId)) {
            add(issues, "ANSWER_INVALID", id, "Đáp án không khớp option ID.");
        }
    }

    private static void collectPairMember(Map<?, ?> question, String groupId, int partNumber, String id,
            Map<String, PairMember> members, List<Issue> issues) {
        Object rawGroup = question.get("answer_group");
        if (rawGroup == null) return;
        if (!(rawGroup instanceof Map<?, ?> group) || !(group.get("id") instanceof String pairId)
                || !"DISTINCT_UNORDERED".equals(group.get("mode"))
                || !(group.get("question_ids") instanceof List<?> questionIds)
                || questionIds.size() != 2 || questionIds.stream().anyMatch(value -> !(value instanceof String))) {
            add(issues, "ANSWER_GROUP_INVALID", id, "Metadata cặp đáp án không hợp lệ.");
            return;
        }
        members.put(pairId + ":" + id, new PairMember(pairId, id, partNumber, groupId,
                questionIds.stream().map(String::valueOf).toList(), question.get("correct_answer")));
    }

    private static void validatePairs(Map<String, PairMember> members, List<Issue> issues) {
        Map<String, List<PairMember>> byPair = new HashMap<>();
        members.values().forEach(member -> byPair.computeIfAbsent(member.pairId(), ignored -> new ArrayList<>()).add(member));
        if (byPair.size() != 5 || members.size() != 10) {
            add(issues, "ANSWER_GROUP_INVALID", null, "Cần đủ năm cặp câu hỏi IELTS hai ô.");
            return;
        }
        for (var entry : byPair.entrySet()) {
            List<PairMember> pair = entry.getValue();
            if (pair.size() != 2) {
                add(issues, "ANSWER_GROUP_INVALID", null, "Mỗi cặp phải có đúng hai câu hỏi.");
                continue;
            }
            PairMember first = pair.get(0), second = pair.get(1);
            if (first.partNumber() != second.partNumber() || !Objects.equals(first.groupId(), second.groupId())
                    || !first.questionIds().equals(second.questionIds())
                    || !Set.copyOf(first.questionIds()).equals(Set.of(first.questionId(), second.questionId()))
                    || !(first.answer() instanceof List<?> firstAnswers) || firstAnswers.size() != 2
                    || !Objects.equals(first.answer(), second.answer()) || new HashSet<>(firstAnswers).size() != 2) {
                add(issues, "ANSWER_GROUP_INVALID", first.questionId(), "Hai ô phải cùng nhóm và cùng answer set gồm hai ID khác nhau.");
            }
        }
    }

    private static String expectedQuestionId(int partNumber, int ordinal) {
        if (partNumber <= 4) return "l_%03d".formatted((partNumber - 1) * 10 + ordinal);
        if (partNumber == 5) return "r_%03d".formatted(ordinal);
        if (partNumber == 6) return "r_%03d".formatted(13 + ordinal);
        if (partNumber == 7) return "r_%03d".formatted(26 + ordinal);
        return "w_%03d".formatted(partNumber - 7);
    }

    private static boolean validMedia(Object value) {
        return value instanceof Map<?, ?> media && ExcelV2ExamParser.safeUrl(media.get("url"));
    }

    private static boolean hasImageTag(Object value) {
        return value instanceof String text && text.toLowerCase(Locale.ROOT).contains("<img");
    }

    private static boolean containsUnverifiedText(Object value) {
        if (value instanceof String text) return text.toLowerCase(Locale.ROOT).contains(UNVERIFIED_TEXT_MARKER);
        if (value instanceof Map<?, ?> map) return map.values().stream().anyMatch(IeltsAcademicPublicationValidator::containsUnverifiedText);
        if (value instanceof Iterable<?> values) for (Object item : values) if (containsUnverifiedText(item)) return true;
        return false;
    }

    private static boolean blank(Object value) {
        return value == null || value instanceof String text && text.isBlank();
    }

    private static void add(List<Issue> issues, String code, String questionId, String message) {
        issues.add(new Issue(code, null, null, questionId, message));
    }

    private record PairMember(String pairId, String questionId, int partNumber, String groupId,
            List<String> questionIds, Object answer) {}
}
