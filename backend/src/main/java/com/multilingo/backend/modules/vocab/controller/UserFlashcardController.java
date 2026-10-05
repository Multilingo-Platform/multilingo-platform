package com.multilingo.backend.modules.vocab.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.modules.vocab.dto.request.CreateFlashcardRequest;
import com.multilingo.backend.modules.vocab.dto.request.UpdateFlashcardRequest;
import com.multilingo.backend.modules.vocab.dto.response.FlashcardResponse;
import com.multilingo.backend.modules.vocab.service.UserFlashcardService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Controller Quản lý Thẻ từ vựng cá nhân trong Bộ thẻ (Flashcards Management).
 *
 * TIÊU CHUẨN KIẾN TRÚC:
 * - Chuẩn hóa response dạng ResponseEntity<ApiResponse<T>>
 * - Tự động validate dữ liệu DTO qua @Valid
 * - Kiểm soát phân quyền và IDOR qua UserFlashcardService
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/vocab")
@RequiredArgsConstructor
public class UserFlashcardController {

    private final UserFlashcardService userFlashcardService;

    /**
     * Lấy danh sách thẻ từ vựng trong bộ thẻ, hỗ trợ tìm kiếm từ khóa và lọc theo trạng thái học (NEW, LEARNING, MASTERED).
     *
     * @param deckId ID của bộ thẻ chứa các thẻ từ vựng
     * @param keyword Từ khóa tìm kiếm (tùy chọn)
     * @param status Trạng thái thẻ cần lọc (tùy chọn)
     * @param userId ID người dùng đang đăng nhập (kiểm soát IDOR)
     * @return Danh sách FlashcardResponse kèm metadata từ điển (phiên âm, từ loại, nghĩa đa ngôn ngữ)
     */
    @GetMapping("/decks/{deckId}/cards")
    public ResponseEntity<ApiResponse<List<FlashcardResponse>>> getCardsInDeck(
            @PathVariable("deckId") Integer deckId,
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "status", required = false) String status,
            @RequestHeader(value = "X-User-Id", defaultValue = "1") Integer userId
    ) {
        log.info("API: Lấy danh sách thẻ trong deckId={}, keyword='{}', status='{}', userId={}", deckId, keyword, status, userId);
        List<FlashcardResponse> cards = userFlashcardService.getCardsInDeck(deckId, keyword, status, userId);
        return ResponseEntity.ok(ApiResponse.success(cards));
    }

    /**
     * Thêm thẻ từ vựng mới vào bộ thẻ (hỗ trợ nhập thủ công hoặc liên kết từ điển gốc tự động bốc nghĩa).
     *
     * @param deckId ID của bộ thẻ cần thêm thẻ vào
     * @param request Dữ liệu thẻ (customWord, customMeaning, exampleSentence, customImageUrl, wordId)
     * @param userId ID người dùng đang đăng nhập
     * @return FlashcardResponse với HTTP status 201 Created
     */
    @PostMapping("/decks/{deckId}/cards")
    public ResponseEntity<ApiResponse<FlashcardResponse>> addCard(
            @PathVariable("deckId") Integer deckId,
            @Valid @RequestBody CreateFlashcardRequest request,
            @RequestHeader(value = "X-User-Id", defaultValue = "1") Integer userId
    ) {
        log.info("API: Thêm thẻ từ vựng '{}' vào deckId={} bởi userId={}", request.getCustomWord(), deckId, userId);
        FlashcardResponse response = userFlashcardService.addCard(deckId, request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    /**
     * Chỉnh sửa thông tin thẻ từ vựng (từ vựng, nghĩa, ví dụ câu, ảnh minh họa).
     *
     * @param cardId ID thẻ từ vựng cần cập nhật
     * @param request Dữ liệu cập nhật
     * @param userId ID người dùng đang đăng nhập (kiểm soát IDOR)
     * @return FlashcardResponse đã cập nhật
     */
    @PutMapping("/cards/{cardId}")
    public ResponseEntity<ApiResponse<FlashcardResponse>> updateCard(
            @PathVariable("cardId") Integer cardId,
            @Valid @RequestBody UpdateFlashcardRequest request,
            @RequestHeader(value = "X-User-Id", defaultValue = "1") Integer userId
    ) {
        log.info("API: Cập nhật thẻ cardId={} bởi userId={}", cardId, userId);
        FlashcardResponse response = userFlashcardService.updateCard(cardId, request, userId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * Xóa vĩnh viễn một thẻ từ vựng khỏi bộ thẻ.
     *
     * @param cardId ID thẻ từ vựng cần xóa
     * @param userId ID người dùng đang đăng nhập (kiểm soát IDOR)
     * @return ApiResponse<Void> với HTTP 200 OK
     */
    @DeleteMapping("/cards/{cardId}")
    public ResponseEntity<ApiResponse<Void>> deleteCard(
            @PathVariable("cardId") Integer cardId,
            @RequestHeader(value = "X-User-Id", defaultValue = "1") Integer userId
    ) {
        log.info("API: Xóa thẻ cardId={} bởi userId={}", cardId, userId);
        userFlashcardService.deleteCard(cardId, userId);
        return ResponseEntity.ok(ApiResponse.success("Xóa thẻ từ vựng thành công", null));
    }
}
