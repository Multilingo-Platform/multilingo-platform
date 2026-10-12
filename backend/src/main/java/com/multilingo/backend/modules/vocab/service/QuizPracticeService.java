package com.multilingo.backend.modules.vocab.service;

import com.multilingo.backend.modules.vocab.dto.request.CreateQuizSessionRequest;
import com.multilingo.backend.modules.vocab.dto.request.SubmitPracticeRequest;
import com.multilingo.backend.modules.vocab.dto.response.PracticeSessionSnapshotDto;
import com.multilingo.backend.modules.vocab.dto.response.SubmitPracticeResponse;

public interface QuizPracticeService {

    /**
     * Khởi tạo phiên luyện tập trắc nghiệm mới lưu trên Redis có TTL (UC012.4).
     */
    PracticeSessionSnapshotDto createPracticeSession(Integer deckId, CreateQuizSessionRequest request, Integer userId);

    /**
     * Nộp bài hoàn thành phiên luyện tập, ghi nhận PostgreSQL receipt và cập nhật Gamification (UC012.4).
     */
    SubmitPracticeResponse submitPracticeSession(String sessionId, SubmitPracticeRequest request, Integer userId);
}
