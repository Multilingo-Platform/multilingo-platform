package com.multilingo.backend.modules.billing.repository;

import com.multilingo.backend.modules.billing.entity.SubscriptionPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SubscriptionPlanRepository extends JpaRepository<SubscriptionPlan, Integer> {
    Optional<SubscriptionPlan> findByCode(String code);
    boolean existsByCode(String code);
}
