package com.multilingo.backend.modules.vocab.service.quiz;

import com.multilingo.backend.modules.vocab.dto.request.SubmitPracticeAnswerDto;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.stream.Collectors;

@Component
public class PracticePayloadHasher {

    public String computeCanonicalHash(String sessionId, Integer durationSeconds, List<SubmitPracticeAnswerDto> answers) {
        int duration = durationSeconds != null ? durationSeconds : 0;
        String answersPart = "";
        if (answers != null) {
            answersPart = answers.stream()
                    .sorted(Comparator.comparing(SubmitPracticeAnswerDto::getQuestionId))
                    .map(a -> a.getQuestionId() + ":" + (a.getSelectedOptionId() != null ? a.getSelectedOptionId().trim() : ""))
                    .collect(Collectors.joining(","));
        }
        String canonical = sessionId + "|" + duration + "|" + answersPart;
        return computeSha256(canonical);
    }

    public String computeSha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] encodedhash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(encodedhash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("Thuật toán SHA-256 không khả dụng trong môi trường runtime", e);
        }
    }
}
