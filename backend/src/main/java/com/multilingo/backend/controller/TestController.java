package com.multilingo.backend.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/test")
public class TestController {

    @GetMapping("/hello")
    public ResponseEntity<ApiResponse<Map<String, String>>> sayHello() {
        Map<String, String> data = new HashMap<>();
        data.put("message", "Hello from Spring Boot Backend!");
        data.put("status", "success");
        return ResponseEntity.ok(ApiResponse.success("Hello API", data));
    }
}
