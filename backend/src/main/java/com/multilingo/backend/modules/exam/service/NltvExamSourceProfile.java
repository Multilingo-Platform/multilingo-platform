package com.multilingo.backend.modules.exam.service;

import java.util.Map;

/** Source-bound corrections for the supplied NLTV sample workbook. */
public final class NltvExamSourceProfile {
    public static final String SAMPLE_SHA256 =
            "b93b2d2cf13d8139faeabc133c271deec555f12368125e059fb54e9ce167f224";
    public static final String AUDIO_SAMPLE_SHA256 =
            "e155c3b007cd5f51cf5a73f8652e7d7274aa4a4953cf0c552b05c670a3582d13";

    private final boolean sample;
    private final boolean fourAudioSample;

    private NltvExamSourceProfile(boolean sample, boolean fourAudioSample) {
        this.sample = sample;
        this.fourAudioSample = fourAudioSample;
    }

    public static NltvExamSourceProfile forSha256(String sha256) {
        String value = sha256 == null ? "" : sha256;
        boolean current = AUDIO_SAMPLE_SHA256.equalsIgnoreCase(value);
        return new NltvExamSourceProfile(current || SAMPLE_SHA256.equalsIgnoreCase(value), current);
    }

    public boolean isSample() {
        return sample;
    }

    /** Replace only the exact numbered key token found in the source's Part 7 passage. */
    public String maskDictationPassage(String passage, Map<Integer, String> answers) {
        if (!sample) return passage;
        String result = passage;
        for (int number = 1; number <= 10; number++) {
            String answer = answers.get(number);
            if (answer == null || answer.isBlank()) throw new IllegalArgumentException("NLTV source key mismatch.");
            String token = "(" + number + ") " + answer;
            int first = result.indexOf(token);
            if (first < 0 || result.indexOf(token, first + token.length()) >= 0)
                throw new IllegalArgumentException("NLTV source key mismatch.");
            result = result.substring(0, first) + "(" + number + ") ____"
                    + result.substring(first + token.length());
        }
        return result;
    }

    public String partSevenPartInstruction(String instruction) {
        if (!fourAudioSample) return instruction;
        String expected = "Viết chính tả (Điền từ vào chỗ trống trong đoạn văn).";
        if (!expected.equals(instruction)) throw new IllegalArgumentException("NLTV Part 7 source mismatch.");
        return "Chọn từ phù hợp trong danh sách và điền vào chỗ trống trong đoạn văn.";
    }

    public String partSevenGroupInstruction(String instruction) {
        if (!fourAudioSample) return instruction;
        String expectedPrefix = "Nghe đoạn văn và điền từ thích hợp vào các chỗ trống từ 1 đến 10.";
        if (instruction == null || !instruction.startsWith(expectedPrefix))
            throw new IllegalArgumentException("NLTV Part 7 source mismatch.");
        return "Đọc đoạn văn và điền từ thích hợp vào các chỗ trống từ 1 đến 10."
                + instruction.substring(expectedPrefix.length());
    }
}
