package com.multilingo.backend.modules.analytics.service;

import com.multilingo.backend.modules.analytics.entity.LoginHistory;

import java.util.List;

public interface LoginHistoryService {

    List<LoginHistory> getRecentLoginHistory(Integer userId);

    boolean detectFraudRisk(Integer userId);

    void recordLogin(Integer userId, String ipAddress, String deviceInfo, String status);
}
