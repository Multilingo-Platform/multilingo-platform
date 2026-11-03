package com.multilingo.backend.modules.testing.grading;

import com.multilingo.backend.modules.testing.dto.response.ResultSummaryResponse.CertificateScore;
import com.multilingo.backend.modules.testing.dto.response.ResultSummaryResponse.CertificateSkillScore;
import com.multilingo.backend.modules.testing.dto.response.ResultSummaryResponse.SkillObjectiveStats;
import com.multilingo.backend.modules.testing.dto.response.ResultSummaryResponse.WritingTaskSummary;
import com.multilingo.backend.modules.testing.util.CertificateExamPolicy;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/** Deterministic, versioned practice estimates kept separate from objective raw grading. */
public final class CertificateScoreProjector {
    public static final String POLICY_VERSION = "CERTIFICATE_SCORE_V1";

    private static final BandRange[] LISTENING = ranges(
            4.0, 10, 12, 4.5, 13, 15, 5.0, 16, 17, 5.5, 18, 22,
            6.0, 23, 25, 6.5, 26, 29, 7.0, 30, 31, 7.5, 32, 34,
            8.0, 35, 36, 8.5, 37, 38, 9.0, 39, 40);
    private static final BandRange[] READING_ACADEMIC = ranges(
            4.0, 10, 12, 4.5, 13, 14, 5.0, 15, 18, 5.5, 19, 22,
            6.0, 23, 26, 6.5, 27, 29, 7.0, 30, 32, 7.5, 33, 34,
            8.0, 35, 36, 8.5, 37, 38, 9.0, 39, 40);
    private static final BandRange[] READING_GENERAL = ranges(
            4.0, 15, 18, 4.5, 19, 22, 5.0, 23, 26, 5.5, 27, 29,
            6.0, 30, 31, 6.5, 32, 33, 7.0, 34, 35, 7.5, 36, 36,
            8.0, 37, 38, 8.5, 39, 39, 9.0, 40, 40);

    private static final int[] TOEIC_RAW = {0, 6, 20, 30, 40, 50, 60, 70, 80, 90, 93, 95, 97, 100};
    private static final BigDecimal[] TOEIC_LISTENING = decimals(5, 5, 60, 110, 167.5, 237.5, 302.5, 367.5, 427.5, 482.5, 495, 495, 495, 495);
    private static final BigDecimal[] TOEIC_READING = decimals(5, 5, 45, 90, 142.5, 202.5, 262.5, 332.5, 392.5, 452.5, 470, 485, 490, 495);

    public enum ToeicSkill { LISTENING, READING }

    public Optional<CertificateScore> project(String examType, List<SkillObjectiveStats> objectiveSkills,
                                               List<WritingTaskSummary> writingTasks) {
        String unit = CertificateExamPolicy.scoreUnit(examType);
        if ("RAW_OBJECTIVE".equals(unit)) return Optional.empty();
        Map<String, SkillObjectiveStats> objective = new LinkedHashMap<>();
        if (objectiveSkills != null) {
            for (SkillObjectiveStats skill : objectiveSkills) {
                if (skill != null && skill.getSkill() != null) objective.put(normalizeSkill(skill.getSkill()), skill);
            }
        }
        Map<String, CertificateSkillScore> scores = new LinkedHashMap<>();
        BigDecimal overall = null;
        String overallDisplay;
        String overallReason;
        String status;
        if ("TOEIC_SCALED".equals(unit)) {
            CertificateSkillScore listening = toeicSkill(objective.get("LISTENING"), ToeicSkill.LISTENING);
            CertificateSkillScore reading = toeicSkill(objective.get("READING"), ToeicSkill.READING);
            scores.put("LISTENING", listening);
            scores.put("READING", reading);
            if (listening.getScore() != null && reading.getScore() != null) {
                overall = listening.getScore().add(reading.getScore());
                overallDisplay = overall.stripTrailingZeros().toPlainString();
                overallReason = null;
                status = "COMPLETE";
            } else {
                overallDisplay = "Chưa đủ cả Listening và Reading";
                overallReason = "TOEIC_REQUIRES_COMPLETE_LISTENING_AND_READING";
                status = "PARTIAL";
            }
        } else {
            boolean general = CertificateExamPolicy.isGeneralTraining(examType);
            CertificateSkillScore listening = ieltsSkill(objective.get("LISTENING"), "LISTENING", false);
            CertificateSkillScore reading = ieltsSkill(objective.get("READING"), "READING", general);
            CertificateSkillScore writing = ieltsWritingSkill(writingTasks);
            scores.put("LISTENING", listening);
            scores.put("READING", reading);
            scores.put("WRITING", writing);
            if (listening.getScore() != null && reading.getScore() != null && writing.getScore() != null
                    && objective.containsKey("SPEAKING")) {
                CertificateSkillScore speaking = ieltsSkill(objective.get("SPEAKING"), "SPEAKING", false);
                scores.put("SPEAKING", speaking);
                if (speaking.getScore() != null) {
                    overall = listening.getScore().add(reading.getScore()).add(writing.getScore()).add(speaking.getScore())
                            .divide(BigDecimal.valueOf(4), 4, RoundingMode.HALF_UP);
                    overall = roundIeltsBand(overall);
                }
            }
            if (overall != null) {
                overallDisplay = overall.setScale(1).toPlainString();
                overallReason = null;
                status = "COMPLETE";
            } else {
                overallDisplay = "Chưa đủ 4 kỹ năng";
                overallReason = missingIeltsReason(scores);
                status = scores.values().stream().anyMatch(s -> s.getScore() != null) ? "PARTIAL" : "UNAVAILABLE";
            }
        }
        return Optional.of(CertificateScore.builder()
                .policyVersion(POLICY_VERSION)
                .scoreUnit(unit)
                .status(status)
                .skillScores(scores)
                .overallScore(overall)
                .overallDisplay(overallDisplay)
                .unavailableReasonCode(overallReason)
                .build());
    }

