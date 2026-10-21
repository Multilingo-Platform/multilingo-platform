package com.multilingo.backend.modules.exam.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import com.multilingo.backend.modules.exam.dto.response.ExamImportPreviewResponse.Issue;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Structural validation for language-practice exams; deliberately has no certificate-specific counts. */
public final class LanguagePracticePublicationValidator {
    private static final Set<String> SKILLS = Set.of("LISTENING", "READING", "WRITING");
    private static final Set<String> CHOICE_TYPES = Set.of("SINGLE_CHOICE", "MULTIPLE_CHOICE");
    private static final Set<String> ESSAY_TYPES = Set.of("ESSAY");
    private static final Set<String> ALL_CANONICAL_TYPES = Set.of(
            "SINGLE_CHOICE", "MULTIPLE_CHOICE", "FILL_IN_THE_BLANK",
            "TRUE_FALSE_NOT_GIVEN", "YES_NO_NOT_GIVEN", "MATCHING_FEATURES",
            "MATCHING_INFORMATION", "ESSAY"
    );

    private final LearningLanguageCatalog languages;

    public LanguagePracticePublicationValidator() {
        this(new LearningLanguageCatalog());
    }

    public LanguagePracticePublicationValidator(LearningLanguageCatalog languages) {
        this.languages = languages;
    }

    public List<Issue> issues(ExamBuilderRequest request) {
        List<Issue> issues = new ArrayList<>();
        if (request == null || !"LANGUAGE_PRACTICE".equals(request.getType())) {
            add(issues, "TYPE_INVALID", null, "Loại đề luyện ngôn ngữ không hợp lệ.");
            return List.copyOf(issues);
        }
        if (languages.findNormalized(request.getExamLanguage()).isEmpty()) {
            add(issues, "LANGUAGE_INVALID", null, "Ngôn ngữ đề không được hỗ trợ.");
        }
        if (request.getSections() == null || request.getSections().isEmpty()) {
            add(issues, "STRUCTURE_INVALID", null, "Đề cần ít nhất một section.");
            return List.copyOf(issues);
        }

        Set<String> questionIds = new HashSet<>();
        Set<String> groupIds = new HashSet<>();
        for (var section : request.getSections()) {
            if (section == null) {
                add(issues, "STRUCTURE_INVALID", null, "Section không hợp lệ.");
                continue;
            }
            if (!SKILLS.contains(upper(section.getSkillType()))) {
                add(issues, "SKILL_INVALID", null, "Skill phải là Listening, Reading hoặc Writing.");
            }
            if (section.getDurationMinutes() == null || section.getDurationMinutes() < 1) {
                add(issues, "DURATION_INVALID", null, "Thời lượng section phải là số phút dương.");
            }
            if (section.getParts() == null || section.getParts().isEmpty()) {
                add(issues, "STRUCTURE_INVALID", null, "Section cần ít nhất một part.");
                continue;
            }
            Set<Integer> partNumbers = new HashSet<>();
            for (var part : section.getParts()) {
                if (part == null || part.getPartNumber() == null || part.getPartNumber() < 1
                        || !partNumbers.add(part.getPartNumber()) || part.getContentData() == null) {
                    add(issues, "STRUCTURE_INVALID", null, "Part cần số dương duy nhất và content data.");
                    continue;
                }
                Object rawGroups = part.getContentData().get("question_groups");
                if (!(rawGroups instanceof List<?> groups) || groups.isEmpty()) {
                    add(issues, "STRUCTURE_INVALID", null, "Part cần ít nhất một nhóm câu hỏi.");
                    continue;
                }
                for (Object rawGroup : groups) {
                    if (!(rawGroup instanceof Map<?, ?> group)) {
                        add(issues, "STRUCTURE_INVALID", null, "Question group không hợp lệ.");
                        continue;
                    }
                    Object rawGroupId = group.get("group_id");
                    if (!(rawGroupId instanceof String groupId) || groupId.isBlank() || !groupIds.add(groupId)) {
                        add(issues, "ID_INVALID", null, "Group ID thiếu hoặc trùng.");
                    }
                    if (!(group.get("questions") instanceof List<?> questions) || questions.isEmpty()) {
                        add(issues, "STRUCTURE_INVALID", null, "Question group cần có câu hỏi.");
                        continue;
                    }
                    for (Object rawQuestion : questions) {
                        validateQuestion(rawQuestion, questionIds, issues);
                    }
                }
            }
        }
        return List.copyOf(issues);
    }

    public void requireStructure(ExamBuilderRequest request) {
        Set<String> structural = Set.of("TYPE_INVALID", "LANGUAGE_INVALID", "STRUCTURE_INVALID", "ID_INVALID",
                "SKILL_INVALID", "DURATION_INVALID");
        if (issues(request).stream().anyMatch(issue -> structural.contains(issue.code()))) {
            throw new AppException(ErrorCode.VALIDATION_FAILED,
                    "Cấu trúc đề luyện ngôn ngữ không hợp lệ; kiểm tra ngôn ngữ, section, part và câu hỏi.");
        }
    }

    public void requirePublishable(ExamBuilderRequest request) {
        if (!issues(request).isEmpty()) {
            throw new AppException(ErrorCode.VALIDATION_FAILED,
                    "Đề luyện ngôn ngữ chưa đạt điều kiện xuất bản; kiểm tra câu hỏi, lựa chọn và đáp án.");
        }
    }

