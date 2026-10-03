package com.multilingo.backend.modules.vocab.repository;

import com.multilingo.backend.modules.vocab.entity.DictionaryWord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DictionaryWordRepository extends JpaRepository<DictionaryWord, Integer> {
}
