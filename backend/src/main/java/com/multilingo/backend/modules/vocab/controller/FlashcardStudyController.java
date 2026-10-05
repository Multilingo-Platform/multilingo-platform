package com.multilingo.backend.modules.vocab.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.modules.vocab.dto.request.FinishStudySessionRequest;
import com.multilingo.backend.modules.vocab.dto.request.ReviewCardRequest;
import com.multilingo.backend.modules.vocab.dto.response.CardReviewResponse;
import com.multilingo.backend.modules.vocab.dto.response.StudySessionResponse;
import com.multilingo.backend.modules.vocab.dto.response.StudySessionSummaryResponse;
import com.multilingo.backend.modules.vocab.service.FlashcardStudyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Controller Quản lý Phiên ôn tập Flashcard (Spaced Repetition Flashcard Study Controller).
 *
 * MÃ USE CASE: UC012.2 - Ôn tập Flashcard
 *
 * TIÊU CHUẨN KIẾN TRÚC & CODING CONVENTION:
 * 1. Phản hồi chuẩn: Mọi endpoint đều trả về ResponseEntity<ApiResponse<T>>.
 * 2. Xác thực & Ngữ cảnh người dùng: Lấy userId thông qua header "X-User-Id" (được API Gateway/Security Filter tiêm).
 * 3. Kiểm soát lỗi tập trung: Mọi lỗi nghiệp vụ ném AppException(ErrorCode.XYZ) và được xử lý tại GlobalExceptionHandler.
 * 4. Kiểm tra hợp lệ dữ liệu (Validation): Sử dụng @Valid để kích hoạt kiểm tra Bean Validation tự động.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/vocab")
@RequiredArgsConstructor
public class FlashcardStudyController {

    private final FlashcardStudyService flashcardStudyService;

    /**
     * Khởi tạo một phiên ôn tập Flashcard mới.
     *
     * HÀNH ĐỘNG NGHIỆP VỤ:
     * - Tải danh sách thẻ từ vựng ưu tiên tới hạn ôn tập (nextReviewDate <= CURRENT_TIMESTAMP).
     * - Nếu không có thẻ tới hạn, lấy danh sách thẻ trong bộ để học viên tự do ôn tập.
     * - Tự động che từ vựng đích trong câu ví dụ (maskedSentence) để kích thích trí nhớ chủ động.
     *
     * @param deckId ID bộ thẻ cần ôn tập
     * @param userId ID người dùng đang đăng nhập (mặc định lấy từ X-User-Id)
     * @return StudySessionResponse chứa danh sách thẻ đã xử lý câu ví dụ
     */
    @GetMapping("/decks/{deckId}/study-session")
    public ResponseEntity<ApiResponse<StudySessionResponse>> getStudySession(
            @PathVariable Integer deckId,
            @RequestHeader(value = "X-User-Id", defaultValue = "1") Integer userId
    ) {
        log.info("REST API GET /api/v1/vocab/decks/{}/study-session - Khởi tạo phiên ôn tập cho userId={}", deckId, userId);
        StudySessionResponse response = flashcardStudyService.getStudySession(deckId, userId);
        return ResponseEntity.ok(ApiResponse.success("Khởi tạo phiên học thành công", response));
    }

    /**
     * Gửi đánh giá mức độ ghi nhớ cho một thẻ từ vựng theo thuật toán Spaced Repetition (SM-2).
     *
     * HÀNH ĐỘNG NGHIỆP VỤ:
     * - Tiếp nhận đánh giá: "REMEMBERED" (Đã thuộc) hoặc "FORGOTTEN" (Quên).
     * - Tính toán lại: easeFactor, intervalDays, reviewCount và nextReviewDate.
     * - Cập nhật trạng thái thẻ sang MASTERED nếu intervalDays >= 21 ngày.
     *
     * @param cardId ID thẻ từ vựng
     * @param request Payload chứa rating hợp lệ
     * @param userId ID người dùng đang đăng nhập
     * @return CardReviewResponse chứa các chỉ số SRS sau cập nhật
     */
    @PostMapping("/cards/{cardId}/review")
    public ResponseEntity<ApiResponse<CardReviewResponse>> reviewCard(
            @PathVariable Integer cardId,
            @Valid @RequestBody ReviewCardRequest request,
            @RequestHeader(value = "X-User-Id", defaultValue = "1") Integer userId
    ) {
        log.info("REST API POST /api/v1/vocab/cards/{}/review - Đánh giá thẻ rating='{}' bởi userId={}",
                cardId, request.getRating(), userId);
        CardReviewResponse response = flashcardStudyService.reviewCard(cardId, userId, request);
        return ResponseEntity.ok(ApiResponse.success("Ghi nhận đánh giá SRS thành công", response));
    }

    /**
     * Hoàn tất phiên ôn tập: Lưu thống kê học tập, cộng điểm kinh nghiệm (XP) và chuỗi Streak.
     *
     * HÀNH ĐỘNG NGHIỆP VỤ:
     * - Ghi nhận số lượng thẻ đã học vào nhật ký hàng ngày (daily_study_logs).
     * - Cộng điểm kinh nghiệm XP (+10 XP cơ bản + 2 XP/thẻ nhớ).
     * - Kiểm tra và cập nhật chuỗi ngày học liên tục (current_streak) trong user_study_stats.
     *
     * @param deckId ID bộ thẻ vừa học
     * @param request Thống kê chi tiết phiên học (cardsReviewed, cardsRemembered, cardsForgotten, durationSeconds)
     * @param userId ID người dùng đang đăng nhập
     * @return StudySessionSummaryResponse hiển thị bảng tổng kết và vinh danh
     */
    @PostMapping("/decks/{deckId}/finish-session")
    public ResponseEntity<ApiResponse<StudySessionSummaryResponse>> finishSession(
            @PathVariable Integer deckId,
            @Valid @RequestBody FinishStudySessionRequest request,
            @RequestHeader(value = "X-User-Id", defaultValue = "1") Integer userId
    ) {
        log.info("REST API POST /api/v1/vocab/decks/{}/finish-session - Hoàn tất phiên học, reviewed={}, userId={}",
                deckId, request.getCardsReviewed(), userId);
        StudySessionSummaryResponse response = flashcardStudyService.finishSession(deckId, userId, request);
        return ResponseEntity.ok(ApiResponse.success("Lưu kết quả phiên học thành công", response));
    }
}
