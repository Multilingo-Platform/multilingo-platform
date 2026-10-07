package com.multilingo.backend.modules.billing.service;

import com.multilingo.backend.modules.billing.dto.request.SubscriptionPlanRequest;
import com.multilingo.backend.modules.billing.dto.response.SubscriptionPlanResponse;

import java.util.List;

public interface SubscriptionPlanService {
    List<SubscriptionPlanResponse> getAllPlans();
    SubscriptionPlanResponse createPlan(SubscriptionPlanRequest request);
    SubscriptionPlanResponse updatePlan(Integer id, SubscriptionPlanRequest request);
    SubscriptionPlanResponse changeStatus(Integer id, boolean isActive);
}
