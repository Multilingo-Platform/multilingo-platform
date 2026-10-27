package com.multilingo.backend.modules.gamification.service.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.repository.UserRepository;
import com.multilingo.backend.modules.auth.entity.UserTarget;
import com.multilingo.backend.modules.auth.repository.UserTargetRepository;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.gamification.constant.TimeRange;
import com.multilingo.backend.modules.gamification.dto.dashboard.*;
import com.multilingo.backend.modules.gamification.entity.DailyStudyLog;
import com.multilingo.backend.modules.gamification.entity.UserStudyStat;
import com.multilingo.backend.modules.gamification.repository.DailyStudyLogRepository;
import com.multilingo.backend.modules.gamification.repository.UserStudyStatRepository;
import com.multilingo.backend.modules.gamification.service.StudentDashboardService;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.vocab.dto.response.UserVocabStatsProjection;
import com.multilingo.backend.modules.vocab.repository.UserFlashcardRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.TextStyle;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class StudentDashboardServiceImpl implements StudentDashboardService {

        private final UserRepository userRepository;
        private final UserStudyStatRepository userStudyStatRepository;
        private final DailyStudyLogRepository dailyStudyLogRepository;
        private final TestAttemptRepository testAttemptRepository;
        private final UserFlashcardRepository userFlashcardRepository;
        private final ExamRepository examRepository;
        private final UserTargetRepository userTargetRepository;

        @Override
        @Transactional(readOnly = true)
        public StudentDashboardResponse getStudentDashboard(Integer userId, String timeRangeStr, Integer year) {
                log.info("Lấy dữ liệu Dashboard cho học viên: userId={}, timeRange={}, year={}", userId, timeRangeStr,
                                year);

                // 1. Lấy thông tin người dùng
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

                UserProfileSummary userProfile = UserProfileSummary.builder()
                                .id(user.getId())
                                .fullName(user.getFullName())
                                .avatarUrl(user.getAvatarUrl())
                                .targetLanguage(user.getTargetLanguage())
                                .build();

                // 2. Lấy thống kê Streak & EXP
                UserStudyStat studyStat = userStudyStatRepository.findByUserId(userId)
                                .orElseGet(() -> UserStudyStat.builder()
                                                .userId(userId)
                                                .currentStreak(0)
                                                .highestStreak(0)
                                                .totalLearningMinutes(0)
                                                .totalXp(0L)
                                                .build());

                LocalDate today = LocalDate.now();
                boolean isStudiedToday = studyStat.getLastStudyDate() != null
                                && studyStat.getLastStudyDate().equals(today);

                // 3. Lấy thống kê thi thử
                long totalExams = testAttemptRepository.countByUserIdAndStatus(userId, AttemptStatus.COMPLETED);
                Double avgScoreVal = testAttemptRepository.findAverageScoreByUserId(userId);
                double averageScore = avgScoreVal != null ? Math.round(avgScoreVal * 10.0) / 10.0 : 0.0;

                Optional<TestAttempt> latestAttemptOpt = testAttemptRepository
                                .findFirstByUserIdAndStatusOrderByEndTimeDesc(userId, AttemptStatus.COMPLETED);
                String latestExamTitle = null;
                Double latestExamScore = null;
                Instant latestExamDate = null;

                if (latestAttemptOpt.isPresent()) {
                        TestAttempt latest = latestAttemptOpt.get();
                        latestExamScore = latest.getOverallScore() != null ? latest.getOverallScore().doubleValue()
                                        : null;
                        latestExamDate = latest.getEndTime() != null ? latest.getEndTime() : latest.getCreatedAt();
                        if (latest.getExamId() != null) {
                                latestExamTitle = examRepository.findById(latest.getExamId())
                                                .map(Exam::getTitle)
                                                .orElse("Bài thi thử");
                        }
                }

                ExamStatsDto examStats = ExamStatsDto.builder()
                                .totalExamsTaken(totalExams)
                                .averageScore(averageScore)
                                .latestExamTitle(latestExamTitle)
                                .latestExamScore(latestExamScore)
                                .latestExamDate(latestExamDate)
                                .build();

                // 4. Lấy thống kê từ vựng
                UserVocabStatsProjection vocabProj = userFlashcardRepository.getUserVocabStats(userId, Instant.now());
                long totalWords = vocabProj != null && vocabProj.getTotalCards() != null ? vocabProj.getTotalCards()
                                : 0L;
                long masteredWords = vocabProj != null && vocabProj.getMasteredCards() != null
                                ? vocabProj.getMasteredCards()
                                : 0L;
                long learningWords = vocabProj != null && vocabProj.getLearningCards() != null
                                ? vocabProj.getLearningCards()
                                : 0L;
                long dueToday = vocabProj != null && vocabProj.getDueReviewCards() != null
                                ? vocabProj.getDueReviewCards()
                                : 0L;
                double masteryRate = totalWords > 0 ? Math.round((masteredWords * 100.0 / totalWords) * 10.0) / 10.0
                                : 0.0;

                VocabStatsDto vocabStats = VocabStatsDto.builder()
                                .totalWords(totalWords)
                                .masteredWords(masteredWords)
                                .learningWords(learningWords)
                                .masteryRate(masteryRate)
                                .dueTodayCount(dueToday)
                                .build();

                // 5. Xác định Tân học viên (Cold Start)
                boolean isNewUser = (totalExams == 0 && totalWords == 0);

                int currentStreak = isNewUser
                                && (studyStat.getCurrentStreak() == null || studyStat.getCurrentStreak() == 0)
                                                ? 1
                                                : (studyStat.getCurrentStreak() != null ? studyStat.getCurrentStreak()
                                                                : 0);
                int highestStreak = isNewUser
                                && (studyStat.getHighestStreak() == null || studyStat.getHighestStreak() == 0)
                                                ? 1
                                                : (studyStat.getHighestStreak() != null ? studyStat.getHighestStreak()
                                                                : 0);

                StreakStatsDto streak = StreakStatsDto.builder()
                                .currentStreak(currentStreak)
                                .highestStreak(highestStreak)
                                .totalLearningMinutes(studyStat.getTotalLearningMinutes() != null
                                                ? studyStat.getTotalLearningMinutes()
                                                : 0)
                                .totalXp(studyStat.getTotalXp() != null ? studyStat.getTotalXp() : 0L)
                                .isStudiedToday(isStudiedToday || isNewUser)
                                .lastStudyDate(studyStat.getLastStudyDate())
                                .build();

                // 6. Tính toán Activity Heatmap theo năm
                int targetYear = (year != null && year >= 2000) ? year : today.getYear();
                LocalDate yearStart = LocalDate.of(targetYear, 1, 1);
                LocalDate yearEnd = LocalDate.of(targetYear, 12, 31);

                List<DailyStudyLog> yearLogs = dailyStudyLogRepository.findAllByUserIdAndStudyDateBetween(userId,
                                yearStart, yearEnd);
                List<HeatmapDataPointDto> heatmapPoints = yearLogs.stream()
                                .map(l -> HeatmapDataPointDto.builder()
                                                .date(l.getStudyDate())
                                                .learningMinutes(l.getLearningMinutes() != null ? l.getLearningMinutes()
                                                                : 0)
                                                .flashcardsReviewed(l.getFlashcardsReviewed() != null
                                                                ? l.getFlashcardsReviewed()
                                                                : 0)
                                                .practiceQuestions(l.getPracticeQuestionsAnswered() != null
                                                                ? l.getPracticeQuestionsAnswered()
                                                                : 0)
                                                .xpEarned(l.getPracticeXpEarned() != null ? l.getPracticeXpEarned() : 0)
                                                .level(calculateHeatmapLevel(
                                                                l.getLearningMinutes() != null ? l.getLearningMinutes()
                                                                                : 0))
                                                .build())
                                .collect(Collectors.toList());

                int totalActiveDays = (int) heatmapPoints.stream()
                                .filter(p -> p.getLearningMinutes() != null && p.getLearningMinutes() > 0)
                                .count();

                if (isNewUser && heatmapPoints.isEmpty() && targetYear == today.getYear()) {
                        heatmapPoints.add(HeatmapDataPointDto.builder()
                                        .date(today)
                                        .learningMinutes(0)
                                        .flashcardsReviewed(0)
                                        .practiceQuestions(0)
                                        .xpEarned(0)
                                        .level(1)
                                        .build());
                        totalActiveDays = 1;
                }

                ActivityHeatmapDto activityHeatmap = ActivityHeatmapDto.builder()
                                .year(targetYear)
                                .totalActiveDays(totalActiveDays)
                                .longestStreak(highestStreak)
                                .dataPoints(heatmapPoints)
                                .build();

                // 7. Tính toán biểu đồ tiến độ theo mốc thời gian (Progress Chart - Gom nhóm
                // theo chu kỳ)
                TimeRange timeRange = TimeRange.fromString(timeRangeStr);
                List<DailyChartPointDto> chartPoints = new ArrayList<>();

                if (timeRange == TimeRange.THIS_MONTH) {
                        // Gom nhóm theo 4 Tuần trong tháng hiện tại
                        LocalDate monthStart = today.withDayOfMonth(1);
                        LocalDate monthEnd = today.withDayOfMonth(today.lengthOfMonth());
                        List<DailyStudyLog> monthLogs = dailyStudyLogRepository
                                        .findAllByUserIdAndStudyDateBetween(userId, monthStart, monthEnd);
                        Map<LocalDate, DailyStudyLog> logMap = monthLogs.stream()
                                        .collect(Collectors.toMap(DailyStudyLog::getStudyDate, l -> l, (a, b) -> a));

                        // Chia thành 4 tuần logic: ngày 1-7, 8-14, 15-21, 22 đến cuối tháng
                        int[][] weekRanges = {
                                        { 1, 7 },
                                        { 8, 14 },
                                        { 15, 21 },
                                        { 22, today.lengthOfMonth() }
                        };

                        for (int w = 0; w < weekRanges.length; w++) {
                                int startDay = weekRanges[w][0];
                                int endDay = weekRanges[w][1];
                                int weekMinutes = 0;
                                int weekQuestions = 0;
                                LocalDate weekDate = today.withDayOfMonth(startDay);

                                for (int d = startDay; d <= endDay; d++) {
                                        LocalDate date = today.withDayOfMonth(d);
                                        DailyStudyLog logEntry = logMap.get(date);
                                        if (logEntry != null) {
                                                if (logEntry.getLearningMinutes() != null)
                                                        weekMinutes += logEntry.getLearningMinutes();
                                                if (logEntry.getPracticeQuestionsAnswered() != null)
                                                        weekQuestions += logEntry.getPracticeQuestionsAnswered();
                                        }
                                }

                                chartPoints.add(DailyChartPointDto.builder()
                                                .date(weekDate)
                                                .label("Tuần " + (w + 1))
                                                .learningMinutes(weekMinutes)
                                                .questionsAnswered(weekQuestions)
                                                .build());
                        }

                } else if (timeRange == TimeRange.ALL) {
                        // Gom nhóm 12 tháng trong năm (chu kỳ năm)
                        Map<Integer, List<DailyStudyLog>> monthGroup = yearLogs.stream()
                                        .collect(Collectors.groupingBy(l -> l.getStudyDate().getMonthValue()));

                        for (int m = 1; m <= 12; m++) {
                                List<DailyStudyLog> mLogs = monthGroup.getOrDefault(m, Collections.emptyList());
                                int mMinutes = mLogs.stream().mapToInt(
                                                l -> l.getLearningMinutes() != null ? l.getLearningMinutes() : 0).sum();
                                int mQuestions = mLogs.stream()
                                                .mapToInt(l -> l.getPracticeQuestionsAnswered() != null
                                                                ? l.getPracticeQuestionsAnswered()
                                                                : 0)
                                                .sum();

                                chartPoints.add(DailyChartPointDto.builder()
                                                .date(LocalDate.of(targetYear, m, 1))
                                                .label("Th" + m)
                                                .learningMinutes(mMinutes)
                                                .questionsAnswered(mQuestions)
                                                .build());
                        }

                } else {
                        // THIS_WEEK: 7 ngày gần nhất
                        LocalDate rangeStart = today.minusDays(6);
                        LocalDate rangeEnd = today;
                        List<DailyStudyLog> rangeLogs = dailyStudyLogRepository
                                        .findAllByUserIdAndStudyDateBetween(userId, rangeStart, rangeEnd);
                        Map<LocalDate, DailyStudyLog> logMap = rangeLogs.stream()
                                        .collect(Collectors.toMap(DailyStudyLog::getStudyDate, l -> l, (a, b) -> a));

                        LocalDate curr = rangeStart;
                        while (!curr.isAfter(rangeEnd)) {
                                DailyStudyLog logEntry = logMap.get(curr);
                                int minutes = logEntry != null && logEntry.getLearningMinutes() != null
                                                ? logEntry.getLearningMinutes()
                                                : 0;
                                int questions = logEntry != null && logEntry.getPracticeQuestionsAnswered() != null
                                                ? logEntry.getPracticeQuestionsAnswered()
                                                : 0;

                                String label = formatDayLabel(curr);
                                chartPoints.add(DailyChartPointDto.builder()
                                                .date(curr)
                                                .label(label)
                                                .learningMinutes(minutes)
                                                .questionsAnswered(questions)
                                                .build());
                                curr = curr.plusDays(1);
                        }
                }

                ProgressChartDto progressChart = ProgressChartDto.builder()
                                .timeRange(timeRange.name())
                                .dataPoints(chartPoints)
                                .build();

                // 8. Đề xuất hành động học tập (Mặc định 2 hành động chuẩn hệ thống)
                List<SuggestedActionDto> actions = List.of(
                                SuggestedActionDto.builder()
                                                .type("VOCAB_REVIEW")
                                                .title("Ôn tập từ vựng hôm nay")
                                                .description("Củng cố trí nhớ dài hạn bằng phương pháp lặp lại ngắt quãng (SRS) cho các thẻ từ vựng của bạn.")
                                                .badge("Từ vựng")
                                                .actionUrl("/student/flashcards")
                                                .buttonText("Ôn tập ngay")
                                                .build(),
                                SuggestedActionDto.builder()
                                                .type("EXAM_PRACTICE")
                                                .title("Luyện đề thi thử tiếp theo")
                                                .description("Cải thiện kỹ năng làm bài, duy trì phản xạ phòng thi và đánh giá sự tiến bộ qua từng bộ đề.")
                                                .badge("Luyện tập")
                                                .actionUrl("/student/library")
                                                .buttonText("Vào thư viện đề")
                                                .build());

                // 9. Tính toán GoalProgressDto từ mục tiêu và 5 bài thi gần nhất
                Optional<UserTarget> userTargetOpt = userTargetRepository.findFirstByUserId(userId);
                GoalProgressDto goalProgress = null;
                if (userTargetOpt.isPresent()) {
                        UserTarget target = userTargetOpt.get();
                        String targetCertificate = target.getTargetCertificate();
                        Double targetScore = target.getTargetScore() != null ? target.getTargetScore().doubleValue() : null;

                        String certCategory = resolveCertCategory(targetCertificate);
                        List<TestAttempt> top5Attempts = testAttemptRepository
                                        .findTopRecentAttemptsByCertCategory(
                                                userId,
                                                AttemptStatus.COMPLETED,
                                                certCategory,
                                                targetCertificate != null ? targetCertificate.toUpperCase() : "",
                                                org.springframework.data.domain.PageRequest.of(0, 5)
                                        );

                        List<TestAttempt> chronologicalAttempts = new ArrayList<>(top5Attempts);
                        Collections.reverse(chronologicalAttempts);

                        List<RecentExamScoreDto> recentScores = new ArrayList<>();
                        double sumScore = 0.0;
                        int validScoreCount = 0;

                        Double maxScore = 9.0;
                        if ("TOEIC_LR".equals(certCategory)) {
                                maxScore = 990.0;
                        } else if ("TOEIC_WRITING".equals(certCategory)) {
                                maxScore = 200.0;
                        } else if ("NLTV".equals(certCategory)) {
                                maxScore = 6.0;
                        }

                        for (TestAttempt attempt : chronologicalAttempts) {
                                String title = "Bài thi";
                                if (attempt.getExamId() != null) {
                                        title = examRepository.findById(attempt.getExamId())
                                                        .map(Exam::getTitle)
                                                        .orElse("Bài thi #" + attempt.getExamId());
                                }
                                Double score = attempt.getOverallScore() != null ? attempt.getOverallScore().doubleValue() : null;
                                Double pct = (score != null && maxScore > 0) ? Math.round((score / maxScore * 100.0) * 10.0) / 10.0 : null;
                                LocalDateTime completedAt = attempt.getEndTime() != null
                                                ? LocalDateTime.ofInstant(attempt.getEndTime(), ZoneId.systemDefault())
                                                : (attempt.getCreatedAt() != null ? LocalDateTime.ofInstant(attempt.getCreatedAt(), ZoneId.systemDefault()) : null);

                                if (score != null) {
                                        sumScore += score;
                                        validScoreCount++;
                                }

                                recentScores.add(RecentExamScoreDto.builder()
                                                .attemptId(attempt.getId())
                                                .examTitle(title)
                                                .score(score)
                                                .maxScore(maxScore)
                                                .percentage(pct)
                                                .completedAt(completedAt)
                                                .build());
                        }

                        Double recentAverageScore = null;
                        Integer progressPercent = 0;
                        if (validScoreCount > 0) {
                                double rawAvg = sumScore / validScoreCount;
                                if ("TOEIC_LR".equals(certCategory) || "TOEIC_WRITING".equals(certCategory)) {
                                        recentAverageScore = (double) Math.round(rawAvg);
                                } else {
                                        recentAverageScore = Math.round(rawAvg * 10.0) / 10.0;
                                }

                                if (targetScore != null && targetScore > 0) {
                                        progressPercent = (int) Math.min(100, Math.round((recentAverageScore / targetScore) * 100));
                                }
                        }

                        goalProgress = GoalProgressDto.builder()
                                        .targetCertificate(targetCertificate)
                                        .targetScore(targetScore)
                                        .recentAverageScore(recentAverageScore)
                                        .progressPercent(progressPercent)
                                        .recentExamCount(top5Attempts.size())
                                        .recentScores(recentScores)
                                        .build();
                }

                return StudentDashboardResponse.builder()
                                .isNewUser(isNewUser)
                                .userProfile(userProfile)
                                .streak(streak)
                                .examStats(examStats)
                                .vocabStats(vocabStats)
                                .activityHeatmap(activityHeatmap)
                                .progressChart(progressChart)
                                .suggestedActions(actions)
                                .goalProgress(goalProgress)
                                .build();
        }

        private int calculateHeatmapLevel(int minutes) {
                if (minutes <= 0)
                        return 0;
                if (minutes <= 15)
                        return 1;
                if (minutes <= 30)
                        return 2;
                if (minutes <= 60)
                        return 3;
                return 4;
        }

        private String formatDayLabel(LocalDate date) {
                DayOfWeek dow = date.getDayOfWeek();
                switch (dow) {
                        case MONDAY:
                                return "T2";
                        case TUESDAY:
                                return "T3";
                        case WEDNESDAY:
                                return "T4";
                        case THURSDAY:
                                return "T5";
                        case FRIDAY:
                                return "T6";
                        case SATURDAY:
                                return "T7";
                        case SUNDAY:
                                return "CN";
                        default:
                                return date.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.getDefault());
                }
        }

        private String resolveCertCategory(String targetCertificate) {
                if (targetCertificate == null) return "OTHER";
                String upper = targetCertificate.toUpperCase();
                if (upper.startsWith("IELTS")) return "IELTS";
                if (upper.equals("TOEIC_WRITING") || upper.equals("TW")) return "TOEIC_WRITING";
                if (upper.startsWith("TOEIC")) return "TOEIC_LR";
                if (upper.startsWith("NLTV")) return "NLTV";
                return "OTHER";
        }
}
