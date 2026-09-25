package com.multilingo.backend.common.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class HealthCheckController {

    @GetMapping("/health")
    public ResponseEntity<ApiResponse<Map<String, Object>>> healthCheck() {
        Map<String, Object> status = new HashMap<>();
        status.put("status", "UP");
        status.put("timestamp", Instant.now());
        status.put("service", "multilingo-backend");

        return ResponseEntity.ok(ApiResponse.success("Server is healthy", status));
    }

    @GetMapping("/test/hello")
    public ResponseEntity<ApiResponse<Map<String, String>>> sayHello() {
        Map<String, String> data = new HashMap<>();
        data.put("message", "Hello from Multilingo Platform Backend!");
        data.put("status", "success");
        return ResponseEntity.ok(ApiResponse.success("Hello API", data));
    }
}
