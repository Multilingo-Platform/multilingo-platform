package com.multilingo.backend.modules.vocab.repository;

import com.multilingo.backend.modules.vocab.dto.response.DeckStatsProjection;
import com.multilingo.backend.modules.vocab.entity.UserFlashcard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserFlashcardRepository extends JpaRepository<UserFlashcard, Integer> {

    List<UserFlashcard> findAllByDeckIdAndUserIdOrderByCreatedAtDesc(Integer deckId, Integer userId);

    Optional<UserFlashcard> findByIdAndUserId(Integer id, Integer userId);

    boolean existsByDeckIdAndCustomWordIgnoreCase(Integer deckId, String customWord);

    @Modifying
    @Query("DELETE FROM UserFlashcard u WHERE u.deck.id = :deckId")
    void deleteByDeckId(@Param("deckId") Integer deckId);

    @Query("""
        SELECT u.deck.id AS deckId,
               COUNT(u.id) AS totalCards,
               SUM(CASE WHEN u.status = 'NEW' THEN 1 ELSE 0 END) AS newCards,
               SUM(CASE WHEN u.status = 'LEARNING' THEN 1 ELSE 0 END) AS learningCards,
               SUM(CASE WHEN u.status = 'MASTERED' THEN 1 ELSE 0 END) AS masteredCards,
               SUM(CASE WHEN u.nextReviewDate <= :now THEN 1 ELSE 0 END) AS dueReviewCards
        FROM UserFlashcard u
        WHERE u.deck.id IN :deckIds
        GROUP BY u.deck.id
    """)
    List<DeckStatsProjection> countStatsByDeckIds(@Param("deckIds") List<Integer> deckIds, @Param("now") Instant now);

    @Query("""
        SELECT u.deck.id AS deckId,
               COUNT(u.id) AS totalCards,
               SUM(CASE WHEN u.status = 'NEW' THEN 1 ELSE 0 END) AS newCards,
               SUM(CASE WHEN u.status = 'LEARNING' THEN 1 ELSE 0 END) AS learningCards,
               SUM(CASE WHEN u.status = 'MASTERED' THEN 1 ELSE 0 END) AS masteredCards,
               SUM(CASE WHEN u.nextReviewDate <= :now THEN 1 ELSE 0 END) AS dueReviewCards
        FROM UserFlashcard u
        WHERE u.deck.id = :deckId
        GROUP BY u.deck.id
    """)
    Optional<DeckStatsProjection> countStatsByDeckId(@Param("deckId") Integer deckId, @Param("now") Instant now);

    @Query("""
        SELECT u FROM UserFlashcard u
        WHERE u.deck.id = :deckId
          AND u.userId = :userId
          AND (cast(:status as string) IS NULL OR u.status = :status)
          AND (cast(:keyword as string) IS NULL
               OR LOWER(u.customWord) LIKE cast(:keyword as string)
               OR LOWER(u.customMeaning) LIKE cast(:keyword as string))
        ORDER BY u.createdAt DESC
    """)
    List<UserFlashcard> searchCards(
        @Param("deckId") Integer deckId,
        @Param("userId") Integer userId,
        @Param("keyword") String keyword,
        @Param("status") String status
    );

    @Query("""
        SELECT u FROM UserFlashcard u
        LEFT JOIN FETCH u.word
        WHERE u.deck.id = :deckId
          AND u.userId = :userId
          AND u.nextReviewDate <= :now
        ORDER BY u.nextReviewDate ASC
    """)
    List<UserFlashcard> findDueCardsForStudy(
        @Param("deckId") Integer deckId,
        @Param("userId") Integer userId,
        @Param("now") Instant now
    );

    @Query("""
        SELECT u FROM UserFlashcard u
        LEFT JOIN FETCH u.word
        WHERE u.deck.id = :deckId
          AND u.userId = :userId
        ORDER BY u.nextReviewDate ASC, u.createdAt ASC
    """)
    List<UserFlashcard> findAllForStudy(
        @Param("deckId") Integer deckId,
        @Param("userId") Integer userId
    );

    @Query("""
        SELECT u FROM UserFlashcard u
        LEFT JOIN FETCH u.word
        WHERE u.id = :id AND u.userId = :userId
    """)
    Optional<UserFlashcard> findByIdAndUserIdWithWord(@Param("id") Integer id, @Param("userId") Integer userId);

    long countByDeckIdAndUserId(Integer deckId, Integer userId);

    long countByDeckIdAndUserIdAndStatus(Integer deckId, Integer userId, String status);

    long countByUserIdAndStatus(Integer userId, String status);
}