    private static void validateQuestion(Object raw, Set<String> ids, List<Issue> issues) {
        if (!(raw instanceof Map<?, ?> question)) {
            add(issues, "STRUCTURE_INVALID", null, "Question không hợp lệ.");
            return;
        }
        Object rawId = question.get("question_id");
        String id = rawId instanceof String value ? value : null;
        if (id == null || id.isBlank() || !ids.add(id)) add(issues, "ID_INVALID", id, "Question ID thiếu hoặc trùng.");
        if (!(question.get("question_text") instanceof String prompt) || prompt.isBlank()) {
            add(issues, "PROMPT_REQUIRED", id, "Question text không được để trống.");
        }
        Object rawType = question.get("type");
        if (!(rawType instanceof String type) || !ALL_CANONICAL_TYPES.contains(type)) {
            add(issues, "TYPE_INVALID", id, "Question type không hợp lệ hoặc chưa chuẩn hóa canonical: " + rawType);
            return;
        }
        if (CHOICE_TYPES.contains(type)) {
            validateChoice(question, id, issues);
        } else if ("FILL_IN_THE_BLANK".equals(type)) {
            validateFillInTheBlank(question, id, issues);
        } else if ("TRUE_FALSE_NOT_GIVEN".equals(type) || "YES_NO_NOT_GIVEN".equals(type)) {
            validateTfngOrYnng(question, type, id, issues);
        } else if ("MATCHING_FEATURES".equals(type) || "MATCHING_INFORMATION".equals(type)) {
            validateMatching(question, id, issues);
        } else if (!ESSAY_TYPES.contains(type)) {
            add(issues, "TYPE_INVALID", id, "Question type không được hỗ trợ.");
        }
    }

    private static void validateFillInTheBlank(Map<?, ?> question, String id, List<Issue> issues) {
        Object answer = question.get("correct_answer");
        if (answer instanceof String value) {
            if (value.isBlank()) {
                add(issues, "ANSWER_INVALID", id, "Đáp án điền khuyết không được để trống.");
            }
        } else if (answer instanceof List<?> values && !values.isEmpty()) {
            if (values.stream().anyMatch(value -> !(value instanceof String string) || string.isBlank())) {
                add(issues, "ANSWER_INVALID", id, "Đáp án điền khuyết không được chứa phần tử trống.");
            }
        } else {
            add(issues, "ANSWER_INVALID", id, "Thiếu đáp án chuẩn dạng chuỗi hoặc danh sách không rỗng.");
        }
    }

    private static void validateTfngOrYnng(Map<?, ?> question, String type, String id, List<Issue> issues) {
        Object answer = question.get("correct_answer");
        if (answer instanceof String value) {
            String token = value.trim().toUpperCase(java.util.Locale.ROOT);
            Set<String> allowed = "TRUE_FALSE_NOT_GIVEN".equals(type)
                    ? Set.of("TRUE", "FALSE", "NOT GIVEN", "NOT_GIVEN")
                    : Set.of("YES", "NO", "NOT GIVEN", "NOT_GIVEN");
            if (!allowed.contains(token)) {
                add(issues, "ANSWER_INVALID", id, "Token đáp án không hợp lệ.");
            }
        } else {
            add(issues, "ANSWER_INVALID", id, "Thiếu đáp án chuẩn.");
        }
    }

    private static void validateMatching(Map<?, ?> question, String id, List<Issue> issues) {
        validateChoice(question, id, issues);
    }

    private static void validateChoice(Map<?, ?> question, String id, List<Issue> issues) {
        if (!(question.get("options") instanceof List<?> options) || options.size() < 2) {
            add(issues, "OPTIONS_INVALID", id, "Câu chọn đáp án cần ít nhất hai lựa chọn.");
            return;
        }
        Set<String> optionIds = new HashSet<>();
        for (Object rawOption : options) {
            if (!(rawOption instanceof Map<?, ?> option) || !(option.get("id") instanceof String optionId)
                    || optionId.isBlank() || !optionIds.add(optionId)
                    || !(option.get("text") instanceof String)) {
                add(issues, "OPTIONS_INVALID", id, "Lựa chọn cần ID duy nhất và nội dung dạng text.");
                return;
            }
        }
        Object answer = question.get("correct_answer");
        if (answer instanceof String answerId) {
            if (!optionIds.contains(answerId)) add(issues, "ANSWER_INVALID", id, "Đáp án không thuộc lựa chọn.");
        } else if (answer instanceof List<?> answers && !answers.isEmpty()) {
            if (answers.stream().anyMatch(value -> !(value instanceof String string) || !optionIds.contains(string))) {
                add(issues, "ANSWER_INVALID", id, "Đáp án không thuộc lựa chọn.");
            }
        } else {
            add(issues, "ANSWER_INVALID", id, "Thiếu đáp án chuẩn.");
        }
    }

    private static String upper(Object value) {
        return value instanceof String string ? string.trim().toUpperCase(java.util.Locale.ROOT) : "";
    }

    private static void add(List<Issue> issues, String code, String questionId, String message) {
        issues.add(new Issue(code, null, null, questionId, message));
    }
}
