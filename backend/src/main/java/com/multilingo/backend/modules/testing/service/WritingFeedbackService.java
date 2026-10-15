package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.modules.testing.dto.response.WritingFeedbackResponse;

public interface WritingFeedbackService {

    /**
     * Lấy kết quả chấm điểm Writing feedback cho một part cụ thể của attempt đã nộp.
     *
     * @param attemptId ID bài thi (phải thuộc sở hữu của người dùng hiện tại và đã nộp)
     * @param partId    ID phần thi (phải thuộc snapshot đề thi và chứa câu hỏi ESSAY)
     * @return WritingFeedbackResponse chứa danh sách feedback của các task trong part
     */
    WritingFeedbackResponse getWritingFeedback(Integer attemptId, Integer partId);
}
