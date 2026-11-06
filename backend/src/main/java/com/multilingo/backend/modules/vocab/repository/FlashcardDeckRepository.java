package com.multilingo.backend.modules.vocab.repository;

import com.multilingo.backend.modules.vocab.entity.FlashcardDeck;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FlashcardDeckRepository extends JpaRepository<FlashcardDeck, Integer> {

    List<FlashcardDeck> findAllByUserIdOrderByCreatedAtDesc(Integer userId);

    long countByUserId(Integer userId);

    Optional<FlashcardDeck> findByIdAndUserId(Integer id, Integer userId);

    boolean existsByIdAndUserId(Integer id, Integer userId);

    boolean existsByUserIdAndNameIgnoreCase(Integer userId, String name);

    boolean existsByUserIdAndNameIgnoreCaseAndIdNot(Integer userId, String name, Integer id);

    @Query("""
        SELECT d FROM FlashcardDeck d
        WHERE (cast(:pattern as string) IS NULL
               OR LOWER(d.name) LIKE cast(:pattern as string)
               OR (d.description IS NOT NULL AND LOWER(d.description) LIKE cast(:pattern as string)))
          AND (cast(:targetLanguage as string) IS NULL OR LOWER(d.targetLanguage) = cast(:targetLanguage as string))
          AND (:isPublic IS NULL OR d.isPublic = :isPublic)
    """)
    Page<FlashcardDeck> findAllWithFilters(
            @Param("pattern") String pattern,
            @Param("targetLanguage") String targetLanguage,
            @Param("isPublic") Boolean isPublic,
            Pageable pageable
    );
}
