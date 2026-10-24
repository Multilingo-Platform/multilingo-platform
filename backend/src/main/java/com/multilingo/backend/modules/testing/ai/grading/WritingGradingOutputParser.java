package com.multilingo.backend.modules.testing.ai.grading;

import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Strict parser and validator for Gemini writing evaluation responses.
 * Enforces JSON allowlists, duplicate detection, character limits, score bounds,
 * and correction reconstruction invariants without leaking raw provider data.
 */
@Component
public class WritingGradingOutputParser {

    private static final int MAX_RAW_OUTPUT_BYTES = 64 * 1024; // 64 KiB
    private static final int MAX_VISUAL_OBSERVATIONS_CODE_POINTS = 1000;
    private static final int MAX_CRITERION_FEEDBACK_CODE_POINTS = 1000;
    private static final int MAX_OVERALL_FEEDBACK_CODE_POINTS = 2000;
    private static final int MAX_CORRECTED_ESSAY_CODE_POINTS = 16000;
    private static final int MAX_CORRECTIONS_COUNT = 100;
    private static final int MAX_REPLACEMENT_CODE_POINTS = 2000;
    private static final int MAX_EXPLANATION_CODE_POINTS = 500;

    private static final Set<String> TEXT_ONLY_ROOT_ALLOWLIST = Set.of(
            "feedbackLanguage", "criteria", "overallFeedback", "correctedEssay", "corrections"
    );
    private static final Set<String> VISUAL_ROOT_ALLOWLIST = Set.of(
            "feedbackLanguage", "visualObservations", "criteria", "overallFeedback", "correctedEssay", "corrections"
    );
    private static final Set<String> CRITERION_ALLOWLIST = Set.of("code", "score", "feedback");
    private static final Set<String> CORRECTION_ALLOWLIST = Set.of("start", "end", "replacement", "explanation");
    private static final Set<String> REQUIRED_CRITERIA_CODES = Set.of("TR", "CC", "LR", "GRA");

    private final ObjectMapper objectMapper;

