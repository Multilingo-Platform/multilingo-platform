package com.multilingo.backend.modules.auth.event;

public record UserLoginEvent(
        Integer userId,
        String email,
        String ipAddress,
        String deviceInfo,
        String status
) {
}
