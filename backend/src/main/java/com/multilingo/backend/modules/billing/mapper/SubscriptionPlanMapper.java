package com.multilingo.backend.modules.billing.mapper;

import com.multilingo.backend.modules.billing.dto.request.SubscriptionPlanRequest;
import com.multilingo.backend.modules.billing.dto.response.SubscriptionPlanResponse;
import com.multilingo.backend.modules.billing.entity.SubscriptionPlan;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

@Mapper(componentModel = "spring")
public interface SubscriptionPlanMapper {
    
    SubscriptionPlan toEntity(SubscriptionPlanRequest request);

    SubscriptionPlanResponse toResponse(SubscriptionPlan entity);

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void updateEntity(@MappingTarget SubscriptionPlan entity, SubscriptionPlanRequest request);
}
