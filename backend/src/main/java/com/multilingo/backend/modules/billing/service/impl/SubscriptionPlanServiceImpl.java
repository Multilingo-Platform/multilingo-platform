package com.multilingo.backend.modules.billing.service.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.billing.dto.request.SubscriptionPlanRequest;
import com.multilingo.backend.modules.billing.dto.response.SubscriptionPlanResponse;
import com.multilingo.backend.modules.billing.entity.SubscriptionPlan;
import com.multilingo.backend.modules.billing.mapper.SubscriptionPlanMapper;
import com.multilingo.backend.modules.billing.repository.SubscriptionPlanRepository;
import com.multilingo.backend.modules.billing.service.SubscriptionPlanService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SubscriptionPlanServiceImpl implements SubscriptionPlanService {

    SubscriptionPlanRepository planRepository;
    SubscriptionPlanMapper planMapper;

    @Override
    @Transactional(readOnly = true)
    public List<SubscriptionPlanResponse> getAllPlans() {
        return planRepository.findAll().stream()
                .map(planMapper::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public SubscriptionPlanResponse createPlan(SubscriptionPlanRequest request) {
        if (planRepository.existsByCode(request.getCode())) {
            throw new AppException(ErrorCode.PLAN_CODE_EXISTED);
        }

        SubscriptionPlan plan = planMapper.toEntity(request);
        plan.setIsActive(true);

        plan = planRepository.save(plan);
        return planMapper.toResponse(plan);
    }

    @Override
    @Transactional
    public SubscriptionPlanResponse updatePlan(Integer id, SubscriptionPlanRequest request) {
        SubscriptionPlan plan = planRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.PLAN_NOT_FOUND));

        planMapper.updateEntity(plan, request);

        plan = planRepository.save(plan);
        return planMapper.toResponse(plan);
    }

    @Override
    @Transactional
    public SubscriptionPlanResponse changeStatus(Integer id, boolean isActive) {
        SubscriptionPlan plan = planRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.PLAN_NOT_FOUND));

        plan.setIsActive(isActive);
        plan = planRepository.save(plan);
        return planMapper.toResponse(plan);
    }
}
