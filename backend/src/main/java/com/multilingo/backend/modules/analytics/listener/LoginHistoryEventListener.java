package com.multilingo.backend.modules.analytics.listener;

import com.multilingo.backend.modules.analytics.service.LoginHistoryService;
import com.multilingo.backend.modules.auth.event.UserLoginEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class LoginHistoryEventListener {

    private final LoginHistoryService loginHistoryService;

    @EventListener
    public void onUserLogin(UserLoginEvent event) {
        if (event == null || event.userId() == null) {
            return;
        }
        log.info("Received UserLoginEvent for userId: {}, ip: {}, status: {}", event.userId(), event.ipAddress(), event.status());
        loginHistoryService.recordLogin(
                event.userId(),
                event.ipAddress() != null ? event.ipAddress() : "127.0.0.1",
                event.deviceInfo() != null ? event.deviceInfo() : "Unknown Device",
                event.status() != null ? event.status() : "SUCCESS"
        );
    }
}
