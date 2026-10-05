package com.multilingo.backend.modules.vocab.service;

import com.multilingo.backend.modules.vocab.dto.request.CreateDeckRequest;
import com.multilingo.backend.modules.vocab.dto.request.UpdateDeckRequest;
import com.multilingo.backend.modules.vocab.dto.response.DeckDetailResponse;
import com.multilingo.backend.modules.vocab.dto.response.DeckResponse;
import com.multilingo.backend.modules.vocab.dto.response.DeckSummaryResponse;

import java.util.List;

public interface FlashcardDeckService {

    List<DeckSummaryResponse> getUserDecks(Integer userId);

    DeckDetailResponse getDeckDetail(Integer deckId, Integer userId);

    DeckResponse createDeck(CreateDeckRequest request, Integer userId);

    DeckResponse updateDeck(Integer deckId, UpdateDeckRequest request, Integer userId);

    void deleteDeck(Integer deckId, Integer userId);
}