    public static Optional<BigDecimal> ieltsListeningBand(int correct, int total) {
        return band(correct, total, LISTENING);
    }

    public static Optional<BigDecimal> ieltsReadingBand(int correct, int total, boolean generalTraining) {
        return band(correct, total, generalTraining ? READING_GENERAL : READING_ACADEMIC);
    }

    private static Optional<BigDecimal> band(int correct, int total, BandRange[] ranges) {
        if (total != 40 || correct < 0 || correct > total) return Optional.empty();
        for (BandRange range : ranges) {
            if (correct >= range.minimum() && correct <= range.maximum()) return Optional.of(range.band());
        }
        return Optional.empty();
    }

    public static BigDecimal roundIeltsBand(BigDecimal score) {
        if (score == null || score.signum() < 0 || score.compareTo(BigDecimal.valueOf(9)) > 0) {
            throw new IllegalArgumentException("IELTS band must be between 0 and 9");
        }
        return score.multiply(BigDecimal.valueOf(2)).setScale(0, RoundingMode.HALF_UP)
                .divide(BigDecimal.valueOf(2), 1, RoundingMode.UNNECESSARY);
    }

    public static Optional<BigDecimal> toeicScaledScore(int correct, int total, ToeicSkill skill) {
        if (skill == null || total != 100 || correct < 0 || correct > total) return Optional.empty();
        BigDecimal[] scores = skill == ToeicSkill.LISTENING ? TOEIC_LISTENING : TOEIC_READING;
        int right = 1;
        while (right < TOEIC_RAW.length && correct > TOEIC_RAW[right]) right++;
        if (correct == TOEIC_RAW[right - 1]) return Optional.of(scores[right - 1]);
        int leftRaw = TOEIC_RAW[right - 1];
        int rightRaw = TOEIC_RAW[right];
        BigDecimal fraction = BigDecimal.valueOf(correct - leftRaw)
                .divide(BigDecimal.valueOf(rightRaw - leftRaw), 12, RoundingMode.HALF_UP);
        BigDecimal interpolated = scores[right - 1].add(scores[right].subtract(scores[right - 1]).multiply(fraction));
        BigDecimal rounded = interpolated.divide(BigDecimal.valueOf(5), 0, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(5));
        return Optional.of(rounded.max(BigDecimal.valueOf(5)).min(BigDecimal.valueOf(495)));
    }

    private CertificateSkillScore ieltsSkill(SkillObjectiveStats stats, String skill, boolean generalTraining) {
        if (stats == null) return unavailable(null, null, "MISSING_SKILL_" + skill);
        Optional<BigDecimal> band = "LISTENING".equals(skill)
                ? ieltsListeningBand(stats.getCorrect(), stats.getTotal())
                : "READING".equals(skill)
                    ? ieltsReadingBand(stats.getCorrect(), stats.getTotal(), generalTraining)
                    : Optional.empty();
        if ("SPEAKING".equals(skill)) {
            return unavailable(stats.getRawScore(), stats.getTotal(), "IELTS_SPEAKING_BAND_UNAVAILABLE", stats.getCorrect(), "Raw only");
        }
        if (band.isPresent()) return available(stats.getRawScore(), stats.getCorrect(), stats.getTotal(), band.get(), band.get().setScale(1).toPlainString());
        if (stats.getTotal() == 40 && stats.getCorrect() >= 0 && stats.getCorrect() <= 40
                && (("LISTENING".equals(skill) && stats.getCorrect() < 10)
                || ("READING".equals(skill) && stats.getCorrect() < (generalTraining ? 15 : 10)))) {
            return unavailable(stats.getRawScore(), stats.getTotal(), "IELTS_BELOW_BAND_4", stats.getCorrect(), "<4.0");
        }
        return unavailable(stats.getRawScore(), stats.getTotal(), "IELTS_NONSTANDARD_QUESTION_COUNT", stats.getCorrect(), "Raw only");
    }

