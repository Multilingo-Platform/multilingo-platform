package com.multilingo.backend.modules.analytics.service.impl;

import com.multilingo.backend.modules.analytics.entity.LoginHistory;
import com.multilingo.backend.modules.analytics.repository.LoginHistoryRepository;
import com.multilingo.backend.modules.analytics.service.LoginHistoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
@Slf4j
public class LoginHistoryServiceImpl implements LoginHistoryService {

    private final LoginHistoryRepository loginHistoryRepository;

    @Override
    @Transactional(readOnly = true)
    public List<LoginHistory> getRecentLoginHistory(Integer userId) {
        if (userId == null) {
            return List.of();
        }
        return loginHistoryRepository.findTop10ByUserIdOrderByLoginTimeDesc(userId);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean detectFraudRisk(Integer userId) {
        if (userId == null) {
            return false;
        }
        List<LoginHistory> histories = loginHistoryRepository.findTop10ByUserIdOrderByLoginTimeDesc(userId);
        if (histories == null || histories.size() < 2) {
            return false;
        }
        long distinctIps = histories.stream()
                .map(LoginHistory::getIpAddress)
                .filter(Objects::nonNull)
                .distinct()
                .count();
        return distinctIps >= 3;
    }

    @Override
    @Transactional
    public void recordLogin(Integer userId, String ipAddress, String deviceInfo, String status) {
        LoginHistory history = LoginHistory.builder()
                .userId(userId)
                .ipAddress(ipAddress)
                .deviceInfo(deviceInfo)
                .status(status != null ? status : "SUCCESS")
                .loginTime(Instant.now())
                .build();
        loginHistoryRepository.save(history);
        log.info("Recorded login history for userId: {}, ip: {}", userId, ipAddress);
    }
}
