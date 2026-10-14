package com.multilingo.backend.modules.analytics.adapter;

import com.multilingo.backend.modules.analytics.adapter.dto.UserStudyStatInfo;

import java.util.Optional;

public interface GamificationTrackingAdapter {

    Optional<UserStudyStatInfo> findStudyStatByUserId(Integer userId);
}
