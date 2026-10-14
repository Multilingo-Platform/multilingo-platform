package com.multilingo.backend.modules.vocab.service;

import com.multilingo.backend.modules.vocab.dto.request.AutoSaveProgressRequest;
import com.multilingo.backend.modules.vocab.dto.request.GenerateVocabTestRequest;
import com.multilingo.backend.modules.vocab.dto.request.SubmitVocabTestRequest;
import com.multilingo.backend.modules.vocab.dto.response.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * Service quản lý toàn bộ vòng đời bài thi thử từ vựng (Vocabulary Mock Test / CBT Assessment).
 */
public interface VocabTestService {

    /**
     * Khởi tạo bài thi mới cho bộ thẻ, sinh ngẫu nhiên các câu hỏi trắc nghiệm và lưu snapshot JSONB.
     */
    VocabTestExamDto generateTest(Integer deckId, Integer userId, GenerateVocabTestRequest request);

    /**
     * Khôi phục bài thi khi học viên F5 hoặc đổi thiết bị (Resume).
     */
    VocabTestResumeResponse resumeTest(String testToken, Integer userId);

    /**
     * Tự động lưu tiến độ làm bài với Compare-and-Set (CAS expectedVersion).
     */
    AutoSaveProgressResponse saveProgress(String testToken, Integer userId, AutoSaveProgressRequest request);

    /**
     * Nộp bài kiểm tra, tính điểm, ghi nhận XP và streak trong cùng một transaction.
     */
    VocabTestResultResponse submitTest(String testToken, Integer userId, SubmitVocabTestRequest request);

    /**
     * Xử lý tự động nộp bài khi quá thời gian làm bài (được gọi bởi Background Scheduler).
     */
    void handleTimeout(String testToken);

    /**
     * Xem lại chi tiết bài làm, đáp án chính xác và lời giải thích sau khi bài thi kết thúc.
     */
    VocabTestReviewDetailDto reviewAnswers(String testToken, Integer userId);

    /**
     * Lấy danh sách lịch sử các bài thi trước đó của học viên trong bộ thẻ.
     */
    Page<VocabTestHistoryDto> getDeckTestHistory(Integer deckId, Integer userId, Pageable pageable);
}
