package com.multilingo.backend.modules.exam.repository;

import com.multilingo.backend.modules.exam.entity.ExamPart;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ExamPartRepository extends JpaRepository<ExamPart, Integer> {
    
    @Modifying
    @Query("DELETE FROM ExamPart p WHERE p.section.id IN :sectionIds")
    void deleteBySection_IdIn(@Param("sectionIds") List<Integer> sectionIds);

    List<ExamPart> findBySection_Id(Integer sectionId);
}
