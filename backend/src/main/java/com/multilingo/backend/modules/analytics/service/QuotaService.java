package com.multilingo.backend.modules.analytics.service;

import com.multilingo.backend.modules.analytics.dto.request.UpdateQuotaRequest;
import com.multilingo.backend.modules.analytics.dto.response.UserQuotaResponse;

import java.util.List;

public interface QuotaService {

    List<UserQuotaResponse> getAllQuotas();

    UserQuotaResponse updateQuota(Integer currentAdminId, UpdateQuotaRequest request, String ipAddress);
}