    private CertificateSkillScore ieltsWritingSkill(List<WritingTaskSummary> tasks) {
        BigDecimal task1 = null;
        BigDecimal task2 = null;
        if (tasks != null) {
            for (WritingTaskSummary task : tasks) {
                if (task == null || !"DONE".equals(task.getStatus()) || task.getScore() == null
                        || !"BAND_0_9".equals(task.getScoreUnit()) || !"WRITING_EN_V1".equals(task.getRubricCode())) continue;
                String label = task.getLabel() == null ? "" : task.getLabel().toLowerCase(Locale.ROOT);
                if (label.contains("task 1") || label.contains("task1")) task1 = task.getScore();
                if (label.contains("task 2") || label.contains("task2")) task2 = task.getScore();
            }
        }
        if (task1 == null || task2 == null) return unavailable(null, null, "IELTS_WRITING_TASKS_INCOMPLETE");
        BigDecimal skill = roundIeltsBand(task1.add(task2.multiply(BigDecimal.valueOf(2)))
                .divide(BigDecimal.valueOf(3), 4, RoundingMode.HALF_UP));
        return available(null, null, null, skill, skill.setScale(1).toPlainString());
    }

    private CertificateSkillScore toeicSkill(SkillObjectiveStats stats, ToeicSkill skill) {
        if (stats == null) return unavailable(null, null, "TOEIC_SKILL_MISSING_" + skill.name());
        Optional<BigDecimal> score = toeicScaledScore(stats.getCorrect(), stats.getTotal(), skill);
        if (score.isEmpty()) return unavailable(stats.getRawScore(), stats.getTotal(), "TOEIC_SKILL_NOT_100_QUESTIONS", stats.getCorrect(), "Raw only");
        return available(stats.getRawScore(), stats.getCorrect(), stats.getTotal(), score.get(),
                stats.getCorrect() + "/" + stats.getTotal() + " → " + score.get().stripTrailingZeros().toPlainString());
    }

    private String missingIeltsReason(Map<String, CertificateSkillScore> scores) {
        for (Map.Entry<String, CertificateSkillScore> entry : scores.entrySet()) {
            if (entry.getValue().getScore() == null) return entry.getValue().getUnavailableReasonCode();
        }
        return "IELTS_SKILL_SPEAKING_MISSING";
    }

    private CertificateSkillScore available(BigDecimal raw, Integer correct, Integer total, BigDecimal score, String display) {
        return CertificateSkillScore.builder().rawScore(raw).rawCorrect(correct).rawTotal(total).score(score)
                .displayValue(display).status("AVAILABLE").build();
    }

    private CertificateSkillScore unavailable(BigDecimal raw, Integer total, String reason) {
        return unavailable(raw, total, reason, null, "—");
    }

    private CertificateSkillScore unavailable(BigDecimal raw, Integer total, String reason, Integer correct, String display) {
        return CertificateSkillScore.builder().rawScore(raw).rawCorrect(correct).rawTotal(total).score(null)
                .displayValue(display).status("UNAVAILABLE").unavailableReasonCode(reason).build();
    }

    private static String normalizeSkill(String skill) {
        String value = skill.trim().toUpperCase(Locale.ROOT);
        if (value.contains("LISTEN")) return "LISTENING";
        if (value.contains("READ")) return "READING";
        if (value.contains("WRIT")) return "WRITING";
        if (value.contains("SPEAK")) return "SPEAKING";
        return value;
    }

    private static BandRange[] ranges(double... values) {
        BandRange[] result = new BandRange[values.length / 3];
        for (int i = 0; i < result.length; i++) result[i] = new BandRange(BigDecimal.valueOf(values[i * 3]), (int) values[i * 3 + 1], (int) values[i * 3 + 2]);
        return result;
    }

    private static BigDecimal[] decimals(double... values) {
        BigDecimal[] result = new BigDecimal[values.length];
        for (int i = 0; i < values.length; i++) result[i] = BigDecimal.valueOf(values[i]);
        return result;
    }

    private record BandRange(BigDecimal band, int minimum, int maximum) {}
}
