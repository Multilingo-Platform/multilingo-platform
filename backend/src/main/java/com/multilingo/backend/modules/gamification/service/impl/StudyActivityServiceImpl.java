package com.multilingo.backend.modules.gamification.service.impl;

import com.multilingo.backend.modules.gamification.constant.GamificationConstants;
import com.multilingo.backend.modules.gamification.dto.StudyActivityRecord;
import com.multilingo.backend.modules.gamification.dto.StudyActivitySummary;
import com.multilingo.backend.modules.gamification.entity.DailyStudyLog;
import com.multilingo.backend.modules.gamification.entity.UserStudyStat;
import com.multilingo.backend.modules.gamification.mapper.StudyActivityMapper;
import com.multilingo.backend.modules.gamification.repository.DailyStudyLogRepository;
import com.multilingo.backend.modules.gamification.repository.UserStudyStatRepository;
import com.multilingo.backend.modules.gamification.service.StudyActivityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Slf4j
@Service
@RequiredArgsConstructor
public class StudyActivityServiceImpl implements StudyActivityService {

    private final UserStudyStatRepository userStudyStatRepository;
    private final DailyStudyLogRepository dailyStudyLogRepository;
    private final StudyActivityMapper studyActivityMapper;

    @Override
    @Transactional
    public StudyActivitySummary recordActivity(StudyActivityRecord record) {
        Integer userId = record.getUserId();
        int studyMinutes = record.getStudyMinutes() != null ? Math.max(0, record.getStudyMinutes()) : 0;
        int cardsReviewed = record.getCardsReviewed() != null ? Math.max(0, record.getCardsReviewed()) : 0;
        LocalDate today = LocalDate.now();

        log.info("Ghi nhận hoạt động học: userId={}, activityType={}, studyMinutes={}, cardsReviewed={}",
                userId, record.getActivityType(), studyMinutes, cardsReviewed);

        // 1. Khóa và lấy bản ghi thống kê người dùng (tránh xung đột dữ liệu đa luồng)
        UserStudyStat studyStat = userStudyStatRepository.findByUserIdWithLock(userId)
                .orElseGet(() -> UserStudyStat.builder()
                        .userId(userId)
                        .currentStreak(0)
                        .highestStreak(0)
                        .totalLearningMinutes(0)
                        .build());

        LocalDate lastStudyDate = studyStat.getLastStudyDate();
        int streakIncrement = 0;
        boolean streakExtended = false;

        boolean qualifiesForStreak = record.getQualifiesForStreak() == null || record.getQualifiesForStreak();
        if (qualifiesForStreak) {
            if (lastStudyDate == null) {
                studyStat.setCurrentStreak(1);
                studyStat.setLastStudyDate(today);
                streakIncrement = 1;
                streakExtended = true;
            } else if (!lastStudyDate.equals(today)) {
                if (lastStudyDate.equals(today.minusDays(1))) {
                    studyStat.setCurrentStreak(studyStat.getCurrentStreak() + 1);
                    streakIncrement = 1;
                } else {
                    studyStat.setCurrentStreak(1);
                    streakIncrement = 1;
                }
                studyStat.setLastStudyDate(today);
                streakExtended = true;
            }
        }

        if (studyStat.getCurrentStreak() > studyStat.getHighestStreak()) {
            studyStat.setHighestStreak(studyStat.getCurrentStreak());
        }
        studyStat.setTotalLearningMinutes(studyStat.getTotalLearningMinutes() + studyMinutes);
        long xpToAdd = record.getXpEarned() != null ? Math.max(0, record.getXpEarned()) : 0;
        studyStat.setTotalXp((studyStat.getTotalXp() != null ? studyStat.getTotalXp() : 0L) + xpToAdd);
        UserStudyStat savedStat = userStudyStatRepository.save(studyStat);

        // 2. Cập nhật nhật ký hàng ngày (daily_study_logs)
        DailyStudyLog dailyLog = dailyStudyLogRepository.findByUserIdAndStudyDate(userId, today)
                .orElseGet(() -> DailyStudyLog.builder()
                        .userId(userId)
                        .studyDate(today)
                        .learningMinutes(0)
                        .flashcardsDue(0)
                        .flashcardsReviewed(0)
                        .practiceSessions(0)
                        .practiceQuestionsAnswered(0)
                        .practiceCorrectAnswers(0)
                        .practiceXpEarned(0)
                        .build());

        dailyLog.setLearningMinutes(dailyLog.getLearningMinutes() + studyMinutes);
        dailyLog.setFlashcardsReviewed(dailyLog.getFlashcardsReviewed() + cardsReviewed);

        if (GamificationConstants.ACTIVITY_PRACTICE.equalsIgnoreCase(record.getActivityType())) {
            int currentSessions = dailyLog.getPracticeSessions() != null ? dailyLog.getPracticeSessions() : 0;
            dailyLog.setPracticeSessions(currentSessions + 1);
            int qAnswered = record.getQuestionsAnswered() != null ? record.getQuestionsAnswered() : 0;
            int curQAnswered = dailyLog.getPracticeQuestionsAnswered() != null ? dailyLog.getPracticeQuestionsAnswered() : 0;
            dailyLog.setPracticeQuestionsAnswered(curQAnswered + qAnswered);
            int cAnswered = record.getCorrectAnswers() != null ? record.getCorrectAnswers() : 0;
            int curCAnswered = dailyLog.getPracticeCorrectAnswers() != null ? dailyLog.getPracticeCorrectAnswers() : 0;
            dailyLog.setPracticeCorrectAnswers(curCAnswered + cAnswered);
            int curXp = dailyLog.getPracticeXpEarned() != null ? dailyLog.getPracticeXpEarned() : 0;
            dailyLog.setPracticeXpEarned(curXp + (int) xpToAdd);
        }
        DailyStudyLog savedDailyLog = dailyStudyLogRepository.save(dailyLog);

        log.info("Hoàn tất cập nhật thống kê học tập: userId={}, currentStreak={}, highestStreak={}, todayMinutes={}",
                userId, savedStat.getCurrentStreak(), savedStat.getHighestStreak(), savedDailyLog.getLearningMinutes());

        return studyActivityMapper.toSummary(
                savedStat,
                savedDailyLog,
                streakIncrement,
                streakExtended
        );
    }
}
