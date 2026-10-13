package com.multilingo.backend.modules.analytics.service.impl;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.analytics.adapter.UserAccountAdapter;
import com.multilingo.backend.modules.analytics.adapter.dto.UserAccountInfo;
import com.multilingo.backend.modules.analytics.dto.response.AuditLogResponse;
import com.multilingo.backend.modules.analytics.entity.AuditLog;
import com.multilingo.backend.modules.analytics.repository.AuditLogRepository;
import com.multilingo.backend.modules.analytics.service.AuditService;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditServiceImpl implements AuditService {

    private final AuditLogRepository auditLogRepository;
    private final UserAccountAdapter userAccountAdapter;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AuditLogResponse> getAuditLogs(
            Integer userId,
            String action,
            String entityType,
            Instant fromDate,
            Instant toDate,
            Pageable pageable
    ) {
        Specification<AuditLog> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (userId != null) {
                predicates.add(cb.equal(root.get("userId"), userId));
            }

            if (action != null && !action.isBlank()) {
                predicates.add(cb.equal(root.get("action"), action.trim()));
            }

            if (entityType != null && !entityType.isBlank()) {
                predicates.add(cb.equal(root.get("entityType"), entityType.trim()));
            }

            if (fromDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), fromDate));
            }

            if (toDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), toDate));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<AuditLog> page = auditLogRepository.findAll(spec, pageable);

        // Preload user information via adapter
        Set<Integer> userIds = page.getContent().stream()
                .map(AuditLog::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<Integer, UserAccountInfo> userMap = userAccountAdapter.findUsersByIds(userIds);

        Page<AuditLogResponse> dtoPage = page.map(logItem -> mapToResponse(logItem, userMap.get(logItem.getUserId())));
        return PageResponse.from(dtoPage);
    }

    @Override
    @Transactional(readOnly = true)
    public AuditLogResponse getAuditLogDetail(Integer logId) {
        AuditLog auditLog = auditLogRepository.findById(logId)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND));

        UserAccountInfo user = null;
        if (auditLog.getUserId() != null) {
            user = userAccountAdapter.findUserById(auditLog.getUserId()).orElse(null);
        }

        return mapToResponse(auditLog, user);
    }

    @Override
    @Transactional
    public void log(Integer userId, String action, String entityType, String entityId, Map<String, Object> details, String ipAddress) {
        AuditLog auditLog = AuditLog.builder()
                .userId(userId)
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .details(details)
                .ipAddress(ipAddress)
                .build();
        auditLogRepository.save(auditLog);
        log.info("Recorded audit log: action={}, entityType={}, entityId={}, userId={}", action, entityType, entityId, userId);
    }

    private AuditLogResponse mapToResponse(AuditLog logItem, UserAccountInfo user) {
        return AuditLogResponse.builder()
                .id(logItem.getId())
                .userId(logItem.getUserId())
                .userEmail(user != null ? user.getEmail() : null)
                .userFullName(user != null ? user.getFullName() : null)
                .action(logItem.getAction())
                .entityType(logItem.getEntityType())
                .entityId(logItem.getEntityId())
                .details(logItem.getDetails())
                .ipAddress(logItem.getIpAddress())
                .createdAt(logItem.getCreatedAt())
                .build();
    }
}
