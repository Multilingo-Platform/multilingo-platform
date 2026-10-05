package com.multilingo.backend.modules.testing.entity.enums;

public enum SubmitReason {
    MANUAL,          // Học viên chủ động bấm nút "Nộp bài"
    TIMEOUT_CLIENT,  // Client countdown về 00:00 và tự động gửi submit
    TIMEOUT_SERVER   // Server thu bài (Lazy Finalize hoặc Cron Scheduler)
}
