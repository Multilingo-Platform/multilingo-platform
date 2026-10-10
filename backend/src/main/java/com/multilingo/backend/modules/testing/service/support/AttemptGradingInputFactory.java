package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.grading.dto.GradingKey;
import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;
import com.multilingo.backend.modules.testing.util.AttemptResultScope;
import lombok.Builder;
import lombok.Value;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class AttemptGradingInputFactory {

    @Value
    @Builder
    public static class GradingInput {
        List<AttemptAnswer> answers;
        Map<Integer, PartGradingKey> partKeys;
        List<AttemptResultScope.ScopedPart> scopedParts;
    }

    public GradingInput prepare(
            Map<String, Object> snapshot,
            List<AttemptAnswer> savedAnswers,
            Map<Integer, PartGradingKey> loadedKeys) {

        List<AttemptResultScope.ScopedPart> scopedParts = AttemptResultScope.read(snapshot);

        Map<Integer, AttemptAnswer> savedByPartId = new HashMap<>();
        if (savedAnswers != null) {
            for (AttemptAnswer ans : savedAnswers) {
                if (ans != null && ans.getPartId() != null) {
                    savedByPartId.put(ans.getPartId(), ans);
                }
            }
        }

        List<AttemptAnswer> inputAnswers = new ArrayList<>();
        Map<Integer, PartGradingKey> scopedKeys = new LinkedHashMap<>();

        for (AttemptResultScope.ScopedPart sp : scopedParts) {
            Integer partId = sp.getPartId();

            if (savedByPartId.containsKey(partId)) {
                inputAnswers.add(savedByPartId.get(partId));
            } else {
                // Transient unattempted answer: empty user answers, no DB ID
                AttemptAnswer transientAnswer = AttemptAnswer.builder()
                        .partId(partId)
                        .userAnswers(Collections.emptyMap())
                        .build();
                inputAnswers.add(transientAnswer);
            }

            List<AttemptResultScope.ScopedQuestion> objQuestions = sp.getQuestions().stream()
                    .filter(AttemptResultScope.ScopedQuestion::isObjective)
                    .toList();

            if (objQuestions.isEmpty()) {
                // Writing-only part: does not require objective key
                continue;
            }

            PartGradingKey loadedPgk = loadedKeys != null ? loadedKeys.get(partId) : null;
            if (loadedPgk == null) {
                throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Missing grading key for part: " + partId);
            }

            PartGradingKey copiedPgk = new PartGradingKey();
            copiedPgk.setPartId(partId);
            copiedPgk.setSectionName(sp.getSkill());

            Map<String, GradingKey> loadedAnswers = loadedPgk.getAnswers() != null
                    ? loadedPgk.getAnswers()
                    : Collections.emptyMap();

            Map<String, GradingKey> copiedAnswers = new LinkedHashMap<>();

            for (AttemptResultScope.ScopedQuestion q : objQuestions) {
                GradingKey key = loadedAnswers.get(q.getQuestionId());
                if (key == null) {
                    throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                            "Missing grading key for question: " + q.getQuestionId() + " in part: " + partId);
                }
                if (key.getType() == null || !key.getType().equalsIgnoreCase(q.getType())) {
                    throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                            "Question type mismatch for " + q.getQuestionId() + " in part " + partId
                                    + ": expected " + q.getType() + " but got " + key.getType());
                }

                GradingKey copiedKey = new GradingKey();
                copiedKey.setQuestionId(key.getQuestionId());
                copiedKey.setType(key.getType());
                copiedKey.setCorrect(key.getCorrect());
                copiedKey.setAlternates(key.getAlternates() != null ? new ArrayList<>(key.getAlternates()) : null);
                copiedAnswers.put(q.getQuestionId(), copiedKey);
            }

            copiedPgk.setAnswers(copiedAnswers);
            scopedKeys.put(partId, copiedPgk);
        }

        return GradingInput.builder()
                .answers(Collections.unmodifiableList(inputAnswers))
                .partKeys(Collections.unmodifiableMap(scopedKeys))
                .scopedParts(scopedParts)
                .build();
    }
}
