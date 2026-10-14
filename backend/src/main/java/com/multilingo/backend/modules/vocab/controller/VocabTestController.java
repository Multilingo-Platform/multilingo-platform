package com.multilingo.backend.modules.vocab.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.vocab.dto.request.AutoSaveProgressRequest;
import com.multilingo.backend.modules.vocab.dto.request.GenerateVocabTestRequest;
import com.multilingo.backend.modules.vocab.dto.request.SubmitVocabTestRequest;
import com.multilingo.backend.modules.vocab.dto.response.*;
import com.multilingo.backend.modules.vocab.security.VocabIdentityResolver;
import com.multilingo.backend.modules.vocab.service.VocabTestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Controller Quản lý Thi thử Từ vựng (Vocabulary Assessment / CBT Mock Test - UC012.5).
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/vocab")
@RequiredArgsConstructor
public class VocabTestController {

    private final VocabTestService vocabTestService;
    private final VocabIdentityResolver identityResolver;

    /**
     * 1. Khởi tạo đề thi kiểm tra từ vựng mới (POST /decks/{deckId}/tests/generate).
     */
    @PostMapping("/decks/{deckId}/tests/generate")
    public ResponseEntity<ApiResponse<VocabTestExamDto>> generateTest(
            @PathVariable("deckId") Integer deckId,
            @Valid @RequestBody(required = false) GenerateVocabTestRequest request
    ) {
        Integer userId = identityResolver.requireUserId();
        log.info("API: Khởi tạo đề thi thử cho deckId={}, userId={}", deckId, userId);

        GenerateVocabTestRequest actualRequest = request != null ? request : new GenerateVocabTestRequest();
        VocabTestExamDto response = vocabTestService.generateTest(deckId, userId, actualRequest);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Khởi tạo đề thi thử thành công", response));
    }

    /**
     * 2. Khôi phục bài thi khi F5 hoặc đổi thiết bị (GET /tests/{testToken}).
     */
    @GetMapping("/tests/{testToken}")
    public ResponseEntity<ApiResponse<VocabTestResumeResponse>> resumeTest(
            @PathVariable("testToken") String testToken
    ) {
        Integer userId = identityResolver.requireUserId();
        log.info("API: Khôi phục bài thi token={}, userId={}", testToken, userId);

        VocabTestResumeResponse response = vocabTestService.resumeTest(testToken, userId);
        return ResponseEntity.ok(ApiResponse.success("Tải lại bài thi thành công", response));
    }

    /**
     * 3. Tự động lưu tiến độ làm bài CAS (PUT /tests/{testToken}/progress).
     */
    @PutMapping("/tests/{testToken}/progress")
    public ResponseEntity<ApiResponse<AutoSaveProgressResponse>> saveProgress(
            @PathVariable("testToken") String testToken,
            @Valid @RequestBody AutoSaveProgressRequest request
    ) {
        Integer userId = identityResolver.requireUserId();
        log.debug("API: Autosave tiến độ token={}, userId={}, expectedVersion={}",
                testToken, userId, request.getExpectedVersion());

        AutoSaveProgressResponse response = vocabTestService.saveProgress(testToken, userId, request);
        return ResponseEntity.ok(ApiResponse.success("Đã lưu tiến độ bài thi", response));
    }

    /**
     * 4. Nộp bài kiểm tra từ vựng (POST /tests/{testToken}/submit).
     */
    @PostMapping("/tests/{testToken}/submit")
    public ResponseEntity<ApiResponse<VocabTestResultResponse>> submitTest(
            @PathVariable("testToken") String testToken,
            @Valid @RequestBody SubmitVocabTestRequest request
    ) {
        Integer userId = identityResolver.requireUserId();
        log.info("API: Nộp bài thi token={}, userId={}, expectedVersion={}",
                testToken, userId, request.getExpectedVersion());

        VocabTestResultResponse response = vocabTestService.submitTest(testToken, userId, request);
        return ResponseEntity.ok(ApiResponse.success("Nộp bài thi thành công", response));
    }

    /**
     * 5. Xem lại đáp án chi tiết và giải thích sau khi nộp (GET /tests/{testToken}/review).
     */
    @GetMapping("/tests/{testToken}/review")
    public ResponseEntity<ApiResponse<VocabTestReviewDetailDto>> reviewAnswers(
            @PathVariable("testToken") String testToken
    ) {
        Integer userId = identityResolver.requireUserId();
        log.info("API: Xem lại bài thi token={}, userId={}", testToken, userId);

        VocabTestReviewDetailDto response = vocabTestService.reviewAnswers(testToken, userId);
        return ResponseEntity.ok(ApiResponse.success("Lấy chi tiết bài làm thành công", response));
    }

    /**
     * 6. Lấy danh sách lịch sử thi thử của học viên trong bộ thẻ (GET /decks/{deckId}/tests).
     */
    @GetMapping("/decks/{deckId}/tests")
    public ResponseEntity<ApiResponse<PageResponse<VocabTestHistoryDto>>> getDeckTestHistory(
            @PathVariable("deckId") Integer deckId,
            @PageableDefault(size = 10) Pageable pageable
    ) {
        Integer userId = identityResolver.requireUserId();
        log.info("API: Lấy lịch sử thi thử deckId={}, userId={}", deckId, userId);

        Page<VocabTestHistoryDto> historyPage = vocabTestService.getDeckTestHistory(deckId, userId, pageable);
        return ResponseEntity.ok(ApiResponse.success("Lấy lịch sử thi thử thành công", PageResponse.from(historyPage)));
    }
}
