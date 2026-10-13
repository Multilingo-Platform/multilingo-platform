package com.multilingo.backend.modules.analytics.service;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.analytics.dto.response.AuditLogResponse;
import org.springframework.data.domain.Pageable;

import java.time.Instant;

public interface AuditService {

    PageResponse<AuditLogResponse> getAuditLogs(
            Integer userId,
            String action,
            String entityType,
            Instant fromDate,
            Instant toDate,
            Pageable pageable
    );

    AuditLogResponse getAuditLogDetail(Integer logId);

    void log(Integer userId, String action, String entityType, String entityId, java.util.Map<String, Object> details, String ipAddress);
}
