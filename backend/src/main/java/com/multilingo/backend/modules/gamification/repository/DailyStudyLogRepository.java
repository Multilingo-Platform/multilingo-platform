package com.multilingo.backend.modules.gamification.repository;

import com.multilingo.backend.modules.gamification.entity.DailyStudyLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface DailyStudyLogRepository extends JpaRepository<DailyStudyLog, Integer> {

    Optional<DailyStudyLog> findByUserIdAndStudyDate(Integer userId, LocalDate studyDate);

    List<DailyStudyLog> findAllByUserIdAndStudyDateBetween(Integer userId, LocalDate startDate, LocalDate endDate);
}
