package com.multilingo.backend.modules.exam.repository;

import com.multilingo.backend.modules.exam.entity.Exam;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExamRepository extends JpaRepository<Exam, Integer> {
}
