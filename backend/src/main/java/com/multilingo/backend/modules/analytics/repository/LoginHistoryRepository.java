package com.multilingo.backend.modules.analytics.repository;

import com.multilingo.backend.modules.analytics.entity.LoginHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface LoginHistoryRepository extends JpaRepository<LoginHistory, Integer> {

    List<LoginHistory> findTop10ByUserIdOrderByLoginTimeDesc(Integer userId);

    @Query("SELECT COUNT(DISTINCT l.userId) FROM LoginHistory l WHERE l.loginTime >= :since AND l.status = 'SUCCESS'")
    long countDistinctActiveUsers(@Param("since") Instant since);
}
