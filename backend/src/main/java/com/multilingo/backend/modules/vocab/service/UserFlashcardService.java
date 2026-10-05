package com.multilingo.backend.modules.vocab.service;

import com.multilingo.backend.modules.vocab.dto.request.CreateFlashcardRequest;
import com.multilingo.backend.modules.vocab.dto.request.UpdateFlashcardRequest;
import com.multilingo.backend.modules.vocab.dto.response.FlashcardResponse;

import java.util.List;

public interface UserFlashcardService {

    List<FlashcardResponse> getCardsInDeck(Integer deckId, String keyword, String status, Integer userId);

    FlashcardResponse addCard(Integer deckId, CreateFlashcardRequest request, Integer userId);

    FlashcardResponse updateCard(Integer cardId, UpdateFlashcardRequest request, Integer userId);

    void deleteCard(Integer cardId, Integer userId);
}
