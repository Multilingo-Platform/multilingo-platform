package com.multilingo.backend.modules.testing.adapter.repository;

import com.multilingo.backend.modules.testing.adapter.entity.AttemptListeningPlayback;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AttemptListeningPlaybackRepository extends JpaRepository<AttemptListeningPlayback, Integer> {

    Optional<AttemptListeningPlayback> findByAttemptId(Integer attemptId);

    boolean existsByAttemptId(Integer attemptId);

    @org.springframework.transaction.annotation.Transactional
    void deleteByAttemptId(Integer attemptId);
}
