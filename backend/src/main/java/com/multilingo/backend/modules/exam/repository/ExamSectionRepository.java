package com.multilingo.backend.modules.exam.repository;

import com.multilingo.backend.modules.exam.entity.ExamSection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ExamSectionRepository extends JpaRepository<ExamSection, Integer> {
    
    @Modifying
    @Query("DELETE FROM ExamSection s WHERE s.exam.id = :examId")
    void deleteByExam_Id(@Param("examId") Integer examId);
}
