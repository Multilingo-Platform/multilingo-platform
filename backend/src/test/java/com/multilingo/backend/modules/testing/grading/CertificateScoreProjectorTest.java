package com.multilingo.backend.modules.testing.grading;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.List;

import com.multilingo.backend.modules.testing.dto.response.ResultSummaryResponse.SkillObjectiveStats;
import com.multilingo.backend.modules.testing.dto.response.ResultSummaryResponse.WritingTaskSummary;

import static org.junit.jupiter.api.Assertions.*;

class CertificateScoreProjectorTest {
    private final CertificateScoreProjector projector = new CertificateScoreProjector();

    @Test
    void ieltsListeningUsesDocumentedThresholdsAndDisplaysBelowFourAsUnavailableBand() {
        assertEquals(new BigDecimal("4.0"), CertificateScoreProjector.ieltsListeningBand(10, 40).orElseThrow());
        assertEquals(new BigDecimal("6.5"), CertificateScoreProjector.ieltsListeningBand(26, 40).orElseThrow());
        assertTrue(CertificateScoreProjector.ieltsListeningBand(9, 40).isEmpty());
        assertTrue(CertificateScoreProjector.ieltsListeningBand(26, 39).isEmpty());
    }

    @Test
    void allIeltsListeningAndReadingBandThresholdsMatchBothReferenceTables() {
        int[] listeningRaw = {10, 13, 16, 18, 23, 26, 30, 32, 35, 37, 39};
        int[] academicRaw = {10, 13, 15, 19, 23, 27, 30, 33, 35, 37, 39};
        int[] generalRaw = {15, 19, 23, 27, 30, 32, 34, 36, 37, 39, 40};
        for (int i = 0; i < 11; i++) {
            BigDecimal band = BigDecimal.valueOf(4.0 + i * 0.5);
            assertEquals(band, CertificateScoreProjector.ieltsListeningBand(listeningRaw[i], 40).orElseThrow());
            assertEquals(band, CertificateScoreProjector.ieltsReadingBand(academicRaw[i], 40, false).orElseThrow());
            assertEquals(band, CertificateScoreProjector.ieltsReadingBand(generalRaw[i], 40, true).orElseThrow());
        }
    }

    @Test
    void ieltsReadingUsesAcademicAndGeneralTrainingThresholds() {
        assertEquals(new BigDecimal("4.0"), CertificateScoreProjector.ieltsReadingBand(10, 40, false).orElseThrow());
        assertEquals(new BigDecimal("4.0"), CertificateScoreProjector.ieltsReadingBand(15, 40, true).orElseThrow());
        assertTrue(CertificateScoreProjector.ieltsReadingBand(14, 40, true).isEmpty());
    }

    @Test
    void ieltsHalfBandRoundingUsesQuarterBandThresholds() {
        assertEquals(new BigDecimal("6.5"), CertificateScoreProjector.roundIeltsBand(new BigDecimal("6.25")));
        assertEquals(new BigDecimal("7.0"), CertificateScoreProjector.roundIeltsBand(new BigDecimal("6.75")));
        assertEquals(new BigDecimal("6.5"), CertificateScoreProjector.roundIeltsBand(new BigDecimal("6.625")));
    }

    @Test
    void toeicInterpolationMatchesAnchorsAndRoundsToFivePointSteps() {
        assertEquals(0, new BigDecimal("5").compareTo(CertificateScoreProjector.toeicScaledScore(0, 100, CertificateScoreProjector.ToeicSkill.LISTENING).orElseThrow()));
        assertEquals(new BigDecimal("60"), CertificateScoreProjector.toeicScaledScore(20, 100, CertificateScoreProjector.ToeicSkill.LISTENING).orElseThrow());
        assertEquals(new BigDecimal("45"), CertificateScoreProjector.toeicScaledScore(20, 100, CertificateScoreProjector.ToeicSkill.READING).orElseThrow());
        assertEquals(new BigDecimal("495"), CertificateScoreProjector.toeicScaledScore(100, 100, CertificateScoreProjector.ToeicSkill.READING).orElseThrow());
        assertTrue(CertificateScoreProjector.toeicScaledScore(99, 100, CertificateScoreProjector.ToeicSkill.LISTENING).orElseThrow().remainder(BigDecimal.valueOf(5)).signum() == 0);
    }

