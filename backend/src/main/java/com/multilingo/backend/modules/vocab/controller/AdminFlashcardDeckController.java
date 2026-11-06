package com.multilingo.backend.modules.vocab.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.auth.security.CustomUserDetails;
import com.multilingo.backend.modules.vocab.dto.request.CreateDeckRequest;
import com.multilingo.backend.modules.vocab.dto.request.CreateFlashcardRequest;
import com.multilingo.backend.modules.vocab.dto.request.UpdateDeckRequest;
import com.multilingo.backend.modules.vocab.dto.response.AdminDeckDetailResponse;
import com.multilingo.backend.modules.vocab.dto.response.AdminDeckResponse;
import com.multilingo.backend.modules.vocab.dto.response.DeckResponse;
import com.multilingo.backend.modules.vocab.dto.response.FlashcardResponse;
import com.multilingo.backend.modules.vocab.service.AdminFlashcardDeckService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/admin/vocab/decks")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminFlashcardDeckController {

    private final AdminFlashcardDeckService adminFlashcardDeckService;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<AdminDeckResponse>>> getDecks(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String targetLanguage,
            @RequestParam(required = false) Boolean isPublic,
            @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        PageResponse<AdminDeckResponse> response = adminFlashcardDeckService.getDecks(keyword, targetLanguage, isPublic, pageable);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AdminDeckDetailResponse>> getDeckDetail(@PathVariable Integer id) {
        AdminDeckDetailResponse response = adminFlashcardDeckService.getDeckDetail(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DeckResponse>> createDeck(
            @Valid @RequestBody CreateDeckRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Integer adminId = userDetails != null && userDetails.getUser() != null ? userDetails.getUser().getId() : 1;
        DeckResponse response = adminFlashcardDeckService.createDeck(request, adminId);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("Tạo bộ thẻ thành công", response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<DeckResponse>> updateDeck(
            @PathVariable Integer id,
            @Valid @RequestBody UpdateDeckRequest request
    ) {
        DeckResponse response = adminFlashcardDeckService.updateDeck(id, request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật bộ thẻ thành công", response));
    }

    @PatchMapping("/{id}/toggle-public")
    public ResponseEntity<ApiResponse<DeckResponse>> togglePublic(@PathVariable Integer id) {
        DeckResponse response = adminFlashcardDeckService.togglePublic(id);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật trạng thái công khai thành công", response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteDeck(@PathVariable Integer id) {
        adminFlashcardDeckService.deleteDeck(id);
        return ResponseEntity.ok(ApiResponse.success("Xóa bộ thẻ thành công", null));
    }

    @PostMapping("/{id}/cards")
    public ResponseEntity<ApiResponse<FlashcardResponse>> addCard(
            @PathVariable Integer id,
            @Valid @RequestBody CreateFlashcardRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Integer adminId = userDetails != null && userDetails.getUser() != null ? userDetails.getUser().getId() : 1;
        FlashcardResponse response = adminFlashcardDeckService.addCard(id, request, adminId);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("Thêm thẻ từ vựng thành công", response));
    }

    @DeleteMapping("/cards/{cardId}")
    public ResponseEntity<ApiResponse<Void>> deleteCard(@PathVariable Integer cardId) {
        adminFlashcardDeckService.deleteCard(cardId);
        return ResponseEntity.ok(ApiResponse.success("Xóa thẻ từ vựng thành công", null));
    }
}

