package com.multilingo.backend.modules.testing.service.impl;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.auth.entity.UserTarget;
import com.multilingo.backend.modules.auth.repository.UserTargetRepository;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.gamification.entity.UserStudyStat;
import com.multilingo.backend.modules.gamification.repository.UserStudyStatRepository;
import com.multilingo.backend.modules.testing.dto.response.RecentScoreTrendItem;
import com.multilingo.backend.modules.testing.dto.response.StudentHistoryItemResponse;
import com.multilingo.backend.modules.testing.dto.response.StudentHistoryStatsResponse;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.service.StudentHistoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class StudentHistoryServiceImpl implements StudentHistoryService {

    private final TestAttemptRepository testAttemptRepository;
    private final ExamRepository examRepository;
    private final UserStudyStatRepository userStudyStatRepository;
    private final UserTargetRepository userTargetRepository;
    private final ObjectMapper objectMapper;

    private String resolveUserLanguage(Integer userId, String targetLanguage) {
        if (targetLanguage != null && !targetLanguage.trim().isEmpty() && !"ALL".equalsIgnoreCase(targetLanguage.trim())) {
            return targetLanguage.trim().toLowerCase();
        }
        UserTarget userTarget = userTargetRepository.findFirstByUserId(userId).orElse(null);
        if (userTarget != null && userTarget.getTargetLanguage() != null && !userTarget.getTargetLanguage().trim().isEmpty()) {
            return userTarget.getTargetLanguage().trim().toLowerCase();
        }
        if (userTarget != null && userTarget.getTargetCertificate() != null) {
            return "NLTV".equalsIgnoreCase(userTarget.getTargetCertificate()) ? "vi" : "en";
        }
        return "en";
    }

    @Override
    public StudentHistoryStatsResponse getStudentStats(Integer userId, String cert, String targetLanguage) {
        String resolvedLang = resolveUserLanguage(userId, targetLanguage);
        boolean hasLang = (resolvedLang != null && !resolvedLang.isBlank());

        boolean hasCert = cert != null && !cert.trim().isEmpty() && !"ALL".equalsIgnoreCase(cert.trim());
        String certPrefix = hasCert ? cert.trim().toUpperCase() : "";

        long totalAttempts = testAttemptRepository.countByUserIdAndLanguageAndCert(userId, resolvedLang, hasLang, certPrefix, hasCert);
        long completedAttempts = testAttemptRepository.countByUserIdAndStatusAndLanguageAndCert(userId, AttemptStatus.COMPLETED, resolvedLang, hasLang, certPrefix, hasCert);
        long inProgressAttempts = testAttemptRepository.countByUserIdAndStatusAndLanguageAndCert(userId, AttemptStatus.IN_PROGRESS, resolvedLang, hasLang, certPrefix, hasCert);
        long failedAttempts = testAttemptRepository.countByUserIdAndStatusAndLanguageAndCert(userId, AttemptStatus.GRADING_FAILED, resolvedLang, hasLang, certPrefix, hasCert);
        Long totalTimeSeconds = testAttemptRepository.sumTimeSpentSecondsByUserIdAndLanguageAndCert(userId, resolvedLang, hasLang, certPrefix, hasCert);
        long totalPracticeMinutes = totalTimeSeconds != null ? totalTimeSeconds / 60 : 0;

        // Grouped averages by certificate type (e.g. IELTS, TOEIC, NLTV)
        java.util.Map<String, Double> averageScoresByType = new java.util.HashMap<>();
        java.util.Map<String, Double> highestScoresByType = new java.util.HashMap<>();
        List<Object[]> groupedAvgs = testAttemptRepository.findAverageScoresGroupedByType(userId, resolvedLang, hasLang);
        java.util.Map<String, java.util.Map<String, List<Double>>> scoresByCertGroup = new java.util.HashMap<>();
        java.util.Map<String, java.util.Map<String, Double>> highestByCertGroup = new java.util.HashMap<>();
        for (Object[] row : groupedAvgs) {
            String rawType = (String) row[0];
            String scoreUnit = row.length > 1 && row[1] != null ? row[1].toString() : "LEGACY_RAW";
            Number avgNum = row.length > 2 ? (Number) row[2] : null;
            Number maxNum = row.length > 3 ? (Number) row[3] : null;
            if (rawType != null && avgNum != null) {
                String certGroup = resolveCertType(rawType);
                scoresByCertGroup.computeIfAbsent(certGroup, k -> new java.util.HashMap<>())
                        .computeIfAbsent(scoreUnit, k -> new java.util.ArrayList<>()).add(avgNum.doubleValue());
                if (maxNum != null) highestByCertGroup.computeIfAbsent(certGroup, k -> new java.util.HashMap<>())
                        .merge(scoreUnit, maxNum.doubleValue(), Math::max);
            }
        }
        for (java.util.Map.Entry<String, java.util.Map<String, List<Double>>> entry : scoresByCertGroup.entrySet()) {
            String preferredUnit = switch (entry.getKey()) {
                case "IELTS" -> "IELTS_BAND";
                case "TOEIC_LR" -> "TOEIC_SCALED";
                case "TOEIC_WRITING" -> "TOEIC_WRITING";
                default -> "RAW_OBJECTIVE";
            };
            List<Double> comparable = entry.getValue().getOrDefault(preferredUnit, List.of());
            if ((comparable == null || comparable.isEmpty()) && !"IELTS".equals(entry.getKey()) && !"TOEIC_LR".equals(entry.getKey())) {
                comparable = new ArrayList<>();
                comparable.addAll(entry.getValue().getOrDefault("TOEIC_WRITING", List.of()));
                comparable.addAll(entry.getValue().getOrDefault("RAW_OBJECTIVE", List.of()));
                comparable.addAll(entry.getValue().getOrDefault("LEGACY_RAW", List.of()));
            }
            if (!comparable.isEmpty()) {
                double mean = comparable.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
                if ("TOEIC_LR".equals(entry.getKey()) || "TOEIC_WRITING".equals(entry.getKey())) {
                    averageScoresByType.put(entry.getKey(), (double) Math.round(mean));
                } else {
                    averageScoresByType.put(entry.getKey(), Math.round(mean * 10.0) / 10.0);
                }
            }
            Double highest = highestByCertGroup.getOrDefault(entry.getKey(), java.util.Map.of()).get(preferredUnit);
            if (highest == null && !"IELTS".equals(entry.getKey()) && !"TOEIC_LR".equals(entry.getKey())) {
                highest = java.util.stream.Stream.of(
                        highestByCertGroup.getOrDefault(entry.getKey(), java.util.Map.of()).get("RAW_OBJECTIVE"),
                        highestByCertGroup.getOrDefault(entry.getKey(), java.util.Map.of()).get("LEGACY_RAW"))
                        .filter(java.util.Objects::nonNull).max(Double::compareTo).orElse(null);
            }
            if (highest != null) highestScoresByType.put(entry.getKey(), highest);
        }

        UserTarget userTarget = userTargetRepository.findFirstByUserId(userId).orElse(null);
        Double targetScoreVal = userTarget != null && userTarget.getTargetScore() != null
                ? userTarget.getTargetScore().doubleValue()
                : null;
        String userTargetCert = userTarget != null && userTarget.getTargetCertificate() != null
                ? resolveCertType(userTarget.getTargetCertificate())
                : null;

        // Resolve an average and highest value from the same certificate/unit only.
        String displayCertGroup = hasCert ? resolveCertType(certPrefix)
                : userTargetCert != null ? userTargetCert
                : averageScoresByType.size() == 1 ? averageScoresByType.keySet().iterator().next() : null;
        Double displayAverageScore = displayCertGroup == null ? null : averageScoresByType.get(displayCertGroup);
        Double highestScore = displayCertGroup == null ? null : highestScoresByType.get(displayCertGroup);

        int currentStreak = userStudyStatRepository.findByUserId(userId)
                .map(UserStudyStat::getCurrentStreak)
                .orElse(0);

        List<Object[]> recentRows = testAttemptRepository.findRecentAttemptsWithExam(
                userId, AttemptStatus.COMPLETED, resolvedLang, hasLang, certPrefix, hasCert, PageRequest.of(0, 50)
        );
        List<RecentScoreTrendItem> trends = new java.util.ArrayList<>();
        long targetAchievedCount = 0;

        for (Object[] record : recentRows) {
            TestAttempt a = (TestAttempt) record[0];
            Exam exam = (Exam) record[1];
            String title = exam != null ? exam.getTitle() : "Đề thi #" + a.getExamId();
            String examType = exam != null ? exam.getType() : "";
            String scoreUnit = a.getScoreUnit() == null ? "LEGACY_RAW" : a.getScoreUnit();
            if (a.getTestScope() == TestScope.SINGLE_PART || a.getTestScope() == TestScope.MULTI_PART) {
                scoreUnit = "RAW_OBJECTIVE";
            }
            Double maxScore = resolveMaxScore(examType, scoreUnit, a.getTestScope(), a.getResultSummary());
            String itemCertType = resolveCertType(examType);

            Double score = a.getOverallScore() != null ? a.getOverallScore().doubleValue() : null;
            Double percentage = (score != null && maxScore != null && maxScore > 0)
                    ? Math.min(100.0, (score / maxScore) * 100.0) : null;

            if (score != null && targetScoreVal != null && targetScoreCertMatches(userTargetCert, itemCertType)
                    && !"RAW_OBJECTIVE".equals(scoreUnit) && !"LEGACY_RAW".equals(scoreUnit) && score >= targetScoreVal) {
                targetAchievedCount++;
            }

            // Biểu đồ tiến độ điểm số chỉ dùng điểm của các bài thi full đề (cả mock test và practice)
            if (isFullExamAttempt(a, exam) && trends.size() < 10) {
                trends.add(RecentScoreTrendItem.builder()
                        .attemptId(a.getId())
                        .examTitle(title)
                        .certType(itemCertType)
                        .score(score)
                        .maxScore(maxScore)
                        .percentage(percentage == null ? null : Math.round(percentage * 10.0) / 10.0)
                        .scoreUnit(scoreUnit)
                        .testMode(a.getTestMode() != null ? a.getTestMode().name() : null)
                        .testScope(a.getTestScope() != null ? a.getTestScope().name() : "FULL_EXAM")
                        .completedAt(a.getEndTime() != null ? a.getEndTime() : a.getCreatedAt())
                        .build());
            }
        }

        // Đảo lại thứ tự thời gian tăng dần để vẽ biểu đồ trực quan từ quá khứ đến hiện tại
        Collections.reverse(trends);

        return StudentHistoryStatsResponse.builder()
                .totalAttempts(totalAttempts)
                .completedAttempts(completedAttempts)
                .inProgressAttempts(inProgressAttempts)
                .failedAttempts(failedAttempts)
                .averageScore(displayAverageScore)
                .averageScoresByType(averageScoresByType)
                .highestScore(highestScore != null ? Math.round(highestScore * 10.0) / 10.0 : null)
                .totalPracticeMinutes(totalPracticeMinutes)
                .currentStreak(currentStreak)
                .targetAchievedCount(targetAchievedCount)
                .recentScoreTrends(trends)
                .build();
    }

    @Override
    public PageResponse<StudentHistoryItemResponse> getStudentHistory(
            Integer userId,
            String search,
            String cert,
            String mode,
            String status,
            String targetLanguage,
            int page,
            int size,
            String sort
    ) {
        String resolvedLang = resolveUserLanguage(userId, targetLanguage);
        boolean hasLang = (resolvedLang != null && !resolvedLang.isBlank());

        Sort sortObj;
        if ("highestScore".equalsIgnoreCase(sort)) {
            sortObj = Sort.by(Sort.Direction.DESC, "a.overallScore");
        } else if ("duration".equalsIgnoreCase(sort)) {
            sortObj = Sort.by(Sort.Direction.DESC, "a.timeSpentSeconds");
        } else {
            sortObj = Sort.by(Sort.Direction.DESC, "a.startTime");
        }

        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, size), sortObj);

        boolean hasSearch = search != null && !search.trim().isEmpty();
        String cleanSearch = hasSearch ? search.trim() : "";

        boolean hasCert = cert != null && !cert.trim().isEmpty() && !"ALL".equalsIgnoreCase(cert.trim());
        String certPrefix = hasCert ? cert.trim().toUpperCase() : "";

        TestMode testMode = null;
        boolean hasMode = false;
        if (mode != null && !mode.trim().isEmpty() && !"ALL".equalsIgnoreCase(mode.trim())) {
            try {
                testMode = TestMode.valueOf(mode.trim().toUpperCase());
                hasMode = true;
            } catch (IllegalArgumentException ignored) {
            }
        }

        AttemptStatus attemptStatus = null;
        boolean hasStatus = false;
        if (status != null && !status.trim().isEmpty() && !"ALL".equalsIgnoreCase(status.trim())) {
            try {
                attemptStatus = AttemptStatus.valueOf(status.trim().toUpperCase());
                hasStatus = true;
            } catch (IllegalArgumentException ignored) {
            }
        }

        UserTarget userTarget = userTargetRepository.findFirstByUserId(userId).orElse(null);
        Double targetScoreVal = userTarget != null && userTarget.getTargetScore() != null
                ? userTarget.getTargetScore().doubleValue()
                : null;
        String userTargetCert = userTarget != null && userTarget.getTargetCertificate() != null
                ? resolveCertType(userTarget.getTargetCertificate())
                : null;

        Page<Object[]> rawPage = testAttemptRepository.findUserAttemptsWithExam(
                userId,
                resolvedLang,
                hasLang,
                cleanSearch,
                hasSearch,
                certPrefix,
                hasCert,
                testMode,
                hasMode,
                attemptStatus,
                hasStatus,
                pageable
        );

        List<StudentHistoryItemResponse> items = new ArrayList<>();
        for (Object[] record : rawPage.getContent()) {
            TestAttempt a = (TestAttempt) record[0];
            Exam e = (Exam) record[1];

            boolean isExamDeleted = (e == null);
            String examCode = e != null ? e.getCode() : "N/A";
            String examTitle = e != null ? e.getTitle() : "Đề thi đã ngừng phát hành (#" + a.getExamId() + ")";
            String examType = e != null ? e.getType() : "OTHER";
            String examLanguage = e != null ? e.getExamLanguage() : "vi";

            String scoreUnit = a.getScoreUnit() == null ? "LEGACY_RAW" : a.getScoreUnit();
            if (a.getTestScope() == TestScope.SINGLE_PART || a.getTestScope() == TestScope.MULTI_PART) {
                scoreUnit = "RAW_OBJECTIVE";
            }
            Double maxScore = resolveMaxScore(examType, scoreUnit, a.getTestScope(), a.getResultSummary());
            int durationMinutes = a.getTimeSpentSeconds() != null ? Math.max(1, a.getTimeSpentSeconds() / 60) : 0;

            Double score = a.getOverallScore() != null ? a.getOverallScore().doubleValue() : null;
            boolean comparableToTarget = targetScoreCertMatches(userTargetCert, resolveCertType(examType))
                    && !"RAW_OBJECTIVE".equals(scoreUnit) && !"LEGACY_RAW".equals(scoreUnit);
            Boolean targetAchieved = (score != null && targetScoreVal != null && comparableToTarget) ? score >= targetScoreVal : null;
            Boolean passed = (score != null && maxScore != null && maxScore > 0) ? score >= (maxScore * 0.5) : null;
            Double accuracyPercentage = (score != null && maxScore != null && maxScore > 0) ? Math.min(100.0, (score / maxScore) * 100.0) : null;
            if (accuracyPercentage != null) {
                accuracyPercentage = Math.round(accuracyPercentage * 10.0) / 10.0;
            }

            items.add(StudentHistoryItemResponse.builder()
                    .attemptId(a.getId())
                    .examId(a.getExamId())
                    .examCode(examCode)
                    .examTitle(examTitle)
                    .examType(examType)
                    .examLanguage(examLanguage)
                    .isExamDeleted(isExamDeleted)
                    .testMode(a.getTestMode() != null ? a.getTestMode().name() : null)
                    .testScope(a.getTestScope() != null ? a.getTestScope().name() : null)
                    .status(a.getStatus() != null ? a.getStatus().name() : null)
                    .startTime(a.getStartTime())
                    .endTime(a.getEndTime())
                    .timeSpentSeconds(a.getTimeSpentSeconds())
                    .durationMinutes(durationMinutes)
                    .overallScore(score)
                    .maxScore(maxScore)
                    .scoreUnit(scoreUnit)
                    .targetScore(targetScoreVal)
                    .targetAchieved(targetAchieved)
                    .passed(passed)
                    .accuracyPercentage(accuracyPercentage)
                    .build());
        }

        return PageResponse.<StudentHistoryItemResponse>builder()
                .items(items)
                .page(rawPage.getNumber())
                .size(rawPage.getSize())
                .totalElements(rawPage.getTotalElements())
                .totalPages(rawPage.getTotalPages())
                .last(rawPage.isLast())
                .build();
    }

    private Double resolveMaxScore(String examType, String scoreUnit) {
        return resolveMaxScore(examType, scoreUnit, null, null);
    }

    private Double resolveMaxScore(String examType, String scoreUnit, TestScope testScope, String resultSummaryJson) {
        if (testScope == TestScope.SINGLE_PART || testScope == TestScope.MULTI_PART
                || "RAW_OBJECTIVE".equals(scoreUnit) || (scoreUnit != null && scoreUnit.endsWith("RAW"))) {
            Double objectiveTotal = parseTotalObjectiveCount(resultSummaryJson);
            if (objectiveTotal != null && objectiveTotal > 0) {
                return objectiveTotal;
            }
            return null;
        }

        if ("IELTS_BAND".equals(scoreUnit)) return 9.0;

        if ("TOEIC_SCALED".equals(scoreUnit)) {
            if (testScope == TestScope.SINGLE_SKILL || isToeicSingleSkillExam(examType)) {
                return 450.0;
            }
            return 990.0;
        }

        if ("TOEIC_WRITING".equals(scoreUnit) || "PRACTICE_0_200".equals(scoreUnit)) return 200.0;
        if (scoreUnit == null) return null;

        if (examType == null) return 100.0;
        String upper = examType.toUpperCase();
        if (upper.startsWith("IELTS")) return 9.0;
        if (upper.contains("WRITING") || upper.startsWith("TW")) return 200.0;
        if (upper.startsWith("TOEIC")) {
            if (testScope == TestScope.SINGLE_SKILL || isToeicSingleSkillExam(examType)) {
                return 450.0;
            }
            return 990.0;
        }
        if (upper.startsWith("NLTV")) return 10.0;
        return 100.0;
    }

    private boolean isToeicSingleSkillExam(String examType) {
        if (examType == null) return false;
        String upper = examType.toUpperCase();
        return upper.contains("LISTENING") || upper.contains("READING");
    }

    private Double parseTotalObjectiveCount(String resultSummaryJson) {
        if (resultSummaryJson == null || resultSummaryJson.isBlank()) {
            return null;
        }
        ObjectMapper mapper = (this.objectMapper != null) ? this.objectMapper : new ObjectMapper();
        try {
            JsonNode root = mapper.readTree(resultSummaryJson);
            if (root.hasNonNull("totalObjectiveCount")) {
                return root.get("totalObjectiveCount").asDouble();
            }
            if (root.has("objective") && root.get("objective").hasNonNull("total")) {
                return root.get("objective").get("total").asDouble();
            }
            if (root.hasNonNull("totalQuestions")) {
                return root.get("totalQuestions").asDouble();
            }
        } catch (Exception e) {
            log.debug("Failed to parse totalObjectiveCount from resultSummary: {}", e.getMessage());
        }
        return null;
    }

    private boolean targetScoreCertMatches(String targetCert, String resultCert) {
        return targetCert != null && targetCert.equals(resultCert);
    }

    private String resolveCertType(String examType) {
        if (examType == null) return "OTHER";
        String upper = examType.toUpperCase();
        if (upper.startsWith("IELTS")) return "IELTS";
        if (upper.contains("WRITING") || upper.startsWith("TW")) return "TOEIC_WRITING";
        if (upper.startsWith("TOEIC")) return "TOEIC_LR";
        if (upper.startsWith("NLTV")) return "NLTV";
        return "OTHER";
    }

    private boolean isFullExamAttempt(TestAttempt a, Exam exam) {
        if (a == null) return false;

        // 1. Phải là lượt làm bài full đề (không phải luyện tập lẻ kỹ năng hay part)
        if (a.getTestScope() == TestScope.SINGLE_PART
                || a.getTestScope() == TestScope.MULTI_PART
                || a.getTestScope() == TestScope.SINGLE_SKILL) {
            return false;
        }

        if (exam == null) {
            return !"RAW_OBJECTIVE".equals(a.getScoreUnit()) && !"LEGACY_RAW".equals(a.getScoreUnit());
        }

        String type = exam.getType() != null ? exam.getType().trim().toUpperCase() : "";
        String titleLower = exam.getTitle() != null ? exam.getTitle().toLowerCase() : "";

        // 2. Không phải đề thi part lẻ
        boolean isPartCode = type.matches("^(IELTS_L[1-4]|IELTS_R[1-3]|IELTS_W[1-2])$")
                || type.matches("^TOEIC_P[1-7]$")
                || type.matches("^(TW_P[1-3]|TOEIC_W[1-3])$")
                || type.matches("^NLTV_(L[1-4]|R[1-2]|W[1-3])$");

        boolean hasPartTitle = titleLower.contains("passage ")
                || titleLower.contains("phần ")
                || titleLower.contains("part ");

        if (isPartCode || hasPartTitle) {
            return false;
        }

        // 3. Không phải đề thi 1 kỹ năng đơn lẻ
        boolean isSkillCode = type.equals("IELTS_LISTENING") || type.equals("IELTS_READING") || type.equals("IELTS_WRITING")
                || type.equals("TOEIC_LISTENING") || type.equals("TOEIC_READING")
                || type.equals("NLTV_LISTENING") || type.equals("NLTV_READING") || type.equals("NLTV_WRITING")
                || type.equals("NLTV_L") || type.equals("NLTV_R") || type.equals("NLTV_W");

        boolean hasSkillInTitle = titleLower.contains(" - listening")
                || titleLower.contains(" - reading")
                || titleLower.contains(" - writing")
                || titleLower.contains(" - nghe")
                || titleLower.contains(" - đọc")
                || titleLower.contains(" - viết");

        if (isSkillCode || hasSkillInTitle) {
            return false;
        }

        // 4. Nếu là TOEIC LR, đề thi phải là full đề (không phải lẻ listening hay reading)
        if (type.startsWith("TOEIC") && !type.contains("WRITING") && !type.startsWith("TW")) {
            if (isToeicSingleSkillExam(type)) {
                return false;
            }
        }

        return true;
    }
}
