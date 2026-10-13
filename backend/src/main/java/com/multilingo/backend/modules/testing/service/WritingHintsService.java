package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.modules.testing.dto.request.WritingHintsRequest;
import com.multilingo.backend.modules.testing.dto.response.WritingHintsResponse;

/**
 * Service cung cấp dàn ý và từ vựng gợi ý cho bài thi Practice Writing.
 */
public interface WritingHintsService {

    /**
     * Tạo gợi ý viết cho attempt hiện tại của người dùng đã xác thực.
     */
    WritingHintsResponse generate(Integer attemptId, WritingHintsRequest request);

    /**
     * Tiện ích gọi có chỉ định trực tiếp userId.
     */
    WritingHintsResponse generate(Integer userId, Integer attemptId, WritingHintsRequest request);
}
