package com.multilingo.backend.modules.analytics.adapter.impl;

import com.multilingo.backend.modules.analytics.adapter.GamificationTrackingAdapter;
import com.multilingo.backend.modules.analytics.adapter.dto.UserStudyStatInfo;
import com.multilingo.backend.modules.gamification.entity.UserStudyStat;
import com.multilingo.backend.modules.gamification.repository.UserStudyStatRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Component
@RequiredArgsConstructor
public class DbGamificationTrackingAdapter implements GamificationTrackingAdapter {

    private final UserStudyStatRepository userStudyStatRepository;

    @Override
    @Transactional(readOnly = true)
    public Optional<UserStudyStatInfo> findStudyStatByUserId(Integer userId) {
        if (userStudyStatRepository == null) {
            return Optional.empty();
        }
        return userStudyStatRepository.findByUserId(userId)
                .map(stat -> UserStudyStatInfo.builder()
                        .userId(stat.getUserId())
                        .currentStreak(stat.getCurrentStreak() != null ? stat.getCurrentStreak() : 0)
                        .highestStreak(stat.getHighestStreak() != null ? stat.getHighestStreak() : 0)
                        .totalLearningMinutes(stat.getTotalLearningMinutes() != null ? stat.getTotalLearningMinutes() : 0)
                        .totalXp(stat.getTotalXp() != null ? stat.getTotalXp() : 0L)
                        .build());
    }
}
