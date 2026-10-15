package com.multilingo.backend.modules.testing.adapter.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.entity.ExamPart;
import com.multilingo.backend.modules.exam.entity.ExamSection;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamSectionRepository;
import com.multilingo.backend.modules.testing.adapter.ExamAdapter;
import com.multilingo.backend.modules.testing.adapter.dto.ExamFixture;
import com.multilingo.backend.modules.testing.adapter.dto.PartFixture;
import com.multilingo.backend.modules.testing.adapter.dto.SectionFixture;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@Primary
@RequiredArgsConstructor
public class DbExamAdapter implements ExamAdapter {

    private static final Set<String> PRIVATE_GRADING_FIELDS = Set.of(
            "correct_answer",
            "explanation",
            "ai_prompt_context",
            "ai_feedback",
            "grading_key",
            "grading_keys",
            "is_correct_flags",
            "earned_score",
            "skill_stats"
    );

    private static final Set<String> SNAPSHOT_PRIVATE_FIELDS = Set.of(
            "ai_prompt_context",
            "ai_feedback",
            "grading_key",
            "grading_keys",
            "is_correct_flags",
            "earned_score",
            "skill_stats"
    );

    private final ExamRepository examRepository;
    private final ExamSectionRepository examSectionRepository;
    private final ExamPartRepository examPartRepository;
    private final ObjectMapper objectMapper;

    @Override
    public Optional<ExamFixture> findById(Integer examId) {
        return examRepository.findById(examId).map(exam -> mapToFixture(exam, false));
    }

    @Override
    public Optional<ExamFixture> findSnapshotById(Integer examId) {
        return examRepository.findById(examId).map(exam -> mapToFixture(exam, true));
    }

    @Override
    public Optional<ExamFixture> findPublishedSnapshotById(Integer examId) {
        return examRepository.findById(examId)
                .filter(exam -> Boolean.TRUE.equals(exam.getIsPublished()))
                .map(exam -> mapToFixture(exam, true));
    }

