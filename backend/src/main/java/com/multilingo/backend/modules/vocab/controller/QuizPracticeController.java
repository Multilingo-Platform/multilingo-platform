package com.multilingo.backend.modules.vocab.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.modules.vocab.dto.request.CreateQuizSessionRequest;
import com.multilingo.backend.modules.vocab.dto.request.SubmitPracticeRequest;
import com.multilingo.backend.modules.vocab.dto.response.PracticeSessionSnapshotDto;
import com.multilingo.backend.modules.vocab.dto.response.SubmitPracticeResponse;
import com.multilingo.backend.modules.vocab.security.VocabIdentityResolver;
import com.multilingo.backend.modules.vocab.service.QuizPracticeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Controller Quản lý Phiên Luyện tập Từ vựng (Practice Controller - UC012.4).
 *
 * TIÊU CHUẨN KIẾN TRÚC:
 * - Phản hồi chuẩn: ResponseEntity<ApiResponse<T>>
 * - Trích xuất userId an toàn qua VocabIdentityResolver (chống IDOR)
 * - Tự động validate Bean Validation qua @Valid
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/vocab")
@RequiredArgsConstructor
public class QuizPracticeController {

    private final QuizPracticeService quizPracticeService;
    private final VocabIdentityResolver identityResolver;

    /**
     * Khởi tạo một phiên luyện tập mới từ bộ thẻ (lưu trên Redis có TTL 30 phút).
     *
     * @param deckId ID bộ thẻ cần luyện tập
     * @param request Tùy chọn lọc trạng thái (ALL, NEW, LEARNING, MASTERED, DUE) và số lượng câu hỏi
     * @return PracticeSessionSnapshotDto với HTTP 201 Created
     */
    @PostMapping({"/decks/{deckId}/practice/sessions", "/decks/{deckId}/quiz-sessions"})
    public ResponseEntity<ApiResponse<PracticeSessionSnapshotDto>> createPracticeSession(
            @PathVariable("deckId") Integer deckId,
            @Valid @RequestBody(required = false) CreateQuizSessionRequest request
    ) {
        Integer userId = identityResolver.requireUserId();
        CreateQuizSessionRequest actualRequest = request != null ? request : new CreateQuizSessionRequest();
        log.info("API: Khởi tạo phiên luyện tập cho deckId={}, userId={}, filterStatus={}",
                deckId, userId, actualRequest.getFilterStatus());

        PracticeSessionSnapshotDto response = quizPracticeService.createPracticeSession(deckId, actualRequest, userId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Khởi tạo phiên luyện tập thành công", response));
    }

    /**
     * Nộp toàn bộ câu trả lời của bài luyện tập, ghi nhận PostgreSQL receipt và nhận thưởng XP & Streak.
     *
     * @param sessionId Token/ID định danh phiên
     * @param request Danh sách câu trả lời và thời lượng làm bài
     * @return SubmitPracticeResponse Bảng điểm chi tiết với HTTP 200 OK
     */
    @PostMapping({"/practice/sessions/{sessionId}/submit", "/quiz-sessions/{sessionId}/submit"})
    public ResponseEntity<ApiResponse<SubmitPracticeResponse>> submitPracticeSession(
            @PathVariable("sessionId") String sessionId,
            @Valid @RequestBody SubmitPracticeRequest request
    ) {
        Integer userId = identityResolver.requireUserId();
        log.info("API: Nộp bài luyện tập sessionId={} bởi userId={}", sessionId, userId);

        SubmitPracticeResponse response = quizPracticeService.submitPracticeSession(sessionId, request, userId);
        return ResponseEntity.ok(ApiResponse.success("Ghi nhận kết quả luyện tập thành công", response));
    }
}
