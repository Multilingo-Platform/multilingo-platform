package com.multilingo.backend.modules.exam.service;

import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import com.multilingo.backend.modules.exam.dto.request.PartBuilderRequest;
import com.multilingo.backend.modules.exam.dto.request.SectionBuilderRequest;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class OfficialExamTestData {
    private static final int[] IELTS_PART_COUNTS = {10, 10, 10, 10, 13, 13, 14, 1, 1};
    private static final int[] IELTS_GROUP_COUNTS = {1, 3, 4, 1, 2, 3, 3, 1, 1};

    private OfficialExamTestData() {}

    static ExamBuilderRequest ieltsRequest() {
        List<SectionBuilderRequest> sections = new ArrayList<>();
        sections.add(section("LISTENING", 30, 1, 4));
        sections.add(section("READING", 60, 5, 7));
        sections.add(section("WRITING", 60, 8, 9));
        return ExamBuilderRequest.builder().title("Cambridge Ielts 20 Test 1").type("IELTS_ACADEMIC")
                .examLanguage("en").isPublished(false).sections(sections).build();
    }

    static List<Map<String, Object>> questions(ExamBuilderRequest request) {
        List<Map<String, Object>> questions = new ArrayList<>();
        for (SectionBuilderRequest section : request.getSections()) {
            for (PartBuilderRequest part : section.getParts()) {
                Object rawGroups = part.getContentData().get("question_groups");
                if (!(rawGroups instanceof List<?> groups)) continue;
                for (Object rawGroup : groups) {
                    if (!(rawGroup instanceof Map<?, ?> group) || !(group.get("questions") instanceof List<?> items)) continue;
                    for (Object rawQuestion : items) if (rawQuestion instanceof Map<?, ?> question)
                        questions.add(cast(question));
                }
            }
        }
        return questions;
    }

    private static SectionBuilderRequest section(String skill, int duration, int firstPart, int lastPart) {
        List<PartBuilderRequest> parts = new ArrayList<>();
        for (int partNumber = firstPart; partNumber <= lastPart; partNumber++) parts.add(part(partNumber));
        return SectionBuilderRequest.builder().skillType(skill).durationMinutes(duration).parts(parts).build();
    }

    private static PartBuilderRequest part(int partNumber) {
        List<Map<String, Object>> questions = new ArrayList<>();
        for (int ordinal = 1; ordinal <= IELTS_PART_COUNTS[partNumber - 1]; ordinal++)
            questions.add(question(partNumber, ordinal));

        int groupCount = IELTS_GROUP_COUNTS[partNumber - 1];
        List<List<Map<String, Object>>> groups = new ArrayList<>();
        for (int index = 0; index < groupCount; index++) groups.add(new ArrayList<>());
        List<List<Map<String, Object>>> units = new ArrayList<>();
        for (int index = 0; index < questions.size();) {
            Map<String, Object> question = questions.get(index);
            List<Map<String, Object>> answerUnit = new ArrayList<>();
            answerUnit.add(question);
            if (question.containsKey("answer_group") && index + 1 < questions.size()) answerUnit.add(questions.get(index + 1));
            units.add(answerUnit);
            index += answerUnit.size();
        }
        for (int unit = 0; unit < units.size(); unit++)
            groups.get(Math.min(unit * groupCount / units.size(), groupCount - 1)).addAll(units.get(unit));

        List<Map<String, Object>> questionGroups = new ArrayList<>();
        for (int index = 0; index < groups.size(); index++) {
            Map<String, Object> group = new LinkedHashMap<>();
            group.put("group_id", "ielts-p" + partNumber + "-g" + (index + 1));
            group.put("instruction", "Select your answer.");
            group.put("questions", groups.get(index));
            if (partNumber == 1 || partNumber == 8) group.put("shared_media", image("image" + partNumber + "-" + index));
            questionGroups.add(group);
        }

        Map<String, Object> content = new LinkedHashMap<>();
        content.put("part_title", "Part " + partNumber);
        content.put("instruction", "Complete this part.");
        content.put("question_groups", questionGroups);
        if (partNumber >= 5 && partNumber <= 7) content.put("content_html", "Verified passage " + partNumber);
        if (partNumber <= 4) content.put("shared_audio", Map.of("url", "https://media.example.test/audio" + partNumber + ".mp3"));
        return PartBuilderRequest.builder().partNumber(partNumber).contentData(content).build();
    }

    private static Map<String, Object> question(int partNumber, int ordinal) {
        String id = switch (partNumber) {
            case 1, 2, 3, 4 -> "l_%03d".formatted((partNumber - 1) * 10 + ordinal);
            case 5 -> "r_%03d".formatted(ordinal);
            case 6 -> "r_%03d".formatted(13 + ordinal);
            case 7 -> "r_%03d".formatted(26 + ordinal);
            case 8, 9 -> "w_%03d".formatted(partNumber - 7);
            default -> throw new IllegalArgumentException("Invalid IELTS part");
        };
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("question_id", id);
        question.put("question_text", "Prompt " + id);
        question.put("type", partNumber >= 8 ? "ESSAY" : "SINGLE_CHOICE");
        question.put("explanation", "");
        if (partNumber < 8) {
            question.put("options", List.of("A", "B", "C", "D", "E").stream()
                    .map(option -> Map.<String, Object>of("id", option, "text", "Option " + option)).toList());
            question.put("correct_answer", "A");
            int globalNumber = partNumber <= 4 ? (partNumber - 1) * 10 + ordinal : -1;
            if (globalNumber == 17 || globalNumber == 19 || globalNumber == 21 || globalNumber == 23 || globalNumber == 25) {
                List<String> pairIds = List.of("l_%03d".formatted(globalNumber), "l_%03d".formatted(globalNumber + 1));
                Map<String, Object> answerGroup = Map.of("id", "listening-" + globalNumber + "-" + (globalNumber + 1),
                        "mode", "DISTINCT_UNORDERED", "question_ids", pairIds);
                question.put("answer_group", answerGroup);
                question.put("correct_answer", List.of("A", "E"));
            } else if (globalNumber == 18 || globalNumber == 20 || globalNumber == 22 || globalNumber == 24 || globalNumber == 26) {
                int first = globalNumber - 1;
                question.put("answer_group", Map.of("id", "listening-" + first + "-" + globalNumber,
                        "mode", "DISTINCT_UNORDERED", "question_ids", List.of("l_%03d".formatted(first), id)));
                question.put("correct_answer", List.of("A", "E"));
            }
        } else if (partNumber == 8) {
            question.put("question_text", "Describe the visual information.");
        } else {
            question.put("question_text", "Write an essay.");
        }
        return question;
    }

    private static Map<String, Object> image(String name) {
        return Map.of("type", "image", "url", "https://media.example.test/" + name + ".png");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> cast(Map<?, ?> input) {
        return (Map<String, Object>) input;
    }
}
