package com.multilingo.backend.repository;

import com.multilingo.backend.entity.ExamPart;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ExamPartRepository extends JpaRepository<ExamPart, UUID> {
}