    @Test
    void toeicMappingIsMonotoneBoundedAndUnavailableForIncompleteSkill() {
        for (CertificateScoreProjector.ToeicSkill skill : CertificateScoreProjector.ToeicSkill.values()) {
            BigDecimal previous = null;
            for (int raw = 0; raw <= 100; raw++) {
                BigDecimal score = CertificateScoreProjector.toeicScaledScore(raw, 100, skill).orElseThrow();
                assertTrue(score.compareTo(BigDecimal.valueOf(5)) >= 0 && score.compareTo(BigDecimal.valueOf(495)) <= 0);
                assertEquals(0, score.remainder(BigDecimal.valueOf(5)).signum());
                if (previous != null) assertTrue(score.compareTo(previous) >= 0);
                previous = score;
            }
        }
        assertEquals(Optional.empty(), CertificateScoreProjector.toeicScaledScore(99, 99, CertificateScoreProjector.ToeicSkill.READING));
    }

    @Test
    void toeicProjectionRequiresCompleteListeningAndReadingAndReturnsEstimatedTotal() {
        var partial = projector.project("TOEIC_LR", List.of(skill("LISTENING", 80, 100)), List.of()).orElseThrow();
        assertNull(partial.getOverallScore());
        var complete = projector.project("TOEIC_LR", List.of(skill("LISTENING", 80, 100), skill("READING", 90, 100)), List.of()).orElseThrow();
        assertEquals(new BigDecimal("430"), complete.getSkillScores().get("LISTENING").getScore());
        assertEquals(new BigDecimal("885"), complete.getOverallScore());
    }

    @Test
    void ieltsProjectionKeepsSkillBandsAndWithholdsOverallWhenSpeakingIsMissing() {
        List<WritingTaskSummary> writing = List.of(
                writingTask("Writing Task 1", "6.0"), writingTask("Writing Task 2", "6.5"));
        var result = projector.project("IELTS_ACADEMIC", List.of(skill("LISTENING", 40, 40), skill("READING", 39, 40)), writing).orElseThrow();
        assertEquals(new BigDecimal("6.5"), result.getSkillScores().get("WRITING").getScore());
        assertNull(result.getOverallScore());
        assertEquals("IELTS_SKILL_SPEAKING_MISSING", result.getUnavailableReasonCode());
    }

    @Test
    void ieltsProjectionShowsBelowFourWithoutInventingANumericBand() {
        var result = projector.project("IELTS_ACADEMIC", List.of(skill("LISTENING", 9, 40)), List.of()).orElseThrow();
        assertNull(result.getSkillScores().get("LISTENING").getScore());
        assertEquals("<4.0", result.getSkillScores().get("LISTENING").getDisplayValue());
    }

    @Test
    void ieltsSpeakingObjectiveCountIsNeverMisrepresentedAsASpeakingBand() {
        List<WritingTaskSummary> writing = List.of(
                writingTask("Writing Task 1", "6.0"), writingTask("Writing Task 2", "6.5"));
        var result = projector.project("IELTS_ACADEMIC", List.of(
                skill("LISTENING", 40, 40), skill("READING", 39, 40), skill("SPEAKING", 40, 40)), writing).orElseThrow();
        assertNull(result.getSkillScores().get("SPEAKING").getScore());
        assertEquals("IELTS_SPEAKING_BAND_UNAVAILABLE", result.getSkillScores().get("SPEAKING").getUnavailableReasonCode());
        assertNull(result.getOverallScore());
    }

    private static SkillObjectiveStats skill(String name, int correct, int total) {
        return SkillObjectiveStats.builder().skill(name).rawScore(BigDecimal.valueOf(correct)).correct(correct)
                .incorrect(total - correct).unanswered(0).total(total).accuracy(BigDecimal.ZERO).build();
    }

    private static WritingTaskSummary writingTask(String label, String score) {
        return WritingTaskSummary.builder().label(label).status("DONE").score(new BigDecimal(score))
                .scoreUnit("BAND_0_9").rubricCode("WRITING_EN_V1").build();
    }
}
