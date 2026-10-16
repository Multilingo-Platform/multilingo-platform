package com.multilingo.backend.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "vocab.test")
public class VocabTestProperties {

    /** Thời gian làm bài cho mỗi câu hỏi (giây) - mặc định 60s */
    private int secondsPerQuestion = 60;

    /** Dung sai trễ mạng cho phép nộp bài sau expires_at (giây) - mặc định 10s */
    private int submissionGraceSeconds = 10;

    /** Khoảng thời gian định kỳ giữa các lần quét timeout (ms) - mặc định 60000ms (1 phút) */
    private long timeoutScanDelayMs = 60000L;
}
