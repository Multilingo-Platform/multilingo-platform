package com.multilingo.backend.modules.vocab.service;

import com.multilingo.backend.modules.vocab.dto.request.FinishStudySessionRequest;
import com.multilingo.backend.modules.vocab.dto.request.ReviewCardRequest;
import com.multilingo.backend.modules.vocab.dto.response.CardReviewResponse;
import com.multilingo.backend.modules.vocab.dto.response.StudySessionResponse;
import com.multilingo.backend.modules.vocab.dto.response.StudySessionSummaryResponse;

public interface FlashcardStudyService {

    StudySessionResponse getStudySession(Integer deckId, Integer userId);

    CardReviewResponse reviewCard(Integer cardId, Integer userId, ReviewCardRequest request);

    StudySessionSummaryResponse finishSession(Integer deckId, Integer userId, FinishStudySessionRequest request);
}
