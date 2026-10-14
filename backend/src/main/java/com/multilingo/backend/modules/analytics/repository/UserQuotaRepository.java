package com.multilingo.backend.modules.analytics.repository;

import com.multilingo.backend.modules.analytics.entity.UserQuota;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserQuotaRepository extends JpaRepository<UserQuota, Integer> {

    Optional<UserQuota> findByUserIdAndFeatureCode(Integer userId, String featureCode);

    List<UserQuota> findByFeatureCode(String featureCode);

    @Query("SELECT DISTINCT q.featureCode FROM UserQuota q ORDER BY q.featureCode ASC")
    List<String> findDistinctFeatureCodes();
}