    public WritingGradingOutputParser() {
        JsonFactory jsonFactory = JsonFactory.builder()
                .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
                .build();
        this.objectMapper = new ObjectMapper(jsonFactory);
        this.objectMapper.enable(DeserializationFeature.FAIL_ON_READING_DUP_TREE_KEY);
        this.objectMapper.enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS);
    }

    public WritingGrade parse(String rawText, String originalEssay) {
        return parse(rawText, originalEssay, false);
    }

    public WritingGrade parse(String rawText, String originalEssay, boolean hasVisualContext) {
        return parse(rawText, originalEssay, hasVisualContext, null, WritingGrade.DEFAULT_LANGUAGE);
    }

    public WritingGrade parse(String rawText, String originalEssay, boolean hasVisualContext,
                              WritingRubricPolicy policy, String expectedFeedbackLanguage) {
        String rubric = policy == null ? WritingGrade.DEFAULT_RUBRIC : policy.rubricCode();
        String feedbackLanguage = expectedFeedbackLanguage == null || expectedFeedbackLanguage.isBlank()
                ? WritingGrade.DEFAULT_LANGUAGE : expectedFeedbackLanguage;
        BigDecimal maxScore = policy == null ? new BigDecimal("9.0") : policy.maxScore();
        Set<BigDecimal> allowedScores = allowedScores(maxScore);
        String safeOriginal = (originalEssay == null) ? "" : originalEssay;

        if (rawText == null || rawText.isBlank()) {
            throw malformed("Gemini response is null or blank");
        }

        byte[] bytes = rawText.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_RAW_OUTPUT_BYTES) {
            throw malformed("Gemini response exceeds maximum size limit");
        }

        if (rawText.contains("```")) {
            throw malformed("Gemini response contains Markdown code fences");
        }

        JsonNode root;
        try (JsonParser parser = objectMapper.createParser(rawText)) {
            root = objectMapper.readTree(parser);
            if (parser.nextToken() != null) {
                throw malformed("Gemini response contains trailing characters after JSON object");
            }
        } catch (IOException e) {
            throw malformed("Failed to parse JSON response");
        }

        if (root == null || !root.isObject()) {
            throw malformed("Gemini response root must be a JSON object");
        }

        // Validate root keys against allowlist
        Set<String> rootAllowlist = hasVisualContext ? VISUAL_ROOT_ALLOWLIST : TEXT_ONLY_ROOT_ALLOWLIST;
        Iterator<String> fieldNames = root.fieldNames();
        while (fieldNames.hasNext()) {
            String field = fieldNames.next();
            if (!rootAllowlist.contains(field)) {
                throw malformed("Unknown key in root response");
            }
        }

        // feedbackLanguage
        JsonNode langNode = root.get("feedbackLanguage");
        if (langNode == null || !langNode.isTextual() || !feedbackLanguage.equals(langNode.asText())) {
            throw malformed("Invalid or missing feedbackLanguage");
        }

        // visualObservations: required for visual context, forbidden for text-only
        String visualObservations = null;
        if (hasVisualContext) {
            JsonNode voNode = root.get("visualObservations");
            if (voNode == null || !voNode.isTextual() || voNode.asText().isBlank()) {
                throw malformed("Missing or invalid visualObservations");
            }
            visualObservations = voNode.asText();
            if (visualObservations.codePointCount(0, visualObservations.length()) > MAX_VISUAL_OBSERVATIONS_CODE_POINTS) {
                throw malformed("visualObservations exceeds limit of 1000 code points");
            }
        }

        // criteria
        JsonNode criteriaNode = root.get("criteria");
        if (criteriaNode == null || !criteriaNode.isArray() || criteriaNode.size() != 4) {
            throw malformed("criteria must be an array of exactly 4 items");
        }

        List<WritingGrade.CriterionGrade> criteria = new ArrayList<>(4);
        Set<String> seenCodes = new HashSet<>();
        BigDecimal sumScore = BigDecimal.ZERO;

        for (JsonNode cNode : criteriaNode) {
            if (!cNode.isObject()) {
                throw malformed("Criterion item must be an object");
            }
            Iterator<String> cFields = cNode.fieldNames();
            while (cFields.hasNext()) {
                String cField = cFields.next();
                if (!CRITERION_ALLOWLIST.contains(cField)) {
                    throw malformed("Unknown key in criterion");
                }
            }

            JsonNode codeNode = cNode.get("code");
            if (codeNode == null || !codeNode.isTextual() || !REQUIRED_CRITERIA_CODES.contains(codeNode.asText())) {
                throw malformed("Invalid or missing criterion code");
            }
            String code = codeNode.asText();
            if (!seenCodes.add(code)) {
                throw malformed("Duplicate criterion code");
            }

            JsonNode scoreNode = cNode.get("score");
            if (scoreNode == null || !scoreNode.isNumber()) {
                throw malformed("Missing or non-numeric score for criterion");
            }

            BigDecimal score;
            try {
                score = new BigDecimal(scoreNode.asText());
            } catch (Exception e) {
                throw malformed("Invalid score format for criterion");
            }

            try {
                score = score.setScale(1, RoundingMode.UNNECESSARY);
            } catch (ArithmeticException e) {
                throw malformed("Invalid score step for criterion");
            }

            if (!allowedScores.contains(score)) {
                throw malformed("Invalid score for criterion under the selected rubric");
            }
            sumScore = sumScore.add(score);

            JsonNode fbNode = cNode.get("feedback");
            if (fbNode == null || !fbNode.isTextual()) {
                throw malformed("Missing feedback text for criterion");
            }
            String feedback = fbNode.asText();
            if (feedback.codePointCount(0, feedback.length()) > MAX_CRITERION_FEEDBACK_CODE_POINTS) {
                throw malformed("Criterion feedback exceeds limit of 1000 code points");
            }

            criteria.add(new WritingGrade.CriterionGrade(code, score, feedback));
        }

        // Sort criteria by fixed order: TR, CC, LR, GRA
        criteria.sort(Comparator.comparingInt(c -> switch (c.code()) {
            case "TR" -> 0;
            case "CC" -> 1;
            case "LR" -> 2;
            case "GRA" -> 3;
            default -> 4;
        }));

        // Calculate overall score: average of 4 scores rounded to 0.5 step using HALF_UP
        BigDecimal overallScore = calculateOverallScore(sumScore);

        // overallFeedback
        JsonNode overallFbNode = root.get("overallFeedback");
        if (overallFbNode == null || !overallFbNode.isTextual()) {
            throw malformed("Missing overallFeedback text");
        }
        String overallFeedback = overallFbNode.asText();
        if (overallFeedback.codePointCount(0, overallFeedback.length()) > MAX_OVERALL_FEEDBACK_CODE_POINTS) {
            throw malformed("overallFeedback exceeds limit of 2000 code points");
        }

        // correctedEssay
        JsonNode correctedEssayNode = root.get("correctedEssay");
        if (correctedEssayNode == null || !correctedEssayNode.isTextual()) {
            throw malformed("Missing correctedEssay text");
        }
        String correctedEssay = correctedEssayNode.asText();
        if (correctedEssay.codePointCount(0, correctedEssay.length()) > MAX_CORRECTED_ESSAY_CODE_POINTS) {
            throw malformed("correctedEssay exceeds limit of 16000 code points");
        }

        // corrections
        JsonNode correctionsNode = root.get("corrections");
        if (correctionsNode == null || !correctionsNode.isArray()) {
            throw malformed("corrections must be an array");
        }
        if (correctionsNode.size() > MAX_CORRECTIONS_COUNT) {
            throw malformed("corrections count exceeds limit of 100 items");
        }

        List<WritingGrade.Correction> corrections = new ArrayList<>();
        for (JsonNode corrNode : correctionsNode) {
            if (!corrNode.isObject()) {
                throw malformed("Correction item must be an object");
            }
            Iterator<String> corrFields = corrNode.fieldNames();
            while (corrFields.hasNext()) {
                String corrField = corrFields.next();
                if (!CORRECTION_ALLOWLIST.contains(corrField)) {
                    throw malformed("Unknown key in correction");
                }
            }

            JsonNode startNode = corrNode.get("start");
            JsonNode endNode = corrNode.get("end");
            JsonNode replNode = corrNode.get("replacement");
            JsonNode expNode = corrNode.get("explanation");

            if (startNode == null || !startNode.isInt() || endNode == null || !endNode.isInt()) {
                throw malformed("Correction start and end must be integers");
            }
            int start = startNode.asInt();
            int end = endNode.asInt();

            if (replNode == null || !replNode.isTextual()) {
                throw malformed("Correction replacement must be a string");
            }
            String replacement = replNode.asText();
            if (replacement.codePointCount(0, replacement.length()) > MAX_REPLACEMENT_CODE_POINTS) {
                throw malformed("Correction replacement exceeds limit of 2000 code points");
            }

            if (expNode == null || !expNode.isTextual()) {
                throw malformed("Correction explanation must be a string");
            }
            String explanation = expNode.asText();
            if (explanation.codePointCount(0, explanation.length()) > MAX_EXPLANATION_CODE_POINTS) {
                throw malformed("Correction explanation exceeds limit of 500 code points");
            }

            corrections.add(new WritingGrade.Correction(start, end, replacement, explanation));
        }

        // Verify that applying corrections reconstructs correctedEssay exactly
        try {
            String reconstructed = WritingDiffBuilder.applyCorrections(safeOriginal, corrections);
            if (!reconstructed.equals(correctedEssay)) {
                throw malformed("Reconstructed essay from corrections does not match correctedEssay exactly");
            }
        } catch (IllegalArgumentException | IndexOutOfBoundsException e) {
            throw malformed("Invalid corrections layout");
        }

        // Generate diff segments
        List<WritingGrade.DiffSegment> diff = WritingDiffBuilder.build(safeOriginal, corrections);

        return new WritingGrade(
                rubric,
                feedbackLanguage,
                overallScore,
                criteria,
                overallFeedback,
                correctedEssay,
                corrections,
                diff,
                visualObservations,
                List.of()
        );
    }

    public static BigDecimal calculateOverallScore(BigDecimal sumOfFourCriteria) {
        BigDecimal doubled = sumOfFourCriteria.divide(BigDecimal.valueOf(2), 4, RoundingMode.HALF_UP);
        BigDecimal roundedDouble = doubled.setScale(0, RoundingMode.HALF_UP);
        return roundedDouble.divide(BigDecimal.valueOf(2), 1, RoundingMode.UNNECESSARY);
    }

    private static Set<BigDecimal> initAllowedScores() {
        return allowedScores(new BigDecimal("9.0"));
    }

    private static Set<BigDecimal> allowedScores(BigDecimal maxScore) {
        Set<BigDecimal> scores = new HashSet<>();
        int maxHalfSteps = maxScore.multiply(BigDecimal.valueOf(2)).intValueExact();
        for (int i = 0; i <= maxHalfSteps; i++) {
            scores.add(BigDecimal.valueOf(i).divide(BigDecimal.valueOf(2), 1, RoundingMode.UNNECESSARY));
        }
        return Collections.unmodifiableSet(scores);
    }

    private WritingGradingException malformed(String message) {
        return new WritingGradingException(WritingGradingFailure.terminal("MALFORMED_OUTPUT", message));
    }
}

