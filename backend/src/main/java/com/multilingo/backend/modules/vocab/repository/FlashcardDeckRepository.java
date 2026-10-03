package com.multilingo.backend.modules.vocab.repository;

import com.multilingo.backend.modules.vocab.entity.FlashcardDeck;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FlashcardDeckRepository extends JpaRepository<FlashcardDeck, Integer> {

    List<FlashcardDeck> findAllByUserIdOrderByCreatedAtDesc(Integer userId);

    Optional<FlashcardDeck> findByIdAndUserId(Integer id, Integer userId);

    boolean existsByIdAndUserId(Integer id, Integer userId);
}
