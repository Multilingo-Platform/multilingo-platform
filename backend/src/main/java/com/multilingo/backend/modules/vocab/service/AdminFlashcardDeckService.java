package com.multilingo.backend.modules.vocab.service;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.vocab.dto.request.CreateDeckRequest;
import com.multilingo.backend.modules.vocab.dto.request.CreateFlashcardRequest;
import com.multilingo.backend.modules.vocab.dto.request.UpdateDeckRequest;
import com.multilingo.backend.modules.vocab.dto.response.AdminDeckDetailResponse;
import com.multilingo.backend.modules.vocab.dto.response.AdminDeckResponse;
import com.multilingo.backend.modules.vocab.dto.response.DeckResponse;
import com.multilingo.backend.modules.vocab.dto.response.FlashcardResponse;
import org.springframework.data.domain.Pageable;

public interface AdminFlashcardDeckService {

    PageResponse<AdminDeckResponse> getDecks(String keyword, String targetLanguage, Boolean isPublic, Pageable pageable);

    AdminDeckDetailResponse getDeckDetail(Integer deckId);

    DeckResponse createDeck(CreateDeckRequest request, Integer adminId);

    DeckResponse updateDeck(Integer deckId, UpdateDeckRequest request);

    DeckResponse togglePublic(Integer deckId);

    void deleteDeck(Integer deckId);

    FlashcardResponse addCard(Integer deckId, CreateFlashcardRequest request, Integer adminId);

    void deleteCard(Integer cardId);
}

