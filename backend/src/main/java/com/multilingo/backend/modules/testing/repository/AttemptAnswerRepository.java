package com.multilingo.backend.modules.testing.repository;

import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AttemptAnswerRepository extends JpaRepository<AttemptAnswer, Integer> {

    List<AttemptAnswer> findByAttemptId(Integer attemptId);

    Optional<AttemptAnswer> findByAttemptIdAndPartId(Integer attemptId, Integer partId);
}
