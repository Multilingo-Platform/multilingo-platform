package com.multilingo.backend.modules.exam.repository;

import com.multilingo.backend.modules.exam.entity.Exam;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface ExamRepository extends JpaRepository<Exam, Integer> {
    Optional<Exam> findByCode(String code);

    @Query("SELECT e FROM Exam e WHERE e.isPublished = true " +
           "AND LOWER(e.title) LIKE LOWER(CONCAT('%', :title, '%')) " +
           "AND (:hasTypes = false OR e.type IN :types)")
    Page<Exam> findPublishedExams(@Param("title") String title, @Param("types") List<String> types, @Param("hasTypes") boolean hasTypes, Pageable pageable);
}
