package com.multilingo.backend.modules.vocab.service.quiz;

import com.multilingo.backend.modules.vocab.dto.request.VocabTestAnswerItemDto;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Thành phần băm SHA-256 canonical cho payload tiến độ bài thi thử,
 * dùng để nhận diện replay khi mạng lag và phát hiện xung đột phiên bản.
 */
@Component
public class TestProgressHasher {

    public String computeCanonicalHash(int expectedVersion, List<VocabTestAnswerItemDto> answers) {
        String answersPart = "";
        if (answers != null) {
            answersPart = answers.stream()
                    .filter(a -> a.getQuestionNumber() != null)
                    .sorted(Comparator.comparing(VocabTestAnswerItemDto::getQuestionNumber))
                    .map(a -> a.getQuestionNumber() + ":"
                            + (a.getSelectedKey() != null ? a.getSelectedKey().trim() : "") + ":"
                            + (Boolean.TRUE.equals(a.getFlagged()) ? "1" : "0"))
                    .collect(Collectors.joining(","));
        }
        String canonical = expectedVersion + "|" + answersPart;
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
