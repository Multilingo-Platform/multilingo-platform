package com.multilingo.backend.modules.testing.adapter;

import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;

import java.util.Map;

/**
 * Adapter tải answer key cho một exam.
 * Implementation dev/test: FixtureGradingAdapter (đọc grading-fixture.json).
 * Implementation production: sẽ kết nối TV2 ExamRepository (Sprint 11).
 */
public interface GradingAdapter {

    /**
     * Tải Map<partId, PartGradingKey> cho một exam.
     * Nếu examId không tìm thấy trong nguồn dữ liệu → trả Map rỗng (không ném exception).
     * Engine chấm sẽ mark tất cả câu là BLANK nếu không có key cho Part tương ứng.
     *
     * @param examId ID của đề thi
     * @return Map không null, có thể rỗng
     */
    Map<Integer, PartGradingKey> loadPartKeys(Integer examId);
}
