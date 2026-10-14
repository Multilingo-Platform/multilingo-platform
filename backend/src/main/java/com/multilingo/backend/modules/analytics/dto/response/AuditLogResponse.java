package com.multilingo.backend.modules.analytics.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogResponse {

    private Integer id;
    private Integer userId;
    private String userEmail;
    private String userFullName;
    private String action;
    private String entityType;
    private String entityId;
    private Map<String, Object> details;
    private String ipAddress;
    private Instant createdAt;
}
