package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.modules.testing.ai.grading.WritingGradingContext;

import java.util.Objects;

/**
 * Quyết định về tính hợp lệ và ngữ cảnh đóng băng của một câu hỏi Writing.
 * Có hai trạng thái:
 * - Eligible: Đầy đủ điều kiện chấm (ngữ cảnh hợp lệ, đề tiếng Anh, essay <= 8.000 code points, context <= 16.000, ảnh hợp lệ)
 * - Unavailable: Không thể chấm tự động (kèm mã lý do an toàn và thông điệp không chứa thông tin nhạy cảm)
 *
 * Phương thức toString() của cả hai nhánh đều không chứa essay, prompt hoặc các chi tiết nhạy cảm.
 */
public sealed interface ContextDecision permits ContextDecision.Eligible, ContextDecision.Unavailable {

    record Eligible(WritingGradingContext context) implements ContextDecision {
        public Eligible {
            Objects.requireNonNull(context, "context must not be null");
        }

        @Override
        public String toString() {
            return "ContextDecision.Eligible[" + context + "]";
        }
    }

    record Unavailable(String reasonCode, String safeMessage) implements ContextDecision {
        public Unavailable {
            Objects.requireNonNull(reasonCode, "reasonCode must not be null");
            safeMessage = safeMessage != null ? safeMessage : "";
        }

        @Override
        public String toString() {
            return "ContextDecision.Unavailable[reasonCode=" + reasonCode + "]";
        }
    }
}
