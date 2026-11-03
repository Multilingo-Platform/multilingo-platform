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
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
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
                case "TOEIC" -> "TOEIC_SCALED";
                default -> "RAW_OBJECTIVE";
            };
            List<Double> comparable = entry.getValue().getOrDefault(preferredUnit, List.of());
            if ((comparable == null || comparable.isEmpty()) && !"IELTS".equals(entry.getKey()) && !"TOEIC".equals(entry.getKey())) {
                comparable = new ArrayList<>();
                comparable.addAll(entry.getValue().getOrDefault("RAW_OBJECTIVE", List.of()));
                comparable.addAll(entry.getValue().getOrDefault("LEGACY_RAW", List.of()));
            }
            if (!comparable.isEmpty()) {
                double mean = comparable.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
                averageScoresByType.put(entry.getKey(), Math.round(mean * 10.0) / 10.0);
            }
            Double highest = highestByCertGroup.getOrDefault(entry.getKey(), java.util.Map.of()).get(preferredUnit);
            if (highest == null && !"IELTS".equals(entry.getKey()) && !"TOEIC".equals(entry.getKey())) {
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
                userId, AttemptStatus.COMPLETED, resolvedLang, hasLang, certPrefix, hasCert, PageRequest.of(0, 10)
        );
        List<RecentScoreTrendItem> trends = new java.util.ArrayList<>();
        long targetAchievedCount = 0;

        for (Object[] record : recentRows) {
            TestAttempt attempt = (TestAttempt) record[0];
            Exam exam = (Exam) record[1];
            String title = exam != null ? exam.getTitle() : "Đề thi #" + attempt.getExamId();
            String examType = exam != null ? exam.getType() : "";
            String scoreUnit = attempt.getScoreUnit() == null ? "LEGACY_RAW" : attempt.getScoreUnit();
            Double maxScore = resolveMaxScore(examType, scoreUnit);
            String itemCertType = resolveCertType(examType);

            Double score = attempt.getOverallScore() != null ? attempt.getOverallScore().doubleValue() : null;
            Double percentage = (score != null && maxScore != null && maxScore > 0)
                    ? Math.min(100.0, (score / maxScore) * 100.0) : null;

            if (score != null && targetScoreVal != null && targetScoreCertMatches(userTargetCert, itemCertType)
                    && !"RAW_OBJECTIVE".equals(scoreUnit) && !"LEGACY_RAW".equals(scoreUnit) && score >= targetScoreVal) {
                targetAchievedCount++;
            }

            trends.add(RecentScoreTrendItem.builder()
                    .attemptId(attempt.getId())
                    .examTitle(title)
                    .certType(itemCertType)
                    .score(score)
                    .maxScore(maxScore)
                    .percentage(percentage == null ? null : Math.round(percentage * 10.0) / 10.0)
                    .scoreUnit(scoreUnit)
                    .completedAt(attempt.getEndTime() != null ? attempt.getEndTime() : attempt.getCreatedAt())
                    .build());
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
            Double maxScore = resolveMaxScore(examType, scoreUnit);
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
        if ("IELTS_BAND".equals(scoreUnit)) return 9.0;
        if ("TOEIC_SCALED".equals(scoreUnit)) return 990.0;
        if (scoreUnit == null || "RAW_OBJECTIVE".equals(scoreUnit) || scoreUnit.endsWith("RAW")) return null;
        if (examType == null) return 100.0;
        String upper = examType.toUpperCase();
        if (upper.startsWith("IELTS")) return 9.0;
        if (upper.startsWith("TOEIC")) {
            if (upper.contains("WRITING")) return 200.0;
            return 990.0;
        }
        if (upper.startsWith("NLTV")) return 10.0;
        return 100.0;
    }

    private boolean targetScoreCertMatches(String targetCert, String resultCert) {
        return targetCert != null && targetCert.equals(resultCert);
    }

    private String resolveCertType(String examType) {
        if (examType == null) return "OTHER";
        String upper = examType.toUpperCase();
        if (upper.startsWith("IELTS")) return "IELTS";
        if (upper.startsWith("TOEIC")) return "TOEIC";
        if (upper.startsWith("NLTV")) return "NLTV";
        return "OTHER";
    }
}