    @SuppressWarnings("unchecked")
    private ExamFixture mapToFixture(Exam exam, boolean forSnapshot) {
        ExamFixture fixture = new ExamFixture();
        fixture.setId(exam.getId());
        fixture.setTitle(exam.getTitle());
        fixture.setDurationMinutes(exam.getDurationMinutes());
        fixture.setUpdatedAt(exam.getUpdatedAt());
        fixture.setExamLanguage(exam.getExamLanguage());

        List<ExamSection> entitySections = examSectionRepository.findByExam_Id(exam.getId());

        List<SectionFixture> sections = entitySections.stream()
                .sorted(Comparator.comparing(ExamSection::getOrderIndex, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(ExamSection::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(section -> {
                    SectionFixture sFixture = new SectionFixture();
                    sFixture.setId(section.getId());
                    sFixture.setName(section.getSkillType());
                    sFixture.setDurationMinutes(section.getDurationMinutes());

                    List<ExamPart> entityParts = new ArrayList<>(
                            examPartRepository.findBySection_Id(section.getId()));
                    entityParts.sort(Comparator
                            .comparing(ExamPart::getPartNumber, Comparator.nullsLast(Comparator.naturalOrder()))
                            .thenComparing(ExamPart::getId, Comparator.nullsLast(Comparator.naturalOrder())));

                    List<PartFixture> parts = entityParts.stream()
                            .map(part -> {
                                PartFixture pFixture = new PartFixture();
                                pFixture.setId(part.getId());
                                pFixture.setPartNumber(part.getPartNumber());
                                
                                Map<String, Object> data = part.getContentData();
                                if (data != null) {
                                    Map<String, Object> safeData = (Map<String, Object>) sanitize(
                                            data, forSnapshot ? SNAPSHOT_PRIVATE_FIELDS : PRIVATE_GRADING_FIELDS);
                                    Object partTitle = safeData.get("part_title");
                                    if (partTitle == null) {
                                        partTitle = safeData.get("title");
                                    }
                                    if (partTitle != null) {
                                        pFixture.setTitle(partTitle.toString());
                                    }
                                    if (safeData.get("part_title") != null) {
                                        pFixture.setPartTitle(safeData.get("part_title").toString());
                                    }
                                    if (safeData.get("instruction") != null) {
                                        pFixture.setInstruction(safeData.get("instruction").toString());
                                    }
                                    if (safeData.get("content_html") != null) {
                                        pFixture.setContentHtml(safeData.get("content_html").toString());
                                    } else if (safeData.get("contentHtml") != null) {
                                        pFixture.setContentHtml(safeData.get("contentHtml").toString());
                                    }
                                    pFixture.setSharedAudio(asMap(safeData.get("shared_audio")));
                                    pFixture.setSharedMedia(asMap(safeData.get("shared_media")));

                                    List<Object> questions = new ArrayList<>();
                                    List<Object> questionGroups;
                                    if (safeData.containsKey("question_groups")) {
                                        questionGroups = requireQuestionGroups(safeData.get("question_groups"));
                                        pFixture.setQuestionGroups(questionGroups);
                                        for (Object group : questionGroups) {
                                            Map<String, Object> groupMap = requireMap(group, "question group");
                                            List<Object> groupQuestions = requireQuestions(groupMap.get("questions"));
                                            Object groupOptions = groupMap.get("options");
                                            List<Object> updatedGroupQuestions = new ArrayList<>();
                                            for (Object rawQ : groupQuestions) {
                                                if (rawQ instanceof Map<?, ?> qMapRaw) {
                                                    Map<String, Object> qMap = new LinkedHashMap<>((Map<String, Object>) qMapRaw);
                                                    if (groupOptions != null && !qMap.containsKey("options")) {
                                                        qMap.put("options", groupOptions);
                                                    }
                                                    questions.add(qMap);
                                                    updatedGroupQuestions.add(qMap);
                                                } else {
                                                    questions.add(rawQ);
                                                    updatedGroupQuestions.add(rawQ);
                                                }
                                            }
                                            groupMap.put("questions", updatedGroupQuestions);
                                        }
                                    } else {
                                        List<Object> legacyQuestions = asList(safeData.get("questions"));
                                        if (legacyQuestions != null) {
                                            questions.addAll(legacyQuestions);
                                        }
                                    }
                                    pFixture.setQuestions(questions);
                                }
                                return pFixture;
                            })
                            .collect(Collectors.toList());

                    sFixture.setParts(parts);
                    return sFixture;
                })
                .collect(Collectors.toList());

        fixture.setSections(sections);
        return fixture;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        return value instanceof Map<?, ?> ? (Map<String, Object>) value : null;
    }

    private List<Object> asList(Object value) {
        return value instanceof List<?> list ? new ArrayList<>(list) : null;
    }

    private List<Object> requireQuestionGroups(Object value) {
        if (!(value instanceof List<?> groups) || groups.isEmpty()) {
            throw new IllegalArgumentException("question_groups must be a non-empty array");
        }
        return new ArrayList<>(groups);
    }

    private List<Object> requireQuestions(Object value) {
        if (!(value instanceof List<?> questions) || questions.isEmpty()) {
            throw new IllegalArgumentException("question group questions must be a non-empty array");
        }
        for (Object question : questions) {
            if (!(question instanceof Map<?, ?>)) {
                throw new IllegalArgumentException("question group questions must contain objects");
            }
        }
        return new ArrayList<>(questions);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> requireMap(Object value, String fieldName) {
        if (!(value instanceof Map<?, ?>)) {
            throw new IllegalArgumentException(fieldName + " must be an object");
        }
        return (Map<String, Object>) value;
    }

    private Object sanitize(Object value, Set<String> blacklistedFields) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> sanitized = new LinkedHashMap<>();
            map.forEach((key, nestedValue) -> {
                String fieldName = String.valueOf(key);
                if (!blacklistedFields.contains(fieldName)) {
                    sanitized.put(fieldName, sanitize(nestedValue, blacklistedFields));
                }
            });
            return sanitized;
        }

        if (value instanceof List<?> list) {
            return list.stream()
                    .map(nestedValue -> sanitize(nestedValue, blacklistedFields))
                    .toList();
        }

        return value;
    }
}
