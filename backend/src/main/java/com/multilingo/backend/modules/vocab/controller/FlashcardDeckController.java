package com.multilingo.backend.modules.vocab.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.modules.vocab.dto.request.CreateDeckRequest;
import com.multilingo.backend.modules.vocab.dto.request.UpdateDeckRequest;
import com.multilingo.backend.modules.vocab.dto.response.DeckDetailResponse;
import com.multilingo.backend.modules.vocab.dto.response.DeckResponse;
import com.multilingo.backend.modules.vocab.dto.response.DeckSummaryResponse;
import com.multilingo.backend.modules.vocab.service.FlashcardDeckService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Controller Quản lý Sổ tay & Bộ thẻ từ vựng (Vocab Decks Management).
 *
 * TIÊU CHUẨN KIẾN TRÚC:
 * - Kế thừa chuẩn ApiResponse: ResponseEntity<ApiResponse<T>>
 * - Nhận userId từ context xác thực / header X-User-Id
 * - Xử lý validation dữ liệu tự động qua @Valid
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/vocab/decks")
@RequiredArgsConstructor
public class FlashcardDeckController {

    private final FlashcardDeckService flashcardDeckService;

    /**
     * Lấy danh sách toàn bộ các bộ thẻ từ vựng của người dùng hiện tại kèm số liệu thống kê.
     *
     * @param userId ID người dùng đăng nhập (truyền qua header X-User-Id hoặc trích xuất từ auth token)
     * @return Danh sách DeckSummaryResponse kèm số thẻ NEW, LEARNING, MASTERED, DUE TODAY
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<DeckSummaryResponse>>> getUserDecks(
            @RequestHeader(value = "X-User-Id", defaultValue = "1") Integer userId
    ) {
        log.info("API: Lấy danh sách bộ thẻ của userId={}", userId);
        List<DeckSummaryResponse> decks = flashcardDeckService.getUserDecks(userId);
        return ResponseEntity.ok(ApiResponse.success(decks));
    }

    /**
     * Tạo mới một bộ thẻ từ vựng cá nhân hóa (hỗ trợ chỉ định cặp ngôn ngữ học & giải nghĩa).
     *
     * @param request Dữ liệu tạo bộ thẻ (name, description, targetLanguage, sourceLanguage, isPublic)
     * @param userId ID người dùng đang đăng nhập
     * @return DeckResponse với HTTP status 201 Created
     */
    @PostMapping
    public ResponseEntity<ApiResponse<DeckResponse>> createDeck(
            @Valid @RequestBody CreateDeckRequest request,
            @RequestHeader(value = "X-User-Id", defaultValue = "1") Integer userId
    ) {
        log.info("API: Tạo bộ thẻ mới '{}' cho userId={}", request.getName(), userId);
        DeckResponse response = flashcardDeckService.createDeck(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    /**
     * Lấy thông tin chi tiết một bộ thẻ kèm thống kê và cấu hình cặp ngôn ngữ.
     *
     * @param id ID của bộ thẻ cần xem
     * @param userId ID người dùng đang đăng nhập (kiểm soát IDOR)
     * @return DeckDetailResponse
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DeckDetailResponse>> getDeckDetail(
            @PathVariable("id") Integer id,
            @RequestHeader(value = "X-User-Id", defaultValue = "1") Integer userId
    ) {
        log.info("API: Lấy chi tiết bộ thẻ id={} cho userId={}", id, userId);
        DeckDetailResponse response = flashcardDeckService.getDeckDetail(id, userId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * Chỉnh sửa thông tin bộ thẻ (tên, mô tả, quyền riêng tư, cặp ngôn ngữ).
     *
     * @param id ID bộ thẻ cần chỉnh sửa
     * @param request Dữ liệu cập nhật
     * @param userId ID người dùng đang đăng nhập (kiểm soát IDOR)
     * @return DeckResponse đã cập nhật
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<DeckResponse>> updateDeck(
            @PathVariable("id") Integer id,
            @Valid @RequestBody UpdateDeckRequest request,
            @RequestHeader(value = "X-User-Id", defaultValue = "1") Integer userId
    ) {
        log.info("API: Cập nhật bộ thẻ id={} bởi userId={}", id, userId);
        DeckResponse response = flashcardDeckService.updateDeck(id, request, userId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * Xóa vĩnh viễn một bộ thẻ và toàn bộ thẻ từ vựng con bên trong (Cascade Delete an toàn).
     *
     * @param id ID bộ thẻ cần xóa
     * @param userId ID người dùng đang đăng nhập (kiểm soát IDOR)
     * @return ApiResponse<Void> với HTTP 200 OK
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteDeck(
            @PathVariable("id") Integer id,
            @RequestHeader(value = "X-User-Id", defaultValue = "1") Integer userId
    ) {
        log.info("API: Xóa bộ thẻ id={} bởi userId={}", id, userId);
        flashcardDeckService.deleteDeck(id, userId);
        return ResponseEntity.ok(ApiResponse.success("Xóa bộ thẻ thành công", null));
    }
}
